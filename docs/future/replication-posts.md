# Replication Posts (flownaŭ post type)

> Currently implemented in the codebase under "Mark for Replication". To be renamed and formalized.
> Out of scope of the source-concepts-and-knowledge-bases plan — tackled after that one lands.

## Rename
**"Mark for Replication" → "Plan for Replication"** (mobile capture modal label).

## What it is
Replication posts are an extension of the Post type. Variants:
- video + replicate
- carousel + replicate
- static / single image + replicate

## Lifecycle
1. User captures a post via "Plan for Replication" → flownaŭ → status: **unscheduled post to replicate**.
2. The post is displayed as a normal post in flownaŭ. Its modal shows the **original source post** (multimedia + caption) until the user uploads their replication.
3. User uploads their replication (multimedia file/s and caption).
4. Once uploaded, the user-uploaded content **replaces** the original source as the displayed content. The original source content is hidden in a **toggle-off section below** for reference.
5. Post then proceeds through the normal flownaŭ flow (approve → schedule → publish).

## LLM rules
- **Caption**: LLM generation is available (assist or fully manual).
- **Multimedia**: must be uploaded by the user. **No LLM/AI generation for media.**

## Processing
All Instagram capture media (including replication source media) is processed by naŭthenticity (download, optimize, transcribe, thumbnail), but **displayed in flownaŭ**.

## Status
- Currently implemented (foundation exists). Needs the rename + alignment with the new naŭthenticity architecture once Priority 1 (`source-concepts-and-knowledge-bases.md`) is complete.
- Audit of current implementation pending.
