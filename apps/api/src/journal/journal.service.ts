import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { getClientForFeature } from '@nau/llm-client';
import { signServiceToken } from '@nau/auth';
import { z } from 'zod';
import { BlocksService } from '../blocks/blocks.service';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import axios from 'axios';

// The summary prompt names its own period in Spanish. Without the locale
// dayjs renders the month in English, so the model is handed "20 de August".
dayjs.locale('es');

const JournalSummarySchema = z.object({
  synthesis: z.string().describe('What the period meant: recurring themes, how the mood moved, what it was really about. Interpretation of the record, never beyond it.'),
  summary: z.string().describe('What happened: events, decisions, work, people, places. First person, plain, factual.'),
  highlights: z.array(z.string()).describe('The few things worth remembering, one short line each. Empty if the record does not support any.'),
});

type JournalSummaryOutput = z.infer<typeof JournalSummarySchema>;

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'trimester' | 'yearly' | 'custom';

/**
 * What each period reads.
 *
 * The day and the week read the entries themselves, because they are close
 * enough to the writing that the author's own words still fit. From the month
 * up, each level reads summaries one step down — a size that keeps the input
 * bounded (≈30 dailies, ≈13 weeklies, 12 monthlies) and keeps the hierarchy
 * meaningful: a year built from every entry of the year would overflow the
 * context window and silently drop whatever fell off the end.
 *
 * Note that the month and the trimester are parallel branches rather than
 * nested: the trimester reads weeks, not months, and the year reads months, not
 * trimesters. That is deliberate — each level picks the granularity that gives
 * it a useful number of inputs, rather than inheriting whatever the level below
 * happened to produce.
 */
const SUMMARY_SOURCE: Record<PeriodType, 'entries' | PeriodType> = {
  daily: 'entries',
  weekly: 'entries',
  monthly: 'daily',
  trimester: 'weekly',
  yearly: 'monthly',
  custom: 'entries',
};

const PERIOD_LABEL: Record<PeriodType, string> = {
  daily: 'Diario',
  weekly: 'Semanal',
  monthly: 'Mensual',
  trimester: 'Trimestral',
  yearly: 'Anual',
  custom: 'Personalizado',
};

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

  /**
   * The text of an entry, as the summaries read it.
   *
   * Every entry stores two forms of itself: `raw`, the capture as it arrived,
   * and `summary`, that same text with the disfluencies taken out. Summaries
   * read ONE of them. Reading both would put the same content in front of the
   * model twice and weight it accordingly.
   *
   * `raw` is the one, because it is the only form with no model standing between
   * the microphone and the summary. The cleaned version is itself a model
   * output, and however tightly its prompt is written it remains one more place
   * the wording can drift. The filler it strips costs a handful of tokens and
   * confuses nothing.
   *
   * Neither is ever a summary of the entry: a day built from summaries of its
   * entries is a summary of summaries, and each such layer drops the specifics —
   * the names, the numbers, the turns of phrase — which are the part worth
   * keeping.
   */
  private entryText(block: { properties: unknown }): string {
    const p = block.properties as Record<string, unknown> | null;
    // The fallbacks are for rows that predate the field, not a routine path:
    // every entry has carried `raw` since the backfill.
    return (p?.raw as string) || (p?.summary as string) || (p?.text as string) || '';
  }

  async generateSummary(
    periodType: PeriodType,
    startDateStr: string,
    endDateStr: string,
    workspaceId: string,
  ) {
    const startDate = dayjs(startDateStr).startOf('day').toDate();
    const endDate = dayjs(endDateStr).endOf('day').toDate();
    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();
    const source = SUMMARY_SOURCE[periodType];

    this.logger.log(`Generating ${periodType} summary (source: ${source}) from ${startIso} to ${endIso}`);

    // Idempotency, matched on the period the summary covers. This used to match
    // on createdAt falling inside the period, which is wrong in both directions:
    // a monthly summary is written on the 1st of the following month and so
    // never matched itself, while any daily written today blocked every other
    // daily for today.
    const existingSummary = await this.prisma.block.findFirst({
      where: {
        type: 'journal_summary',
        workspaceId,
        deletedAt: null,
        AND: [
          { properties: { path: ['periodType'], equals: periodType } },
          { properties: { path: ['periodStart'], equals: startIso } },
          { properties: { path: ['periodEnd'], equals: endIso } },
        ],
      },
    });

    if (existingSummary && periodType !== 'custom') {
      this.logger.log(`Summary for ${periodType} ${startIso} already exists (${existingSummary.id}). Skipping.`);
      return { success: true, blockId: existingSummary.id, cached: true };
    }

    // Entries are selected by properties.date — when the thought was captured —
    // not by createdAt, which is when ingestion happened to finish. A note
    // recorded at 23:50 and transcribed at 00:05 belongs to the day it was
    // spoken. In the existing 76 entries these differ by a day in 20 cases, so
    // filtering on createdAt misfiles a quarter of the journal.
    const journalEntries = await this.prisma.block.findMany({
      where: {
        workspaceId,
        type: 'journal_entry',
        deletedAt: null,
        AND: [
          { properties: { path: ['date'], gte: startIso } },
          { properties: { path: ['date'], lte: endIso } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    // Actions and ideas are context, not the record itself, and are not
    // guaranteed to carry a date property, so they stay on createdAt.
    const sideBlocks = await this.prisma.block.findMany({
      where: {
        workspaceId,
        type: { in: ['action', 'content_idea'] },
        deletedAt: null,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const actionBlocks = sideBlocks.filter(b => b.type === 'action');
    const contentIdeas = sideBlocks.filter(b => b.type === 'content_idea');
    const completedBlocks = actionBlocks.filter(
      b => ((b.properties as any)?.status === 'done' || (b.properties as any)?.status === 'completed')
    );

    // The summaries this period is built from, if it is built from summaries.
    // Selected by the period they cover and by their own type, so a month reads
    // its days and nothing else. deletedAt matters here: the 95 fabricated
    // summaries were soft-deleted, and the previous query would have fed them
    // straight back in as context.
    const sourceSummaries = source === 'entries' ? [] : await this.prisma.block.findMany({
      where: {
        type: 'journal_summary',
        workspaceId,
        deletedAt: null,
        AND: [
          { properties: { path: ['periodType'], equals: source } },
          { properties: { path: ['periodStart'], gte: startIso } },
          { properties: { path: ['periodEnd'], lte: endIso } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    // Nothing to read. Generating anyway costs an LLM call and writes a summary
    // of nothing, which is what produced 128 summaries against 76 entries while
    // the journal sat idle.
    const hasInput = source === 'entries'
      ? journalEntries.length > 0 || actionBlocks.length > 0 || contentIdeas.length > 0
      : sourceSummaries.length > 0;

    if (!hasInput) {
      this.logger.log(`No ${source} input for ${periodType} in workspace ${workspaceId}. Skipping.`);
      return { success: true, skipped: true, reason: 'no input' };
    }

    // Format the input for the model
    let contextText = '';

    if (source === 'entries') {
      if (journalEntries.length > 0) {
        contextText += '## ENTRADAS DEL DIARIO\n';
        journalEntries.forEach(entry => {
          const text = this.entryText(entry);
          if (!text) return;
          const at = (entry.properties as any)?.date ?? entry.createdAt;
          contextText += `\n### ${dayjs(at).format('YYYY-MM-DD HH:mm')}\n${text}\n`;
        });
      }
    } else {
      contextText += `## RESÚMENES ${source.toUpperCase()} DEL PERIODO\n`;
      sourceSummaries.forEach(sum => {
        const props = sum.properties as any;
        const from = dayjs(props.periodStart).format('YYYY-MM-DD');
        const to = dayjs(props.periodEnd).format('YYYY-MM-DD');
        contextText += `\n### ${from} → ${to}\n`;
        if (props.summary) contextText += `Qué pasó: ${props.summary}\n`;
        if (props.synthesis) contextText += `Qué significó: ${props.synthesis}\n`;
      });
    }

    if (actionBlocks.length > 0) {
      contextText += '\n## TAREAS DEL PERIODO\n';
      actionBlocks.forEach(action => {
        const text = (action.properties as any)?.text || (action.properties as any)?.name || 'Sin título';
        const st = (action.properties as any)?.status;
        contextText += `- [${st || 'pendiente'}] ${text}\n`;
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
              content: `Estás escribiendo el resumen ${PERIOD_LABEL[periodType].toLowerCase()} del diario personal de alguien, que cubre del ${dayjs(startDate).format('D [de] MMMM [de] YYYY')} al ${dayjs(endDate).format('D [de] MMMM [de] YYYY')}.

Recibes ${source === 'entries' ? 'las entradas que esa persona escribió o dictó durante el periodo, tal cual las dejó' : `los resúmenes ${source} que ya cubren este periodo`}. Eso es todo el registro que existe. No hay más.

Devuelve tres cosas:

1. "summary" — qué pasó. Hechos concretos: acontecimientos, decisiones, trabajo hecho, personas, lugares, cifras. En primera persona, en prosa llana, como un registro que esta persona va a releer dentro de años y necesita que sea exacto.

2. "synthesis" — qué significó. Los temas que se repiten, cómo se movió el ánimo, de qué iba realmente el periodo. Interpretación de lo que está en el registro, nunca más allá de él.

3. "highlights" — lo poco que merece recordarse, una línea corta cada uno. Devuelve una lista vacía si el registro no da para ninguno.

REGLA ABSOLUTA — nada de lo que escribas puede no estar en la entrada. No infieras acontecimientos, emociones ni detalles que no aparezcan. Si el registro es escaso, escribe poco. Una entrada breve y fiel es correcta; una entrada rica e inventada es un recuerdo falso, y esto es el registro que esta persona tiene de su propia vida.

No añadas consejos, ánimos, moralejas ni conclusiones a las que la persona no haya llegado ella misma. No adornes. No uses lenguaje grandilocuente.

Escribe en el mismo idioma en que está escrito el registro.

EXTENSIÓN: ${periodType === 'daily' ? 'breve, uno o dos párrafos' : periodType === 'yearly' ? 'amplia, cuatro o cinco párrafos' : 'media, dos o tres párrafos'}.`
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
        contentIdeasCount: contentIdeas.length,
        // What this summary was actually built from, recorded on the summary
        // itself. Without it there is no way to tell later whether a given
        // summary predates this hierarchy.
        sourceType: source,
        sourceCount: source === 'entries' ? journalEntries.length : sourceSummaries.length,
      }
    });

    // The hierarchy as a graph: each summary points at exactly what it read.
    if (sourceSummaries.length > 0) {
      await this.prisma.relation.createMany({
        data: sourceSummaries.map(inf => ({
          type: 'parent_summary_of',
          fromBlockId: newSummaryBlock.id,
          toBlockId: inf.id,
        })),
        skipDuplicates: true,
      });
    }

    if (source === 'entries' && journalEntries.length > 0) {
      await this.prisma.relation.createMany({
        data: journalEntries.map(j => ({
          type: 'summarized_by',
          fromBlockId: j.id,
          toBlockId: newSummaryBlock.id,
        })),
        skipDuplicates: true,
      });
    }

    // 7. Format Delivery Message
    let finalDeliveryText = `✨ *SÍNTESIS*\n${aiResult.synthesis}\n\n`;
    finalDeliveryText += `📝 *RESUMEN*\n${aiResult.summary}\n\n`;
    
    const statsLine = `📊 Stats: ✅ ${completedBlocks.length}/${actionBlocks.length} | 💡 ${contentIdeas.length} | 📓 ${journalEntries.length}\n`;
    finalDeliveryText += statsLine;

    // Daily specific: chronological list, showing the entries themselves rather
    // than anything derived from them — the same text the summary was built on.
    if (periodType === 'daily' && journalEntries.length > 0) {
      finalDeliveryText += `\n📅 *ENTRADAS CRONOLÓGICAS:*\n`;
      journalEntries.forEach(e => {
        const at = (e.properties as any)?.date ?? e.createdAt;
        finalDeliveryText += `• _${dayjs(at).format('HH:mm')}_: ${this.entryText(e)}\n`;
      });
    }

    // 8. Notify Zazu (if configured)
    const zazuUrl = process.env.ZAZU_INTERNAL_URL || 'http://zazu:3000';

    const periodTitle = PERIOD_LABEL[periodType];
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
  private async getActiveWorkspaces(
    periodType: PeriodType,
    startDate: Date,
    endDate: Date,
  ): Promise<string[]> {
    const source = SUMMARY_SOURCE[periodType];
    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    // A workspace is a candidate when it holds whatever this period reads. Ask
    // for the wrong thing and the run is skipped for a workspace that has
    // perfectly good input — a month whose days are all summarised still has no
    // blocks created inside the month if ingestion ran late.
    const where: Prisma.BlockWhereInput = source === 'entries'
      ? {
          workspaceId: { not: null },
          deletedAt: null,
          OR: [
            {
              type: 'journal_entry',
              AND: [
                { properties: { path: ['date'], gte: startIso } },
                { properties: { path: ['date'], lte: endIso } },
              ],
            },
            {
              type: { in: ['action', 'content_idea'] },
              createdAt: { gte: startDate, lte: endDate },
            },
          ],
        }
      : {
          workspaceId: { not: null },
          deletedAt: null,
          type: 'journal_summary',
          AND: [
            { properties: { path: ['periodType'], equals: source } },
            { properties: { path: ['periodStart'], gte: startIso } },
            { properties: { path: ['periodEnd'], lte: endIso } },
          ],
        };

    const rows = await this.prisma.block.findMany({
      where,
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
    const workspaceIds = await this.getActiveWorkspaces(periodType, startDate, endDate);

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

  // Sunday, after the daily has run. The previous window ran on Sunday at 20:00
  // over startOf('week').add(1,'day') → endOf('week').add(1,'day'), which with
  // dayjs' Sunday-based week resolves to the Monday–Sunday that has not happened
  // yet: every weekly summary was generated over an empty future week.
  @Cron('30 23 * * 0')
  async handleWeeklySummary() {
    const prefs = await this.getUserPreferences();
    if (!prefs.autoWeekly) return;

    this.logger.log('Weekly Summary Triggered (Config-aware)');
    const start = dayjs().subtract(6, 'day').startOf('day').toISOString();
    const end = dayjs().endOf('day').toISOString();
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

  // Staggered after the monthly, and the yearly after both: each level reads
  // what the level it depends on has already written, and running them in the
  // same minute is a race.
  @Cron('0 19 1 1,4,7,10 *')
  async handleTrimesterSummary() {
    const prefs = await this.getUserPreferences();
    if (!prefs.autoTrimester) return;

    const start = dayjs().subtract(3, 'months').startOf('month').toISOString();
    const end = dayjs().subtract(1, 'month').endOf('month').toISOString();
    await this.generateForActiveWorkspaces('trimester', start, end);
  }

  @Cron('0 20 1 1 *')
  async handleYearlySummary() {
    const prefs = await this.getUserPreferences();
    if (!prefs.autoYearly) return;

    const start = dayjs().subtract(1, 'year').startOf('year').toISOString();
    const end = dayjs().subtract(1, 'year').endOf('year').toISOString();
    await this.generateForActiveWorkspaces('yearly', start, end);
  }
}
