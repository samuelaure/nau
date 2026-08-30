import { z } from 'zod';

/**
 * Journal's published contract, enforced at runtime.
 *
 * These shapes existed as TypeScript interfaces in `@nau/types`, but a TS type
 * is erased at exactly the boundary where the guarantee is needed — the write
 * to a JSON column. The code they replace cast through `unknown` on the way in
 * and out, so nothing was checked on write and nothing was guaranteed on read.
 *
 * Which fields are required, which are optional, and which are public was
 * decided by the Journal session on nau#79, checked against the production
 * census: 106 live entries, all carrying text/textOriginal/date/source/
 * originFormat; 97 carrying sourceId; 2 carrying editedAt.
 *
 * `.passthrough()` on both shapes is deliberate. `sortOrder` is stamped by the
 * substrate for every kind, so it appears in stored properties without being
 * any kind's business (nau#85). Rejecting it here would make a substrate-managed
 * key fail its owner's validation.
 */

/** Where an entry was captured. Not how — see JournalOriginFormat. */
export const JournalSourceSchema = z.enum(['zazu', 'app', 'mobile']);
export type JournalSource = z.infer<typeof JournalSourceSchema>;

/**
 * What the capture was before it became text.
 *
 * A label, not a dependency: Journal never learns what an audio key is or how
 * to play one back.
 */
export const JournalOriginFormatSchema = z.enum(['voice', 'text']);
export type JournalOriginFormat = z.infer<typeof JournalOriginFormatSchema>;

/**
 * A journal entry: one piece of text, and when it was lived.
 *
 * On `text` vs `textOriginal`, because the name invites exactly one wrong
 * reading: `textOriginal` means **before any human edit**. It is *not* the raw
 * transcription of a voice capture — that stays with whichever service did the
 * capturing and is reachable through `sourceId`, never duplicated here. The two
 * are identical at creation and diverge only when a person corrects the entry,
 * which is why only 2 of 106 rows carry `editedAt`.
 */
export const JournalEntrySchema = z
  .object({
    /** What the person reads and edits. */
    text: z.string(),
    /** The same text as it first arrived, so an edit stays reversible in meaning. */
    textOriginal: z.string(),
    /**
     * When it was lived, not when ingestion finished.
     *
     * Public: anything building a cross-module timeline needs an instant to
     * sort by, and this is the one Time already depended on before that
     * coupling was cut (nau#63).
     */
    date: z.string(),
    source: JournalSourceSchema,
    originFormat: JournalOriginFormatSchema,
    /** The capture record this came from. Opaque to Journal, and private. */
    sourceId: z.string().optional(),
    /** Set only once a person corrects the entry by hand. */
    editedAt: z.string().optional(),
  })
  .passthrough();

export type JournalEntryProperties = z.infer<typeof JournalEntrySchema>;

/** Whether a synthesis was built from entries or from smaller syntheses. */
export const SynthesisSourceKindSchema = z.enum(['entries', 'syntheses']);
export type SynthesisSourceKind = z.infer<typeof SynthesisSourceKindSchema>;

/** One thing a synthesis read, and the span it covered. */
export const SynthesisSourceRefSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
});
export type SynthesisSourceRef = z.infer<typeof SynthesisSourceRefSchema>;

/**
 * What a synthesis was built from.
 *
 * `kind` is homogeneous for the whole array: a synthesis reads entries or it
 * reads syntheses, never both.
 */
export const SynthesisSourceSchema = z.object({
  kind: SynthesisSourceKindSchema,
  ids: z.array(SynthesisSourceRefSchema),
  count: z.number(),
});

/**
 * The commands used to produce a synthesis, as templates with placeholders
 * left unresolved — what filled them is recoverable through `synthesisSource`,
 * and keeping the resolved text would copy the person's own words into a field
 * meant for auditing instructions.
 */
export const SynthesisPromptsSchema = z.object({
  synthesisPrompt: z.string(),
  reflectionPrompt: z.string(),
});

/**
 * A period, interpreted.
 *
 * On `noData` and the nullable text — the one tightening this schema makes over
 * what exists today, agreed on nau#79:
 *
 * A period with nothing in it currently stores `noData: true` with
 * `synthesis: ''`. That is a sentence about the text, when the fact is that
 * there is no account because there was nothing to account for. The empty
 * string also cannot distinguish "nothing happened" from "the model returned
 * nothing", which is a real failure mode worth being able to see.
 *
 * So the fields are nullable here. They are **not yet** required to be null,
 * because existing rows carry `''` and rejecting them would be a data change —
 * and data changes wait for the verified backup and the coordinated deploy.
 * When that lands, `emptyMeansNoData` below tightens from tolerating `''` to
 * rejecting it, and a migration normalises `''` to null on `noData` rows.
 */
export const JournalSynthesisSchema = z
  .object({
    /** Retells the span as one continuous experience. Null when noData. */
    synthesis: z.string().nullable(),
    synthesisOriginal: z.string().nullable(),
    /** Reads the synthesis back. A separate model call, deliberately. */
    reflection: z.string().nullable(),
    reflectionOriginal: z.string().nullable(),
    /** The period this belongs to. A label, not a query. */
    from: z.string(),
    to: z.string(),
    synthesisSource: SynthesisSourceSchema,
    prompts: SynthesisPromptsSchema,
    editedAt: z.string().optional(),
    /** Set when a period held nothing to read; no model was called. */
    noData: z.boolean().optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const empty = (v: string | null) => v === null || v === '';

    // A synthesis that says nothing must say why. Without this, an empty
    // account and a failed generation are the same row.
    if (!value.noData && empty(value.synthesis)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['synthesis'],
        message: 'A synthesis with no text must set noData: true',
      });
    }
  });

export type JournalSynthesisProperties = z.infer<typeof JournalSynthesisSchema>;

/** The kind ids Journal owns. Namespaced, so the owner is part of the identity. */
export const JOURNAL_ENTRY_KIND = 'journal.entry';
export const JOURNAL_SYNTHESIS_KIND = 'journal.synthesis';

/**
 * How those ids map onto the `type` values already in the database.
 *
 * The rename is a data migration (nau#68) and waits for the coordinated deploy.
 * Until then the kind id is the contract and the legacy string is what is
 * stored, with the mapping confined here.
 */
export const LEGACY_TYPE_BY_KIND: Record<string, string> = {
  [JOURNAL_ENTRY_KIND]: 'journal_entry',
  [JOURNAL_SYNTHESIS_KIND]: 'journal_synthesis',
};
