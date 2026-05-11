# Post Enrichment Extensions

> Stand-by. Future enhancements to the naŭthenticity Post enrichment pipeline.
> Out of scope of `source-concepts-and-knowledge-bases.md`.

## Current state (the naŭthenticity-standard enriched Post)

When naŭthenticity processes an Instagram post, the resulting `Post` row plus its related media/transcripts is the **standard enriched object** consumed by every downstream feature (idea generation, comment suggestions, knowledge base, search, analytics).

Currently included:
- Multimedia files (downloaded, optimized, thumbnailed)
- Caption text (original + cleaned)
- **Audio transcription** for videos with spoken audio (raw transcription + clean transcription)

This mirrors the Zazŭ standard for voicenotes (audio file + raw + clean transcription). naŭthenticity's enriched Post is the **app's foundational data unit** for all downstream consumption.

## Missing — to implement later

### Text-from-video extraction (OCR)
- Today, transcription only handles **spoken audio**.
- Videos that contain **on-screen text** (titles, captions, slides, animated text) currently lose that data — it's not captured into the enriched Post.
- Implement OCR-style extraction so the resulting text is added to the enriched Post alongside the audio transcription.

### Image text extraction (OCR for static images and carousel images)
- Same idea applied to static images / carousel posts: extract any on-image text.

### Bulk re-processing of pre-implementation posts
- Once the new extractors are in place, **all already-processed posts** must be bulk re-processed to bring them up to the new standard.
- This is a one-time data normalization pass — required so historical posts don't have an inconsistent enrichment shape compared to newly-captured ones.

## Sequencing
1. Implement the new extractors (video text, image text).
2. Run the bulk re-processing pass on all existing posts.
3. Anything that consumes the enriched Post (idea generation, KB chat, search) automatically benefits.

## Status
- Stand-by. Tackle after the source-concepts-and-knowledge-bases plan and the cross-brand de-duplication plan.
