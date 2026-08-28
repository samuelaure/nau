-- A journal entry becomes one piece of text and when it was lived.
--
-- Until now an entry carried two forms of itself — `raw`, the transcription as
-- it arrived, and `summary`, that same text with the disfluencies removed —
-- plus a `text` field predating both. Three fields for one idea, and every
-- reader had to know which to prefer.
--
-- Only voice notes ever had two forms. Typed text was written once and stored
-- once, so the pair was never a property of an entry at all; it was an artefact
-- of one capture pipeline leaking into the shape of everything else. What Journal
-- keeps is the text a person reads, and the version it had before they edited it.
-- The untouched transcription stays with whoever captured it, reachable through
-- `sourceId`.
--
-- Field by field:
--   summary | text | raw  ->  text          (the readable version, preferring an
--                                            edit over the original capture)
--   summary | text | raw  ->  textOriginal  (what it was before any human edit)
--   sourceBlockId         ->  sourceId      (not necessarily a block)
--   source                ->  source        (normalised to zazu|app|mobile)
--   (derived)             ->  originFormat  (voice|text — a label, not a handle)
--   status                ->  dropped       (see below)
--   audioKey              ->  dropped       (no row has ever carried one)

-- 1. Entries with real content.
--
-- `text` takes the edited version when the person corrected the entry by hand —
-- a deliberate correction outranks a transcription of what a microphone heard.
-- `textOriginal` always takes the capture, so the edit stays reversible in
-- meaning even though `raw` as a field is going away.
UPDATE "Block"
SET properties =
  (properties - 'raw' - 'summary' - 'status' - 'audioKey' - 'sourceBlockId')
  || jsonb_build_object(
       'text', COALESCE(
         NULLIF(properties->>'summary', ''),
         NULLIF(properties->>'text', ''),
         NULLIF(properties->>'raw', ''),
         ''
       ),
       'textOriginal', COALESCE(
         NULLIF(properties->>'raw', ''),
         NULLIF(properties->>'summary', ''),
         NULLIF(properties->>'text', ''),
         ''
       ),
       -- Every capture that recorded a source came from Zazŭ's voice pipeline.
       -- Rows with no source at all were written by the web app's own entry box.
       'source', CASE
         WHEN properties->>'source' LIKE 'zazu%' THEN 'zazu'
         WHEN properties->>'source' LIKE 'web%'  THEN 'app'
         ELSE 'app'
       END,
       'originFormat', CASE
         WHEN properties->>'source' LIKE '%voice%' THEN 'voice'
         ELSE 'text'
       END
     )
  || CASE
       WHEN properties ? 'sourceBlockId'
       THEN jsonb_build_object('sourceId', properties->>'sourceBlockId')
       ELSE '{}'::jsonb
     END
WHERE type = 'journal_entry';

-- 2. The `experience` type is retired.
--
-- It and `journal_entry` were two names for one concept, and the normalisation
-- kept the one that is actually written — by Zazŭ, by the web capture, by the
-- voice pipeline. The six rows carrying this type were all created in a single
-- session by an empty-row bug in the dashboard's "click to add an entry"
-- affordance: every one of them holds `text: ""` and nothing else.
--
-- They are soft-deleted rather than converted. Converting them would put six
-- blank entries in the journal, and soft-deletion is reversible if that reading
-- of them turns out to be wrong.
UPDATE "Block"
SET "deletedAt" = NOW()
WHERE type = 'experience'
  AND "deletedAt" IS NULL;

-- 3. Recorded activity is retired.
--
-- These narrated what the system observed about itself — "Tarea creada: sin
-- título" — in the place where a person's life was supposed to be. Nothing has
-- written one since the journal became an interpretation of captured experience
-- alone, and nothing reads them now.
UPDATE "Block"
SET "deletedAt" = NOW()
WHERE type = 'journal_activity'
  AND "deletedAt" IS NULL;

-- 4. Empty entries left behind by the same dashboard bug.
--
-- Same cause as the `experience` rows above, only landing on the type that
-- survived. An entry with no text is not a record of anything.
UPDATE "Block"
SET "deletedAt" = NOW()
WHERE type = 'journal_entry'
  AND "deletedAt" IS NULL
  AND COALESCE(properties->>'text', '') = '';
