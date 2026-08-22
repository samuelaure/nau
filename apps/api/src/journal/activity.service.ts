import { Injectable, Logger } from '@nestjs/common';
import { getClientForFeature } from '@nau/llm-client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { dayjs, periodBounds, safeZone } from '../common/time';

const NarrationSchema = z.object({
  narration: z.string().describe(
    'The same timeline, rendered as chronological prose in the first person. Adds no fact not present in the input.',
  ),
});

/**
 * Block types whose activity is worth telling.
 *
 * Deliberately an allowlist. "Anything I touched today" would be dominated by
 * bulk writes — a single mobile sync creates hundreds of capture blocks — and a
 * day narrated as "you imported 968 posts" is not a day. Anything outside this
 * list is counted at the end instead, which keeps the volume visible without
 * letting it drown the record.
 */
const NARRATED_TYPES = new Set([
  'action',
  'project',
  'habit',
  'appointment',
  'someday_maybe',
  'reference',
  'content_idea',
]);

/**
 * Never narrated, at any volume: these are the journal itself. Feeding them back
 * in would make the day's activity include the day's activity.
 */
const EXCLUDED_TYPES = new Set(['journal_entry', 'journal_summary', 'journal_activity']);

const TYPE_LABEL: Record<string, string> = {
  action: 'Tarea',
  project: 'Proyecto',
  habit: 'Hábito',
  appointment: 'Cita',
  someday_maybe: 'Algún día',
  reference: 'Referencia',
  content_idea: 'Idea de contenido',
};

const EVENT_LABEL: Record<string, string> = {
  'block.created': 'creada',
  'block.updated': 'editada',
  'block.status_changed': 'cambió de estado',
  'block.completed': 'completada',
  'block.reopened': 'reabierta',
  'block.scheduled': 'agendada',
  'block.deleted': 'eliminada',
  'block.tagged': 'etiquetada',
  'block.untagged': 'desetiquetada',
};

export interface DayActivity {
  /** The rendered timeline. Produced without a model; always trustworthy. */
  timeline: string;
  /** How many narrated events the day held. Zero means there is nothing to say. */
  factCount: number;
  /** Bulk activity, summarised as counts by block type. */
  counted: Record<string, number>;
}

/**
 * Turns a day's recorded activity into an entry for the journal.
 *
 * The journal holds two kinds of thing. Direct entries are what the author chose
 * to write or say. Indirect activity is what they did — tasks created and
 * finished, ideas captured, things scheduled — which is just as much a record of
 * the day, and on days with no direct entry it is the only record there is.
 *
 * The timeline is built by code, not by a model. The events already carry times
 * and subjects, so rendering them is a mechanical transformation with nothing to
 * interpret — and every bit of interpretation allowed at this stage is a bit of
 * invention risk. The model's only job is to turn that timeline into prose;
 * interpreting the day is the daily summary's job, and it gets both this and the
 * author's own words to do it with.
 */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: BlocksService,
  ) {}

  /**
   * The day's activity as rendered facts.
   *
   * Reads the Event log rather than the blocks' current state: a block says what
   * is true now, never when it became true.
   */
  async buildDay(workspaceId: string, tz: string, ref: Date): Promise<DayActivity> {
    const { start, end, label } = periodBounds('daily', tz, ref);
    const zone = safeZone(tz);

    const events = await this.prisma.event.findMany({
      where: { workspaceId, createdAt: { gte: start, lte: end } },
      include: { block: true },
      orderBy: { createdAt: 'asc' },
    });

    const counted: Record<string, number> = {};
    const lines: string[] = [];

    for (const ev of events) {
      const blockType = ev.block?.type;
      if (!blockType || EXCLUDED_TYPES.has(blockType)) continue;

      if (!NARRATED_TYPES.has(blockType)) {
        counted[blockType] = (counted[blockType] ?? 0) + 1;
        continue;
      }

      const props = (ev.block.properties ?? {}) as Record<string, unknown>;
      const title = (props.text as string) || (props.name as string) || 'sin título';
      const at = dayjs(ev.createdAt).tz(zone).format('HH:mm');
      const what = EVENT_LABEL[ev.type] ?? ev.type;

      const detail: string[] = [];
      const meta = (ev.metadata ?? {}) as Record<string, unknown>;
      if (props.priority) detail.push(`prioridad ${props.priority}`);
      if (props.deadline) detail.push(`vence ${props.deadline}`);
      if (props.brandName) detail.push(`marca ${props.brandName}`);
      if (meta.from || meta.to) detail.push(`de "${meta.from ?? '—'}" a "${meta.to ?? '—'}"`);
      if (meta.tagName) detail.push(`etiqueta ${meta.tagName}`);

      lines.push(
        `- ${at} · ${TYPE_LABEL[blockType] ?? blockType} ${what}: "${title}"` +
          (detail.length ? ` (${detail.join(', ')})` : ''),
      );
    }

    let timeline = '';
    if (lines.length > 0) {
      timeline = `Actividad registrada el ${label} (zona ${zone}):\n${lines.join('\n')}`;
    }

    const countedLines = Object.entries(counted).map(([t, n]) => `- ${n} registros de tipo ${t}`);
    if (countedLines.length > 0) {
      timeline += `${timeline ? '\n\n' : ''}Otros registros del día, sin detallar:\n${countedLines.join('\n')}`;
    }

    return { timeline, factCount: lines.length, counted };
  }

  /**
   * Writes the day's activity into the journal as its own block.
   *
   * Deliberately NOT a `journal_entry`. An entry is something the author wrote;
   * this is something the system observed. Storing it as an entry would make the
   * two indistinguishable when reading the journal back years later, and would
   * quietly feed a generated block into every place that reads entries.
   */
  async generateForDay(workspaceId: string, tz: string, ref: Date) {
    const { start, end, label } = periodBounds('daily', tz, ref);
    const activity = await this.buildDay(workspaceId, tz, ref);

    if (activity.factCount === 0) {
      this.logger.log(`No narratable activity for ${label} in workspace ${workspaceId}.`);
      return { success: true, skipped: true as const, reason: 'no activity' };
    }

    const existing = await this.prisma.block.findFirst({
      where: {
        type: 'journal_activity',
        workspaceId,
        deletedAt: null,
        AND: [
          { properties: { path: ['periodStart'], equals: start.toISOString() } },
          { properties: { path: ['periodEnd'], equals: end.toISOString() } },
        ],
      },
    });

    if (existing) {
      this.logger.log(`Activity block for ${label} already exists (${existing.id}).`);
      return { success: true, blockId: existing.id, cached: true as const };
    }

    // The deterministic timeline is the fallback, not a degraded mode: it holds
    // every fact the prose would have held. A model outage costs polish, never
    // the record.
    let narration = activity.timeline;

    try {
      const { client, model } = getClientForFeature('journal_activity');
      const result = await client.parseCompletion({
        model,
        temperature: 0.2,
        schema: NarrationSchema as never,
        schemaName: 'ActivityNarration',
        messages: [
          {
            role: 'system',
            content: `Recibes la lista de cosas que una persona registró en su sistema durante un día, con la hora de cada una. Ya está ordenada cronológicamente.

Tu única tarea es contarla como prosa continua, en primera persona y en pasado, siguiendo el mismo orden.

No es un resumen y no es una interpretación:
- No añadas ni un solo hecho que no esté en la lista.
- No infieras el motivo, el estado de ánimo ni la importancia de nada. Si la lista dice que completaste una tarea, escribe que la completaste; no escribas que te sentiste productivo.
- No saques conclusiones sobre cómo fue el día.
- No omitas nada de la lista.

Menciona las horas cuando ayuden a seguir el hilo, sin repetirlas todas. Escribe en español, con naturalidad y sin adornos.`,
          },
          { role: 'user', content: activity.timeline },
        ],
      });
      const text = (result.data as { narration?: string })?.narration;
      if (text && text.trim()) narration = text.trim();
    } catch (err) {
      this.logger.warn(`Narration unavailable for ${label}, storing the timeline: ${String(err)}`);
    }

    const block = await this.blocks.createInternal({
      type: 'journal_activity',
      workspaceId,
      properties: {
        summary: narration,
        // The facts the prose was made from. Same contract as a journal entry:
        // whatever a model produced, the thing it was made from is kept.
        raw: activity.timeline,
        // End of the local day, so it sorts after everything the author wrote —
        // it is the last unit of the day, closing it.
        date: end.toISOString(),
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        source: 'activity_synthesis',
        factCount: activity.factCount,
        counted: activity.counted,
        status: 'published',
      },
    });

    return { success: true, blockId: block.id, factCount: activity.factCount };
  }
}
