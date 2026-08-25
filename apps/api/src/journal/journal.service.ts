import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { getClientForFeature } from '@nau/llm-client';
import { signServiceToken } from '@nau/auth';
import { z } from 'zod';
import { BlocksService } from '../blocks/blocks.service';
import axios from 'axios';
import {
  dayjs,
  dayIn,
  localNow,
  closedPeriodBounds,
  safeZone,
  type PeriodBounds,
  type PeriodType,
} from '../common/time';

/**
 * What a period's derived entry holds.
 *
 * `synthesis` is the piece that matters and the reason this is not called a
 * summary. The captures of one day arrive scattered — a note at 14:25, another
 * at 20:55, each written without knowledge of the others — and what is missing
 * is not brevity but continuity. This field is the day told as one continuous
 * experience, at the length the day deserves rather than compressed.
 *
 * `summary` stays as the short orienting line a list needs to show something
 * next to a date. It is deliberately secondary: nothing reads it to understand
 * the day, only to label it.
 */
const JournalSummarySchema = z.object({
  synthesis: z.string().describe('The period lived as one continuous experience, in the order it happened, weighted by what mattered to the person. Not compressed — this is the piece someone reads to recognise their own day.'),
  summary: z.string().describe('One or two lines, enough to tell this period apart from another in a list. An orienting label, not a retelling.'),
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

    // A correction made by hand outranks the original capture. If the person
    // opened the entry and fixed it, that is the most authoritative version of
    // what they meant — more so than a transcription of what a microphone heard.
    // `raw` still holds the original either way, so nothing is lost.
    if (p?.editedAt) return (p.summary as string) || '';

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

  /**
   * @param deliver Whether to push the result to Zazŭ immediately once written.
   *   False for the scheduled run, which writes the summary the moment its day
   *   closes at local midnight but holds delivery for the 06:00 tick — nobody
   *   wants a Telegram message at 00:00. True for anything triggered by a
   *   person asking for a summary directly, who is by definition awake to read it.
   */
  private async generateForBounds(
    periodType: PeriodType,
    workspaceId: string,
    tz: string,
    bounds: PeriodBounds,
    deliver = true,
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

    // Nothing else is read. Recorded activity, tasks and inbox captures used to
    // be pulled in here as supporting context, and the result was a diary that
    // opened by telling its author they had created two tasks named "sin
    // título" — the system's own noise, in the place where a person's life was
    // supposed to be. What someone lived is what they said they lived. If a day
    // holds no entries, it produces no interpretation, which is the honest
    // answer rather than a paragraph assembled from event rows.

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
      ? journalEntries.length > 0
      : sourceSummaries.length > 0;

    if (!hasInput) {
      this.logger.log(`No ${source} input for ${periodType} in workspace ${workspaceId}. Skipping.`);
      return { success: true, skipped: true, reason: 'no input' };
    }

    // Format the input for the model
    let contextText = '';

    if (source === 'entries') {
      contextText += '## EXPERIENCIAS CAPTURADAS\n';
      journalEntries.forEach(entry => {
        const text = this.entryText(entry);
        if (!text) return;
        const at = (entry.properties as any)?.date ?? entry.createdAt;
        contextText += `\n### ${dayjs(at).tz(tz).format('YYYY-MM-DD HH:mm')}\n${text}\n`;
      });
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
              content: `Estás escribiendo la entrada ${PERIOD_LABEL[periodType].toLowerCase()} del diario de alguien: ${bounds.label}.

Recibes ${source === 'entries' ? 'las experiencias que esa persona capturó a lo largo del periodo, en el orden en que las vivió' : `las entradas ${source} que ya cubren este periodo`}. Eso es todo el registro que existe. No hay más, y no hace falta más.

Esto NO es un resumen. No estás condensando ni recortando. Las capturas llegaron sueltas — una a media tarde, otra de noche, cada una escrita sin saber de las demás — y tu trabajo es devolverlas como UNA sola experiencia continua. Homogeneizar, no comprimir: lo que estaba disperso queda unido, lo que se repite a lo largo del día se reconoce como una misma cosa, y lo que la persona vivió con más peso ocupa más espacio.

Devuelve tres cosas:

1. "synthesis" — el periodo entero, contado como una sola experiencia continua.

   Sigue el orden en que ocurrió. Deja que cada experiencia ocupe el espacio que merece según lo que pesó para la persona: algo que atravesó el día entero se cuenta con detalle; algo mencionado de paso se menciona de paso. No inventes transiciones suaves entre cosas que no tienen relación — si el día saltó de un tema a otro sin conexión, el salto es parte de cómo fue el día.

   Escribe en primera persona, con las palabras de la persona siempre que sea posible. Si dijo "me siento dormido, dejado", eso se queda; no lo conviertas en "experimenté una sensación de letargo". Conserva los nombres propios, las cifras, los lugares, las frases que sólo usaría esta persona. Esa es la diferencia entre releerse y leer a un desconocido.

   Es la pieza principal. Debe poder leerse sola y que la persona se reconozca en ella.

2. "summary" — una o dos líneas para distinguir este periodo de otro en una lista. Una etiqueta para orientarse, no un recuento.

3. "highlights" — lo poco que merece recordarse, una línea corta cada uno. Lista vacía si el registro no da para ninguno.

REGLA ABSOLUTA — nada de lo que escribas puede no estar en el registro. No infieras acontecimientos, emociones ni detalles que no aparezcan. Si el registro es escaso, escribe poco. Una entrada breve y fiel es correcta; una entrada rica e inventada es un recuerdo falso, y esto es el registro que esta persona tiene de su propia vida.

No opines sobre lo que la persona vivió. No añadas consejos, ánimos, moralejas ni conclusiones a las que no haya llegado ella misma. No juzgues sus decisiones ni celebres sus logros — no eres un observador, eres su propia voz ordenando el día. No adornes y no uses lenguaje grandilocuente.

Escribe en el mismo idioma del registro.`
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

    // 5. Format the delivery message before saving, so it can be stored
    // verbatim on the block rather than reconstructed later for a delayed or
    // retried delivery.
    // The interpretation, and nothing else. It is written to be read on its
    // own, so a stats line about tasks and ideas would sit oddly under it —
    // those modules no longer feed this and should not decorate it either.
    //
    // The entries are also no longer appended verbatim. That is what they were
    // read from, and repeating them under their own interpretation both undoes
    // the point of homogenising them and made one delivery 15,669 characters
    // long — four times what Telegram accepts.
    const finalDeliveryText = aiResult.synthesis;

    // 6. Save as Block
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
        // What this entry was actually built from, recorded on the entry
        // itself. Without it there is no way to tell later whether a given
        // entry predates this hierarchy.
        sourceType: source,
        sourceCount: source === 'entries' ? journalEntries.length : sourceSummaries.length,
        timezone: tz,
        // False only for a scheduled run holding delivery for the 06:00 tick.
        // Everything else — a person asking for a summary directly, or a
        // period Zazŭ never auto-delivers — has nothing pending, so it starts
        // true. `deliverPending` is the only thing that flips it afterwards,
        // so a delivery that failed there is visible and retried on the next
        // tick rather than silently lost.
        delivered: deliver || periodType === 'custom',
        // The exact message a delivery sends, stored so a delayed or retried
        // delivery reproduces it byte for byte rather than reconstructing an
        // approximation from the other properties.
        deliveryText: finalDeliveryText,
        periodLabel: bounds.label,
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

    // 7. Deliver, unless this is a scheduled run holding it for the 06:00 tick —
    // `delivered` was already written true above in every case that reaches here.
    if (deliver && periodType !== 'custom') {
      await this.notifyZazu(newSummaryBlock.id, workspaceId, periodType, bounds.label, finalDeliveryText);
    }

    return {
      success: true,
      blockId: newSummaryBlock.id,
      data: newSummaryBlock,
      summaryData: finalDeliveryText
    };
  }

  /** Pushes one already-written summary to every member of its workspace via Zazŭ. */
  private async notifyZazu(
    blockId: string,
    workspaceId: string,
    periodType: PeriodType,
    periodLabel: string,
    deliveryText: string,
  ) {
    const zazuUrl = process.env.ZAZU_INTERNAL_URL || 'http://zazu:3000';
    const periodTitle = PERIOD_LABEL[periodType];
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
          periodTitle: `Resumen ${periodTitle} — ${periodLabel}`,
          summaryData: deliveryText,
        }, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        });
      } catch (err: any) {
        this.logger.error(`Failed to notify Zazŭ for ${nauUserId} (summary ${blockId}): ${err.message}`);
      }
    }
  }

  /**
   * Sends every summary generated but not yet pushed, for one workspace.
   *
   * Split from generation so a summary can be written the moment its period
   * closes — at local midnight, so nothing captured right up to 23:59 is
   * missed — while the Telegram message waits for a decent hour. Matched by
   * `delivered: false` rather than by time window, so a delivery that failed
   * once is retried on the next tick instead of lost.
   */
  private async deliverPending(workspaceId: string) {
    const pending = await this.prisma.block.findMany({
      where: {
        type: 'journal_summary',
        workspaceId,
        deletedAt: null,
        properties: { path: ['delivered'], equals: false },
      },
    });

    for (const block of pending) {
      const props = block.properties as Record<string, unknown>;
      const periodType = props.periodType as PeriodType;

      await this.notifyZazu(
        block.id,
        workspaceId,
        periodType,
        (props.periodLabel as string) ?? '',
        props.deliveryText as string,
      );
      await this.blocksService.updateInternal(block.id, {
        properties: { ...props, delivered: true },
      });
    }
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
   *
   * Generation and delivery are two different hours. The daily/weekly summary
   * is written right at local midnight, once the day is genuinely over — firing
   * at 23:00 instead, as this used to, closed the book on a day that still had
   * an hour left in it, so anything captured between 23:00 and 23:59 fell into
   * the next day's summary instead of this one. Delivery waits until 06:00
   * local so nobody gets a Telegram message at midnight; `deliverPending`
   * sends whatever generation left marked `delivered: false`, on a workspace
   * that may not even be the one that just generated something (a summary
   * written just before 06:00 still goes out on the same run).
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
      // The day that just closed, for generators anchored on local midnight —
      // any instant within it works, since periodBounds only reads the
      // calendar day off `ref`.
      const closedDay = local.subtract(1, 'day').toDate();

      try {
        // 00:00 local: the day that just ended is now closed and safe to read
        // in full. The weekly runs after the daily rather than racing it.
        //
        // No activity block is written any more. It narrated what the system
        // observed — tasks created, things scheduled — and nothing reads it
        // now that a period is built from captured experiences alone, so
        // generating one was an LLM call per workspace per night for an
        // artefact with no reader.
        if (local.hour() === 0) {
          if (prefs.autoDaily) {
            await this.runPeriod('daily', ws.id, tz, closedDay, false);
          }
          // isoWeekday 1 is Monday: the day that just started, so the week
          // that just closed ended on the Sunday before it.
          if (prefs.autoWeekly && local.isoWeekday() === 1) {
            await this.runPeriod('weekly', ws.id, tz, closedDay, false);
          }
        }

        // 06:00 local: send whatever the midnight run generated but held back.
        if (local.hour() === 6) {
          await this.deliverPending(ws.id);
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
  private async runPeriod(
    periodType: PeriodType,
    workspaceId: string,
    tz: string,
    now: Date,
    deliver = true,
  ) {
    const bounds = closedPeriodBounds(periodType, tz, now);
    this.logger.log(`${periodType} for workspace ${workspaceId} — ${bounds.label} (${tz})`);
    return this.generateForBounds(periodType, workspaceId, tz, bounds, deliver);
  }
}
