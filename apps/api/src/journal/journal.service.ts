import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ScopedPrismaService } from '../core/tenancy/scoped-prisma.service';
import { getClientForFeature, type LLMFeature } from '@nau/llm-client';
import { z } from 'zod';
import type { GenerateSynthesisDto } from '@nau/types';
import {
  buildConvertedEntry,
  buildNewEntry,
  InvalidJournalEntryError,
  type JournalEntryProperties,
  type JournalOriginFormat,
  type JournalSource,
  type JournalSynthesisProperties,
  type SynthesisSourceKind,
  type SynthesisSourceRef,
} from '@nau/journal';

/** One block Time can use as a synthesis source, with its private shape erased. */
export interface JournalSourceRow {
  readonly id: string;
  /** When it was lived (entry) or the period it covers (synthesis). */
  readonly at: Date;
  /** Character count, for estimating token cost without reading full text. */
  readonly textLength: number;
}

/**
 * Journal owns two things and nothing else: the entries a person captures, and
 * the interpretations built from them.
 *
 * It deliberately does not know what a day, a week or a quarter is. A period is
 * a decision belonging to whichever calendar the person lives in — Gregorian,
 * the nine-day naŭ calendar, an astrological transit — and that decision lives
 * in the Time module. Time resolves which entries or which smaller syntheses
 * make up a period and passes them here by id. This service reads exactly what
 * it is handed.
 *
 * The consequence worth stating: there is no date arithmetic in this file, and
 * there should never be. A query here that selects entries by date range would
 * be Journal re-deriving what a period is, which is the coupling this design
 * exists to remove.
 */

const SYNTHESIS_PLACEHOLDER = '{{SOURCES: ENTRIES OR SYNTHESES}}';
const SYNTHESIS_RESULT_PLACEHOLDER = '{{SYNTHESIS}}';

/**
 * The command that turns a period's record into one continuous account.
 *
 * Stored on every synthesis as a template, with its placeholder unresolved. The
 * content that filled it is already recoverable through `synthesisSource`, and
 * keeping the resolved text would copy the person's own words into a field kept
 * for auditing instructions.
 */
const SYNTHESIS_PROMPT = `Estás escribiendo la entrada del diario de alguien para un periodo de su vida.

Recibes el registro completo de ese periodo. Eso es todo lo que existe, y no hace falta más.

Esto NO es un resumen. No estás condensando ni recortando. Lo que recibes llegó suelto — una cosa a media tarde, otra de noche, cada una escrita sin saber de las demás — y tu trabajo es devolverlo como UNA sola experiencia continua. Homogeneizar, no comprimir: lo que estaba disperso queda unido, lo que se repite se reconoce como una misma cosa, y lo que la persona vivió con más peso ocupa más espacio.

Deja que cada experiencia ocupe el espacio que merece según lo que pesó para la persona: algo que atravesó el periodo entero se cuenta con detalle; algo mencionado de paso se menciona de paso. No inventes transiciones suaves entre cosas que no tienen relación — si el periodo saltó de un tema a otro sin conexión, el salto es parte de cómo fue.

Escribe en primera persona, con las palabras de la persona siempre que sea posible. Si dijo "me siento dormido, dejado", eso se queda; no lo conviertas en "experimenté una sensación de letargo". Conserva los nombres propios, las cifras, los lugares, las frases que sólo usaría esta persona. Esa es la diferencia entre releerse y leer a un desconocido.

REGLA ABSOLUTA — nada de lo que escribas puede no estar en el registro. No infieras acontecimientos, emociones ni detalles que no aparezcan. Si el registro es escaso, escribe poco. Una entrada breve y fiel es correcta; una entrada rica e inventada es un recuerdo falso, y esto es el registro que esta persona tiene de su propia vida.

No opines sobre lo que la persona vivió. No añadas consejos, ánimos, moralejas ni conclusiones a las que no haya llegado ella misma. No juzgues sus decisiones ni celebres sus logros — no eres un observador, eres su propia voz ordenando lo vivido. No adornes y no uses lenguaje grandilocuente. La reflexión viene después y no es tu trabajo.

Escribe en el mismo idioma del registro.

REGISTRO DEL PERIODO:
${SYNTHESIS_PLACEHOLDER}`;

/**
 * The command that reads a synthesis back.
 *
 * A separate call on purpose. Asking one model to both recount a period and
 * reflect on it produces writing that does neither well — the reflection bleeds
 * into the account and the account flattens the reflection. Splitting them lets
 * each be judged on its own terms.
 */
const REFLECTION_PROMPT = `Acabas de leer el periodo de vida de alguien, ya ordenado como una sola experiencia continua. Tu trabajo ahora es distinto: no volver a contarlo, sino leerlo.

Escribe una reflexión sobre lo que este periodo fue. Busca lo que la persona quizá no vio mientras lo vivía: patrones que se repiten, tensiones entre lo que dijo querer y lo que hizo, cosas que volvieron una y otra vez, cambios de tono a lo largo del periodo.

No resumas lo que ya está dicho. Si la reflexión sólo repite los hechos en otro orden, no sirve.

REGLA ABSOLUTA — todo lo que observes tiene que sostenerse en el registro. Puedes señalar un patrón que la persona no nombró, porque el patrón está en lo que sí escribió; no puedes atribuirle emociones, motivos ni acontecimientos que no aparecen. Si el registro no da para una observación honesta, escribe poco. Una reflexión corta y cierta vale más que una extensa e inventada.

No des consejos, no moralices, no celebres ni consueles. No eres un terapeuta ni un entrenador — eres la persona mirando su propio periodo con algo de distancia. Habla en primera persona, en el mismo idioma del registro.

SÍNTESIS DEL PERIODO:
${SYNTHESIS_RESULT_PLACEHOLDER}

REGISTRO DEL PERIODO:
${SYNTHESIS_PLACEHOLDER}`;

const SynthesisSchema = z.object({
  synthesis: z
    .string()
    .describe(
      'El periodo entero contado como una sola experiencia continua, en primera persona y con las palabras de quien lo vivió.',
    ),
});

const ReflectionSchema = z.object({
  reflection: z
    .string()
    .describe(
      'Una lectura de lo vivido: patrones, tensiones y repeticiones que el registro sostiene. Nunca un resumen de los hechos.',
    ),
});

/** How many times a model call is retried before the attempt is abandoned. */
const LLM_ATTEMPTS = 3;

@Injectable()
export class JournalService {
  private readonly logger = new Logger(JournalService.name);

  constructor(private readonly scoped: ScopedPrismaService) {}

  // ── Entries ────────────────────────────────────────────────────────────────

  /**
   * The one way a journal entry comes into being.
   *
   * Zazŭ, the web app and the mobile app all arrive here. They differ in how
   * they captured something, not in what an entry is, so they share this
   * contract rather than each assembling the block themselves — which is how
   * the two previous producers drifted into writing different fields for the
   * same thing.
   *
   * Text arrives ready to store. Cleaning a transcription belongs to whoever
   * holds the audio; by the time it is an entry, it is what the person said.
   */
  async createEntry(params: {
    text: string;
    date?: string;
    source: JournalSource;
    originFormat: JournalOriginFormat;
    workspaceId: string;
    userId?: string;
    sourceId?: string;
  }) {
    // The shape of a valid entry is `@nau/journal`'s rule, not this file's — an
    // offline capture needs the same answer without reaching this service at
    // all (nau#96). `InvalidJournalEntryError` maps onto the same HTTP failure
    // a malformed request already produced.
    const properties = this.buildEntry(() =>
      buildNewEntry({
        text: params.text,
        date: params.date,
        source: params.source,
        originFormat: params.originFormat,
        sourceId: params.sourceId,
      }),
    );

    // `forWorkspace`, not `forUser`: the caller here is always a service acting
    // on a capture already resolved to a workspace (captures, triage), not a
    // human request with membership to check. `type` stays the pre-migration
    // string — the kind id (`journal.entry`) is the contract callers name, but
    // the column keeps today's value until the vocabulary migration (nau#68).
    const client = this.scoped.forWorkspace(params.workspaceId);
    return client.block.create({
      data: {
        type: 'journal_entry',
        properties: properties as unknown as object,
        userId: params.userId ?? null,
      },
    });
  }

  /**
   * Turns a block that already exists into a journal entry.
   *
   * The GTD inbox and the journal are the same substrate: a capture that turns
   * out to be a diary entry becomes one in place, keeping its id and its
   * history. Writing a second row and pointing it at the first would leave two
   * records of one thought, and every reader would have to know which is
   * authoritative.
   */
  async convertBlockToEntry(
    blockId: string,
    params: {
      text?: string;
      date?: string;
      source: JournalSource;
      originFormat: JournalOriginFormat;
    },
  ) {
    // The block's own workspace is not known until it is read, so this one read
    // goes through the unscoped client — the same transitional path
    // `ScopedPrismaService.assertBlockAccess` documents, kept local here rather
    // than importing that method from outside the relation. Every write below
    // goes through the workspace the block actually reported.
    const block = await this.scoped.unscoped().block.findUnique({ where: { id: blockId } });
    if (!block || block.deletedAt) throw new NotFoundException(`Block ${blockId} not found`);
    if (!block.workspaceId) throw new BadRequestException(`Block ${blockId} has no workspace`);

    const existing = (block.properties ?? {}) as Record<string, unknown>;
    const properties = this.buildEntry(() =>
      buildConvertedEntry({
        existing,
        text: params.text,
        date: params.date,
        source: params.source,
        originFormat: params.originFormat,
      }),
    );

    // `sortOrder` is the substrate's concern, not Journal's rule for what an
    // entry is (nau#85) — `buildConvertedEntry` never touches it, so it is
    // carried through here, at the persistence boundary, if the block already
    // had one.
    const withSortOrder = existing.sortOrder
      ? { ...properties, sortOrder: existing.sortOrder as number }
      : properties;

    const client = this.scoped.forWorkspace(block.workspaceId);
    return client.block.update({
      where: { id: blockId },
      data: { type: 'journal_entry', properties: withSortOrder as unknown as object },
    });
  }

  /**
   * Runs a `@nau/journal` builder and translates its own error into this
   * transport's — the domain package knows nothing of HTTP, and an api caller
   * still needs a `BadRequestException` to come out of an invalid entry.
   */
  private buildEntry(build: () => JournalEntryProperties): JournalEntryProperties {
    try {
      return build();
    } catch (err) {
      if (err instanceof InvalidJournalEntryError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  // ── Synthesis ──────────────────────────────────────────────────────────────

  /**
   * Interprets a period from the sources it is given.
   *
   * `from`/`to` describe which period this belongs to; they never decide what
   * is read. `sourceIds` does, and it arrives already resolved by Time — which
   * is what keeps every calendar question on Time's side of the boundary. A
   * period whose first six days hold nothing is still that whole period, and
   * says so, because the label and the content are separate facts.
   */
  async generateSynthesis(dto: GenerateSynthesisDto) {
    const { workspaceId, from, to, sourceKind, sourceIds } = dto;

    const sources = await this.loadSources(workspaceId, sourceKind, sourceIds);

    // Nothing to read. A period nobody recorded is not a period to narrate, and
    // calling a model here is what once produced summaries of empty months
    // describing events that never happened.
    if (sources.length === 0) {
      this.logger.log(`No ${sourceKind} to read for ${from}–${to}; writing an empty synthesis.`);
      return this.saveSynthesis({
        workspaceId,
        from,
        to,
        sourceKind,
        refs: [],
        synthesis: '',
        reflection: '',
        noData: true,
      });
    }

    const record = sources.map((s) => s.text).join('\n\n');

    const synthesis = await this.callModel(
      'journal_synthesis',
      SynthesisSchema,
      'Synthesis',
      SYNTHESIS_PROMPT.replace(SYNTHESIS_PLACEHOLDER, record),
      (data) => (data as { synthesis: string }).synthesis,
    );

    // The reflection reads the synthesis, with the record still in view so it
    // can point at specifics the synthesis smoothed over.
    const reflection = await this.callModel(
      'journal_reflection',
      ReflectionSchema,
      'Reflection',
      REFLECTION_PROMPT.replace(SYNTHESIS_RESULT_PLACEHOLDER, synthesis).replace(
        SYNTHESIS_PLACEHOLDER,
        record,
      ),
      (data) => (data as { reflection: string }).reflection,
    );

    return this.saveSynthesis({
      workspaceId,
      from,
      to,
      sourceKind,
      refs: sources.map((s) => s.ref),
      synthesis,
      reflection,
    });
  }

  /**
   * Reads exactly the blocks named, and nothing else.
   *
   * Scoped to the workspace even though the ids came from a trusted service:
   * blocks hold personal journal content and are readable by id otherwise.
   *
   * A synthesis of syntheses reads only the `synthesis` field of its sources,
   * never their `reflection`. A higher period wants its own reflection written
   * from its own vantage point, not inherited from the levels below it.
   */
  // ── Contract for Time ────────────────────────────────────────────────────
  //
  // Time decides WHEN a period closed and WHAT composes its synthesis; it must
  // never learn HOW Journal stores that. These two methods are the seam: typed
  // rows in, no `properties` key crosses it. Reaching into Journal's JSON from
  // outside this file is the exact coupling nau#63 found and this exists to
  // remove — a renamed key would break Time at runtime with no compile error
  // and no failing test, because a raw SQL string is invisible to both
  // TypeScript and Prisma.

  /**
   * Journal entries lived inside an interval, ordered by when they were lived.
   *
   * `properties.date` is the moment lived, not the moment ingested — a note
   * spoken at 23:50 and transcribed at 00:05 belongs to the day it was spoken.
   * That distinction is Journal's own and stays inside this method.
   */
  async entriesIn(workspaceId: string, range: { start: Date; end: Date }): Promise<JournalSourceRow[]> {
    const client = this.scoped.forWorkspace(workspaceId);
    const blocks = await client.block.findMany({
      where: {
        type: 'journal_entry',
        deletedAt: null,
      },
    });

    return blocks
      .map((block) => {
        const props = (block.properties ?? {}) as unknown as JournalEntryProperties;
        return { id: block.id, at: new Date(props.date), textLength: (props.text ?? '').length };
      })
      .filter((row) => row.at >= range.start && row.at < range.end)
      .sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  /**
   * Real syntheses (not empty placeholders) whose period starts inside a range.
   *
   * A synthesis records only its own from/to, not which scale produced it —
   * matching that against a scale's period boundaries is Time's arithmetic, not
   * Journal's, so it stays out of this method on purpose. `noData` syntheses are
   * excluded: they hold nothing to compose a larger period from.
   */
  async synthesesStartingIn(
    workspaceId: string,
    range: { start: Date; end: Date },
  ): Promise<JournalSourceRow[]> {
    const client = this.scoped.forWorkspace(workspaceId);
    const blocks = await client.block.findMany({
      where: {
        type: 'journal_synthesis',
        deletedAt: null,
      },
    });

    return blocks
      .map((block) => {
        const props = (block.properties ?? {}) as unknown as JournalSynthesisProperties;
        return {
          id: block.id,
          at: new Date(props.from),
          textLength: (props.synthesis ?? '').length,
          noData: props.noData === true,
        };
      })
      .filter((row) => !row.noData && row.at >= range.start && row.at < range.end)
      .sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  private async loadSources(
    workspaceId: string,
    kind: SynthesisSourceKind,
    ids: string[],
  ): Promise<Array<{ ref: SynthesisSourceRef; text: string }>> {
    if (!ids?.length) return [];

    const type = kind === 'entries' ? 'journal_entry' : 'journal_synthesis';
    const client = this.scoped.forWorkspace(workspaceId);
    const blocks = await client.block.findMany({
      where: { id: { in: ids }, type, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    return blocks
      .map((block) => {
        const props = (block.properties ?? {}) as Record<string, unknown>;

        if (kind === 'entries') {
          const date = (props.date as string) ?? block.createdAt.toISOString();
          return {
            ref: { id: block.id, from: date, to: date },
            text: (props.text as string) ?? '',
          };
        }

        return {
          ref: {
            id: block.id,
            from: (props.from as string) ?? '',
            to: (props.to as string) ?? '',
          },
          text: (props.synthesis as string) ?? '',
        };
      })
      .filter((s) => s.text.trim().length > 0);
  }

  /**
   * A model call that either succeeds or says so.
   *
   * Retried because a provider hiccup should not cost a period its
   * interpretation. Not swallowed into a placeholder string, which is what the
   * previous implementation did — a synthesis reading "Resumen no disponible"
   * looks like content to every reader downstream and is indistinguishable from
   * a real one until someone opens it.
   */
  private async callModel<T>(
    feature: LLMFeature,
    schema: z.ZodType<T>,
    schemaName: string,
    prompt: string,
    extract: (data: unknown) => string,
  ): Promise<string> {
    const { client, model } = getClientForFeature(feature);
    if (!client) throw new Error('No LLM client configured for journal synthesis');

    let lastError: unknown;

    for (let attempt = 1; attempt <= LLM_ATTEMPTS; attempt += 1) {
      try {
        const result = await client.parseCompletion({
          model,
          temperature: 0.2,
          schema: schema as never,
          schemaName,
          messages: [{ role: 'user', content: prompt }],
        });
        const text = extract(result.data);
        if (text?.trim()) return text;
        lastError = new Error(`${schemaName} came back empty`);
      } catch (err) {
        lastError = err;
        this.logger.warn(`${schemaName} attempt ${attempt}/${LLM_ATTEMPTS} failed: ${String(err)}`);
      }
    }

    throw new Error(`${schemaName} failed after ${LLM_ATTEMPTS} attempts: ${String(lastError)}`);
  }

  /**
   * Writes the synthesis, recording what produced it.
   *
   * `synthesisSource` names every source with the span it covered, so the
   * provenance of a synthesis is readable without fetching each one. The
   * prompts are stored as templates: what filled their placeholders is already
   * recoverable from the sources, and storing the resolved text would copy the
   * person's words into a field kept for auditing instructions.
   */
  private async saveSynthesis(params: {
    workspaceId: string;
    from: string;
    to: string;
    sourceKind: SynthesisSourceKind;
    refs: SynthesisSourceRef[];
    synthesis: string;
    reflection: string;
    noData?: boolean;
  }) {
    const properties: JournalSynthesisProperties = {
      synthesis: params.synthesis,
      synthesisOriginal: params.synthesis,
      reflection: params.reflection,
      reflectionOriginal: params.reflection,
      from: params.from,
      to: params.to,
      synthesisSource: {
        kind: params.sourceKind,
        ids: params.refs,
        count: params.refs.length,
      },
      prompts: {
        synthesisPrompt: SYNTHESIS_PROMPT,
        reflectionPrompt: REFLECTION_PROMPT,
      },
      ...(params.noData ? { noData: true } : {}),
    };

    const client = this.scoped.forWorkspace(params.workspaceId);
    const block = await client.block.create({
      data: {
        type: 'journal_synthesis',
        properties: properties as unknown as object,
      },
    });

    return { success: true, blockId: block.id, data: block };
  }
}
