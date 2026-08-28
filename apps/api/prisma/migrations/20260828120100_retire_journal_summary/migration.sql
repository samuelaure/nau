-- `journal_summary` is retired in favour of `journal_synthesis`.
--
-- The new shape is not a rename. A synthesis now holds two pieces of writing
-- produced by two separate model calls — `synthesis`, which retells the period
-- as one continuous experience, and `reflection`, which reads that synthesis
-- back — where the old row held a single `synthesis` field alongside a `digest`
-- and a one-line `summary`. It records exactly which entries or lower-grain
-- syntheses it was built from, which the old rows never stored: they kept a
-- count and a period name, not references.
--
-- So the existing 137 rows cannot be migrated into the new shape. They are
-- missing a `reflection` that was never generated and a provenance that was
-- never recorded, and no transformation of what is stored can invent either.
--
-- They are also the one artefact here that is safe to lose. A synthesis is
-- derived: every one of them can be produced again from the entries it covers,
-- which is why the entries are migrated with care in the previous migration and
-- these are not. Once the new pipeline is in place they are all regenerated —
-- normalising the whole history to one naming, one shape and one pipeline in a
-- single pass, rather than leaving two conventions to coexist.
--
-- Soft-delete, not DELETE. Nothing should be unrecoverable on the strength of a
-- plan that has not run yet, and these rows are the only record of what the
-- journal said about those periods until the regeneration actually happens.
UPDATE "Block"
SET "deletedAt" = NOW()
WHERE type = 'journal_summary'
  AND "deletedAt" IS NULL;

-- The hierarchy links pointed from a summary to what it read. The new
-- provenance lives on the synthesis itself, in `properties.synthesisSource`,
-- where it can record the span each source covered rather than only that a link
-- existed. These rows describe blocks that are now retired.
DELETE FROM "Relation"
WHERE type IN ('parent_summary_of', 'summarized_by');
