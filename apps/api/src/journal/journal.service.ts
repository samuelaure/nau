import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { getClientForFeature } from '@nau/llm-client';
import { signServiceToken } from '@nau/auth';
import { z } from 'zod';
import { BlocksService } from '../blocks/blocks.service';
import dayjs from 'dayjs';
import axios from 'axios';

const JournalSummarySchema = z.object({
  synthesis: z.string().describe('A high-level interpretation of "what it means" (main themes, mood, focus trajectory, patterns). Priorities in position.'),
  summary: z.string().describe('An objective, beautifully written recount of "what happened" (facts, completed tasks, metrics).'),
  highlights: z.array(z.string()).describe('List of key themes or highlights.'),
});

type JournalSummaryOutput = z.infer<typeof JournalSummarySchema>;

@Injectable()
export class JournalService {
  private readonly logger = new Logger(JournalService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly blocksService: BlocksService,
  ) {}

  /**
   * Mock for user preferences. In Phase 9 this will be a real DB model.
   */
  private async getUserPreferences() {
    return {
      autoDaily: true,
      autoWeekly: true,
      autoMonthly: true,
      autoTrimester: true,
      autoYearly: true,
      defaultLanguage: 'es',
    };
  }

  async generateSummary(
    periodType: 'daily' | 'weekly' | 'monthly' | 'trimester' | 'yearly' | 'custom',
    startDateStr: string,
    endDateStr: string,
    workspaceId: string,
  ) {
    const startDate = dayjs(startDateStr).startOf('day').toDate();
    const endDate = dayjs(endDateStr).endOf('day').toDate();

    this.logger.log(`Generating hierarchical ${periodType} summary from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Idempotency check: don't regenerate if already exists for the exact period
    const existingSummary = await this.prisma.block.findFirst({
      where: {
        type: 'journal_summary',
        workspaceId,
        properties: {
          path: ['periodType'],
          equals: periodType
        },
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    if (existingSummary && periodType !== 'custom') {
      this.logger.log(`Summary for ${periodType} already exists (ID: ${existingSummary.id}). Skipping.`);
      return { success: true, blockId: existingSummary.id, cached: true };
    }

    // 1. Fetch RAW data (journal_entries, actions, etc.)
    const rawBlocksInPeriod = await this.prisma.block.findMany({
      where: {
        workspaceId,
        createdAt: { gte: startDate, lte: endDate },
        deletedAt: null
      }
    });

    const journalEntries = rawBlocksInPeriod.filter(b => b.type === 'journal_entry');
    const actionBlocks = rawBlocksInPeriod.filter(b => b.type === 'action');
    const contentIdeas = rawBlocksInPeriod.filter(b => b.type === 'content_idea');
    const completedBlocks = rawBlocksInPeriod.filter(
      b => b.type === 'action' && ((b.properties as any)?.status === 'done' || (b.properties as any)?.status === 'completed')
    );

    // Nothing happened in this period. Generating anyway costs an LLM call and
    // writes a summary of nothing, which is what produced 128 summaries against
    // 76 entries while the journal sat idle.
    if (journalEntries.length === 0 && actionBlocks.length === 0 && contentIdeas.length === 0) {
      this.logger.log(`No journal activity for ${periodType} in workspace ${workspaceId}. Skipping.`);
      return { success: true, skipped: true, reason: 'no activity' };
    }

    // 2. Recursive/Hierarchical context: fetch existing INFERIOR summaries
    // We fetch summaries that are strictly "smaller" than the current periodType
    const inferiorSummaries = await this.prisma.block.findMany({
      where: {
        type: 'journal_summary',
        workspaceId,
        createdAt: { gte: startDate, lte: endDate },
        // Simple logic: we include all existing summaries in the period
        // (The AI prompt will be instructed on how to treat them as condensed knowledge)
      }
    });

    // 3. Format context for AI
    let contextText = '';

    if (inferiorSummaries.length > 0) {
      contextText += "### INFERIOR PERIOD SUMMARIES (Condensed Knowledge):\n";
      inferiorSummaries.forEach(sum => {
        const props = sum.properties as any;
        contextText += `#### ${props.periodType} Summary (${dayjs(sum.createdAt).format('YYYY-MM-DD')}):\n`;
        contextText += `**Synthesis**: ${props.synthesis || ''}\n`;
        contextText += `**Summary**: ${props.summary || ''}\n\n`;
      });
    }

    contextText += "### RAW DATA (Individual Experiences):\n";
    if (journalEntries.length > 0) {
      contextText += "#### Journal Entries:\n";
      journalEntries.forEach(entry => {
        const text = (entry.properties as any)?.summary || (entry.properties as any)?.text || '';
        if (text) contextText += `- [${dayjs(entry.createdAt).format('HH:mm')}] ${text}\n`;
      });
    }

    if (actionBlocks.length > 0) {
      contextText += "\n#### Actions (Created/Status):\n";
      actionBlocks.forEach(action => {
        const text = (action.properties as any)?.text || (action.properties as any)?.name || 'Untitled';
        const st = (action.properties as any)?.status;
        contextText += `- [${st || 'pending'}] ${text}\n`;
      });
    }

    if (!contextText.trim()) {
      return { success: false, error: 'No data to summarize in this period.' };
    }

    // 4. Call OpenAI with Synthesis + Summary requirement
    let aiResult: JournalSummaryOutput = { 
      synthesis: 'Resumen no disponible.', 
      summary: 'No se encontraron datos procesables.', 
      highlights: [] 
    };

    try {
      const { client: llmClient, model: llmModel } = getClientForFeature('journal_summary');
      if (llmClient) {
        try {
          const result = await llmClient.parseCompletion({
            model: llmModel,
            temperature: 0.2,
          schema: JournalSummarySchema as any,
          schemaName: 'JournalSummary',
          messages: [
            {
              role: 'system',
              content: `You are an AI Second Brain architect creating a ${periodType} review.
Your output MUST contain two distinct parts:
1. **Synthesis**: The "Soul" of the period. A deep, high-level interpretation of what these experiences mean, mood trajectory, recurring patterns, and overall impact. Prioritize this in position.
2. **Summary**: The "Body". An objective, structured recount of what actually happened, tasks completed, metrics, and facts.

RECURSIVE LOGIC:
You are provided with both "Inferior Summaries" (condensed knowledge from smaller periods) and "Raw Data" (individual events).
Use the Inferior Summaries as your primary cognitive anchor to avoid getting lost in noise, while using Raw Data to extract specific flavor and evidence.

TONE: Reflective, elite, concise yet profound.
LANGUAGE: Spanish (predominantly).
LENGTH: ${periodType === 'daily' ? 'Brief (1-2 paragraphs)' : periodType === 'yearly' ? 'Comprehensive (4-5 paragraphs)' : 'Balanced (2-3 paragraphs)'}.`
            },
            {
              role: 'user',
              content: contextText
            }
          ],
          });
          aiResult = result.data as JournalSummaryOutput;
        } catch (err) {
          this.logger.error('Error calling LLM for hierarchical summary', err);
        }
      }
    } catch {
      this.logger.warn('LLM not configured. Skipping journal AI summary.');
    }

    // 5. Save as Block
    const newSummaryBlock = await this.blocksService.createInternal({
      type: 'journal_summary',
      workspaceId,
      properties: {
        periodType,
        periodStart: startDate.toISOString(),
        periodEnd: endDate.toISOString(),
        synthesis: aiResult.synthesis,
        summary: aiResult.summary,
        highlights: aiResult.highlights,
        actionCount: actionBlocks.length,
        completedCount: completedBlocks.length,
        contentIdeasCount: contentIdeas.length
      }
    });

    // 6. Build Relations (Hierarchical Graph)
    // Link to inferior summaries
    for (const inf of inferiorSummaries) {
      await this.prisma.relation.create({
        data: {
          type: 'parent_summary_of',
          fromBlockId: newSummaryBlock.id,
          toBlockId: inf.id
        }
      });
    }
    // Link to raw entries
    for (const j of journalEntries) {
      await this.prisma.relation.create({
        data: {
          type: 'summarized_by',
          fromBlockId: j.id,
          toBlockId: newSummaryBlock.id
        }
      });
    }

    // 7. Format Delivery Message
    let finalDeliveryText = `✨ *SÍNTESIS*\n${aiResult.synthesis}\n\n`;
    finalDeliveryText += `📝 *RESUMEN*\n${aiResult.summary}\n\n`;
    
    const statsLine = `📊 Stats: ✅ ${completedBlocks.length}/${actionBlocks.length} | 💡 ${contentIdeas.length} | 📓 ${journalEntries.length}\n`;
    finalDeliveryText += statsLine;

    // Daily specific: chronological list
    if (periodType === 'daily' && journalEntries.length > 0) {
      finalDeliveryText += `\n📅 *ENTRADAS CRONOLÓGICAS:*\n`;
      journalEntries.forEach(e => {
        const text = (e.properties as any)?.summary || (e.properties as any)?.text || '';
        finalDeliveryText += `• _${dayjs(e.createdAt).format('HH:mm')}_: ${text}\n`;
      });
    }

    // 8. Notify Zazu (if configured)
    const zazuUrl = process.env.ZAZU_INTERNAL_URL || 'http://zazu:3000';

    const periodTitle = `${periodType === 'daily' ? 'Diario' : periodType === 'weekly' ? 'Semanal' : periodType === 'monthly' ? 'Mensual' : periodType === 'trimester' ? 'Trimestral' : periodType === 'yearly' ? 'Anual' : 'Personalizado'}`;
    const displayDate = dayjs(startDate).format('DD MMM YYYY');

    if (periodType !== 'custom') {
      const recipients = await this.getWorkspaceRecipients(workspaceId);

      for (const nauUserId of recipients) {
        try {
          const token = await signServiceToken({
            iss: '9nau-api',
            aud: 'zazu',
            secret: this.configService.getOrThrow<string>('AUTH_SECRET'),
          });

          await axios.post(`${zazuUrl}/api/internal/notify`, {
             nauUserId,
             type: 'journal_summary',
             periodType,
             periodTitle: `Resumen ${periodTitle} — ${displayDate}`,
             summaryData: finalDeliveryText
          }, {
             headers: { Authorization: `Bearer ${token}` },
             timeout: 10000
          });
        } catch (err: any) {
          this.logger.error(`Failed to notify Zazŭ for ${nauUserId}: ${err.message}`);
        }
      }
    }

    return {
      success: true,
      blockId: newSummaryBlock.id,
      data: newSummaryBlock,
      summaryData: finalDeliveryText
    };
  }

  async saveDirectSummary(
    periodType: string,
    type: string,
    synthesis: string,
    summary: string,
    startDateStr: string,
    endDateStr: string
  ) {
    const startDate = dayjs(startDateStr).startOf('day').toDate();
    const endDate = dayjs(endDateStr).endOf('day').toDate();

    this.logger.log(`Saving direct summary of type ${type} for period ${periodType}`);

    const newSummaryBlock = await this.blocksService.createInternal({
      type, // 'journal_summary' or 'content_brief'
      properties: {
        periodType,
        periodStart: startDate.toISOString(),
        periodEnd: endDate.toISOString(),
        synthesis,
        summary,
        highlights: [],
      }
    });

    return {
      success: true,
      blockId: newSummaryBlock.id,
      data: newSummaryBlock,
    };
  }

  /**
   * Workspaces with journal activity in the period. The cron used to summarise
   * every Block on the platform in one pass, which mixed tenants into a single
   * summary; it now produces one summary per workspace.
   */
  private async getActiveWorkspaces(startDate: Date, endDate: Date): Promise<string[]> {
    const rows = await this.prisma.block.findMany({
      where: {
        workspaceId: { not: null },
        deletedAt: null,
        createdAt: { gte: startDate, lte: endDate },
        type: { in: ['journal_entry', 'action', 'content_idea'] },
      },
      select: { workspaceId: true },
      distinct: ['workspaceId'],
    });
    return rows.map((r) => r.workspaceId!).filter(Boolean);
  }

  /** naŭ user ids of every member of a workspace, for proactive delivery. */
  private async getWorkspaceRecipients(workspaceId: string): Promise<string[]> {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  /** Runs one scoped summary per workspace that saw activity. */
  private async generateForActiveWorkspaces(
    periodType: 'daily' | 'weekly' | 'monthly' | 'trimester' | 'yearly',
    startIso: string,
    endIso: string,
  ) {
    const startDate = dayjs(startIso).startOf('day').toDate();
    const endDate = dayjs(endIso).endOf('day').toDate();
    const workspaceIds = await this.getActiveWorkspaces(startDate, endDate);

    if (workspaceIds.length === 0) {
      this.logger.log(`No workspace had activity for the ${periodType} period. Skipping.`);
      return;
    }

    for (const workspaceId of workspaceIds) {
      try {
        await this.generateSummary(periodType, startIso, endIso, workspaceId);
      } catch (err: any) {
        this.logger.error(`${periodType} summary failed for workspace ${workspaceId}: ${err.message}`);
      }
    }
  }

  // --- REFACTORED TRIGGERS ---

  @Cron('0 23 * * *')
  async handleDailySummary() {
    const prefs = await this.getUserPreferences();
    if (!prefs.autoDaily) return;
    
    this.logger.log('Daily Summary Triggered (Config-aware)');
    await this.generateForActiveWorkspaces('daily', dayjs().startOf('day').toISOString(), dayjs().endOf('day').toISOString());
  }

  @Cron('0 20 * * 0')
  async handleWeeklySummary() {
    const prefs = await this.getUserPreferences();
    if (!prefs.autoWeekly) return;

    this.logger.log('Weekly Summary Triggered (Config-aware)');
    const start = dayjs().startOf('week').add(1, 'day').toISOString();
    const end = dayjs().endOf('week').add(1, 'day').toISOString();
    await this.generateForActiveWorkspaces('weekly', start, end);
  }

  @Cron('0 18 1 * *')
  async handleMonthlySummary() {
    const prefs = await this.getUserPreferences();
    if (!prefs.autoMonthly) return;

    this.logger.log('Monthly Summary Triggered (Config-aware)');
    const start = dayjs().subtract(1, 'month').startOf('month').toISOString();
    const end = dayjs().subtract(1, 'month').endOf('month').toISOString();
    await this.generateForActiveWorkspaces('monthly', start, end);
  }

  @Cron('0 18 1 1,4,7,10 *')
  async handleTrimesterSummary() {
    const prefs = await this.getUserPreferences();
    if (!prefs.autoTrimester) return;

    const start = dayjs().subtract(3, 'months').startOf('month').toISOString();
    const end = dayjs().subtract(1, 'month').endOf('month').toISOString();
    await this.generateForActiveWorkspaces('trimester', start, end);
  }

  @Cron('0 18 1 1 *')
  async handleYearlySummary() {
    const prefs = await this.getUserPreferences();
    if (!prefs.autoYearly) return;

    const start = dayjs().subtract(1, 'year').startOf('year').toISOString();
    const end = dayjs().subtract(1, 'year').endOf('year').toISOString();
    await this.generateForActiveWorkspaces('yearly', start, end);
  }
}
