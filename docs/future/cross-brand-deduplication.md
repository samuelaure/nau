# Cross-Brand De-Duplication

> Stand-by. Tightly tied to the four-category restructure in [`source-concepts-and-knowledge-bases.md`](./source-concepts-and-knowledge-bases.md) — implementing them together is the right move when the time comes.

## Why
As we grow, multiple brands will inevitably share profiles/posts:
- Brand A monitors a profile that is Brand B's owned profile.
- Two brands have the same profile in their Comment / InspoBase / Benchmark-Study categories.
- Many brands capture the same post.

We must avoid triplicating:
- **Storage** (rows, media, transcripts)
- **Compute** (downloads, embeddings, transcriptions)
- **Third-party costs** (Apify, OpenAI, etc.)

## Design implication
Profile/post records become **shared singletons** keyed by `(platform, externalId)`. Category membership and brand association are separate join records.

This pattern naturally falls out of the four-category plan's "cross-category linking" — same shape, just extended across brands instead of categories.

## Status
- Stand-by. Worth implementing soon to avoid expensive migrations later, but not required for the initial four-category restructure to ship.
- Details to be discussed when its time comes.
