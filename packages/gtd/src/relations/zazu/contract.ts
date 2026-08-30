/**
 * `(GTD)·(Zazŭ)` — what Zazŭ hands to GTD's capture-and-triage path when
 * someone picks "GTD" in the in-chat form, and what GTD hands back.
 *
 * DRAFT, not yet confirmed by `module:gtd`. Published per nau#119's method:
 * written from observable evidence rather than invented, so it is cheap to
 * correct rather than a blank question. See nau#109 for the move this
 * unblocks (`apps/api/src/triage/` → `packages/gtd/src/relations/zazu/`) and
 * nau#118's `GTD_DESTINATION_HANDLERS` for the registry this hands off into.
 *
 * ## Where this comes from
 *
 * `apps/api/src/triage/triage.controller.ts`'s `TriageDto`
 * (`journalOnly: false` branch) is today's actual wire shape, built against
 * `@nau/types`' `TriageRequestDto` — the request Zazŭ already sends via
 * `dispatchToActions` in `apps/zazu/src/voicenote-skill.ts`. This draft is
 * that same shape, narrowed to what GTD's triage actually needs (no
 * `brandId` — GTD routes toward `content_idea` too per the blueprint's §6.4,
 * but brand resolution stays `module:content`'s, same as today) and
 * reframed as a call into `packages/gtd`'s capture-and-triage mechanism
 * rather than a raw HTTP body.
 *
 * ## What changes for Zazŭ, once this is live
 *
 * Nothing about *how* Zazŭ decides what to send. Per Samuel's confirmation
 * (2026-08-30, resolving nau#110): the triage-LLM receives text — never
 * voice — regardless of capture origin. Voice goes through Zazŭ's own
 * transcribe → clean pipeline first; text is sent as-is. Both origins
 * produce the same `CaptureForTriage.text`, so this contract has no
 * `origin`/`isVoice` field, deliberately — that distinction is fully
 * resolved before this boundary and GTD never needs to see it.
 *
 * What *does* change: today's endpoint (`POST /triage`, `journalOnly: false`)
 * writes `Block.type` directly via the pre-GTD classifier
 * (`triage.service.ts`'s `processRawText`/`saveTriagedBlocks`). Once this
 * relation is wired to `GtdService.capture` + the LLM-driven triage this
 * package will own, a segment becomes a `references.note` in a tray with a
 * `suggestedType` — never an immediately-final `Block.type`. Confirmation
 * (`order`) is a separate, later step a person takes, not something Zazŭ's
 * in-chat form performs on their behalf.
 */

/**
 * One capture handed to GTD for triage. `text` is always already-clean —
 * Zazŭ transcribes and cleans voice before this point; text input is passed
 * through unchanged. `sourceBlockId` is Zazŭ's own record of the capture
 * (its `Voicenote.id`, when the origin was voice) — kept for the same reason
 * `(GTD)·(Journal)`'s `OrderIntoJournal` and `(GTD)·(Actions)`'s
 * `OrderIntoActions` both keep `blockId`: a way back to where something came
 * from, never re-derived.
 */
export interface CaptureForTriage {
  readonly text: string;
  readonly userId: string;
  readonly workspaceId?: string;
  readonly sourceBlockId?: string;
  /** When the capture was made, not when this call happens to run. */
  readonly capturedAt?: string;
}

/**
 * One piece the triage extracted, pre-typed but not yet confirmed. Mirrors
 * `packages/gtd/src/relations/zazu/router.ts`'s `TriagedSegment`, which this
 * draft assumes as the shared vocabulary rather than inventing a second one
 * — `suggestedDestination` there is this file's `suggestedType`, renamed
 * here only because "destination" already means something narrower
 * (`router.ts`'s `Destination` union) than what a triage segment carries
 * before routing exists to confirm it against.
 */
export interface TriagedCapture {
  readonly noteId: string;
  readonly text: string;
  readonly suggestedType: 'actions' | 'references' | 'journal' | 'content' | null;
}

/**
 * What GTD hands back once triage runs. A capture that mixed several
 * thoughts becomes several `TriagedCapture` rows, each already a
 * `references.note` in the general tray (`GtdService.capture`,
 * `@nau/gtd`'s core) — this draft does not invent a batch-capture
 * primitive; it assumes one `CaptureForTriage` call, segmented internally,
 * producing N tray items, matching what `triage.service.ts`'s
 * `saveTriagedBlocks` already does per-segment today.
 */
export interface TriagedResult {
  readonly captures: readonly TriagedCapture[];
}
