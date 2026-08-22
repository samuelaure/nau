import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { getClientForFeature } from '@nau/llm-client';
import { signServiceToken } from '@nau/auth';
import { z } from 'zod';
import { BlocksService } from '../blocks/blocks.service';
import axios from 'axios';
import { ActivityService } from './activity.service';
import {
  dayjs,
  dayIn,
  localNow,
  closedPeriodBounds,
  safeZone,
  type PeriodBounds,
  type PeriodType,
} from '../common/time';

const JournalSummarySchema = z.object({
  synthesis: z.string().describe('What the period meant: recurring themes, how the mood moved, what it was really about. Interpretation of the record, never beyond it.'),
  summary: z.string().describe('What happened: events, decisions, work, people, places. First person, plain, factual.'),
  highlights: z.array(z.string()).describe('The few things worth remembering, one short line each. Empty if the record does not support any.'),
});

type JournalSummaryOutput = z.infer<typeof JournalSummarySchema>;

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
    private readonly activity: ActivityService,
  ) {}

  /**
   * The zone a workspace's periods are lived in.
   *
   * Summaries are workspace-scoped artefacts, so the boundary has to be a
   * property of the workspace rather than of whoever happens to trigger the run.
   * Workspace.timezone is seeded from the owner's own timezone.
   */
  private async getWorkspaceTimezone(workspaceId: string): Promise<string> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { timezone: true },
    });
    return safeZone(ws?.timezone);
  }

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

  /**
   * Public entry point: a period named by two date strings.
   *
   * The strings name calendar days, and a calendar day only becomes an instant
   * once you know where it is being lived. They are resolved in the workspace's
   * own zone — the same boundary the scheduled runs use, so a summary asked for
   * by hand covers exactly the period the cron would have generated.
   */
  async generateSummary(
    periodType: PeriodType,
    startDateStr: string,
    endDateStr: string,
    workspaceId: string,
  ) {
    const tz = await this.getWorkspaceTimezone(workspaceId);
    const start = dayIn(startDateStr, tz).startOf('day');
    const end = dayIn(endDateStr, tz).endOf('day');

    return this.generateForBounds(periodType, workspaceId, tz, {
      start: start.toDate(),
      end: end.toDate(),
      label: start.isSame(end, 'day')
        ? start.format('D [de] MMMM [de] YYYY')
        : `${start.format('D [de] MMMM')} al ${end.format('D [de] MMMM [de] YYYY')}`,
    });
  }

  private async generateForBounds(
    periodType: PeriodType,
    workspaceId: string,
    tz: string,
    bounds: PeriodBounds,
  ) {
    const { start: startDate, end: endDate } = bounds;
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

    // What the system observed the author doing, as written by ActivityService.
    //
    // Fetched separately from the entries and never merged with them: an entry
    // is what the author chose to say, an activity block is what the system saw
    // them do. The prompt is told which is which, because otherwise "created
    // four tasks" gets weighed like a reflection about someone's daughter.
    const activityBlocks = source === 'entries'
      ? await this.prisma.block.findMany({
          where: {
            workspaceId,
            type: 'journal_activity',
            deletedAt: null,
            AND: [
              { properties: { path: ['date'], gte: startIso } },
              { properties: { path: ['date'], lte: endIso } },
            ],
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

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
      ? journalEntries.length > 0 ||
        activityBlocks.length > 0 ||
        actionBlocks.length > 0 ||
        contentIdeas.length > 0
      : sourceSummaries.length > 0;

    if (!hasInput) {
      this.logger.log(`No ${source} input for ${periodType} in workspace ${workspaceId}. Skipping.`);
      return { success: true, skipped: true, reason: 'no input' };
    }

    // Format the input for the model
    let contextText = '';

    if (source === 'entries') {
      if (journalEntries.length > 0) {
        contextText += '## ENTRADAS DEL DIARIO — lo que la persona escribió o dictó\n';
        journalEntries.forEach(entry => {
          const text = this.entryText(entry);
          if (!text) return;
          const at = (entry.properties as any)?.date ?? entry.createdAt;
          contextText += `\n### ${dayjs(at).tz(tz).format('YYYY-MM-DD HH:mm')}\n${text}\n`;
        });
      }

      if (activityBlocks.length > 0) {
        contextText += '\n## ACTIVIDAD REGISTRADA — lo que el sistema observó, no lo que la persona dijo\n';
        activityBlocks.forEach(block => {
          const at = (block.properties as any)?.date ?? block.createdAt;
          contextText += `\n### ${dayjs(at).tz(tz).format('YYYY-MM-DD')}\n${this.entryText(block)}\n`;
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
              content: `Estás escribiendo el resumen ${PERIOD_LABEL[periodType].toLowerCase()} del diario personal de alguien, que cubre ${bounds.label}.

Recibes ${source === 'entries' ? 'las entradas que esa persona escribió o dictó durante el periodo, tal cual las dejó' : `los resúmenes ${source} que ya cubren este periodo`}. Eso es todo el registro que existe. No hay más.
${activityBlocks.length > 0 ? `
Parte de lo que recibes viene marcado como ACTIVIDAD REGISTRADA. Eso no lo dijo la persona: es lo que el sistema observó que hizo — tareas creadas o completadas, ideas capturadas, cosas agendadas. Trátalo como contexto de apoyo, no como voz propia. Lo que la persona dijo pesa más que lo que hizo: si las dos fuentes hablan de lo mismo, manda la entrada; si la actividad menciona algo que la persona no comentó, puedes recogerlo como hecho, nunca atribuirle intención ni sentimiento.
` : ''}

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
        activityCount: activityBlocks.length,
        timezone: tz,
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
        finalDeliveryText += `• _${dayjs(at).tz(tz).format('HH:mm')}_: ${this.entryText(e)}\n`;
      });
    }

    // 8. Notify Zazu (if configured)
    const zazuUrl = process.env.ZAZU_INTERNAL_URL || 'http://zazu:3000';

    const periodTitle = PERIOD_LABEL[periodType];

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
             periodTitle: `Resumen ${periodTitle} — ${bounds.label}`,
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

  /** naŭ user ids of every member of a workspace, for proactive delivery. */
  private async getWorkspaceRecipients(workspaceId: string): Promise<string[]> {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  /**
   * One tick an hour, which decides per workspace what is due in its own zone.
   *
   * There used to be five crons, each firing at a fixed UTC hour for everyone.
   * That cannot be right once a day belongs to a place: 23:00 UTC is one in the
   * morning in Madrid, so the "daily" summary closed a day that still had two
   * hours to run, and the two hours it did include belonged to the day before.
   *
   * An hourly tick asks each workspace what time it is there, and acts when the
   * local clock says so. Every generator is idempotent on the period it covers,
   * so a repeated hour — which is exactly what happens when the clocks go back —
   * is skipped rather than duplicated.
   */
  @Cron('0 * * * *')
  async handleScheduledSummaries() {
    const prefs = await this.getUserPreferences();

    const workspaces = await this.prisma.workspace.findMany({
      select: { id: true, timezone: true },
    });
    const now = new Date();

    for (const ws of workspaces) {
      const tz = safeZone(ws.timezone);
      const local = localNow(tz, now);

      try {
        // 23:00 local closes the day. Order matters and is the whole point of
        // doing these together: the activity block is written first so the daily
        // can read it, and the weekly runs after the daily rather than racing it.
        if (local.hour() === 23) {
          await this.activity.generateForDay(ws.id, tz, now);

          if (prefs.autoDaily) {
            await this.runPeriod('daily', ws.id, tz, now);
          }
          // isoWeekday 7 is Sunday: the last day of the week that is ending.
          if (prefs.autoWeekly && local.isoWeekday() === 7) {
            await this.runPeriod('weekly', ws.id, tz, now);
          }
        }

        // The larger periods run early on the first local day, staggered so each
        // reads what the level it depends on has already written.
        if (local.date() === 1) {
          if (prefs.autoMonthly && local.hour() === 1) {
            await this.runPeriod('monthly', ws.id, tz, now);
          }
          if (prefs.autoTrimester && local.hour() === 2 && local.month() % 3 === 0) {
            await this.runPeriod('trimester', ws.id, tz, now);
          }
          if (prefs.autoYearly && local.hour() === 3 && local.month() === 0) {
            await this.runPeriod('yearly', ws.id, tz, now);
          }
        }
      } catch (err: any) {
        // One workspace's failure must not stop the tick for the rest.
        this.logger.error(`Scheduled journal run failed for workspace ${ws.id}: ${err.message}`);
      }
    }
  }

  /** The period that has just closed in this workspace's zone. */
  private async runPeriod(periodType: PeriodType, workspaceId: string, tz: string, now: Date) {
    const bounds = closedPeriodBounds(periodType, tz, now);
    this.logger.log(`${periodType} for workspace ${workspaceId} — ${bounds.label} (${tz})`);
    return this.generateForBounds(periodType, workspaceId, tz, bounds);
  }
}
