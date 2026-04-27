# Composer Format Expansion

## Status: Planned (depends on Post model refactor)

---

## Overview

After the Post model refactor, expand the AI composition step to support all formats natively. Currently only `reel` and `head_talk` have composer implementations. Each format produces a different `creative` JSON shape stored on `Post.creative`.

---

## Format inventory

| Format | `creative` shape | Composer | Renderer |
|---|---|---|---|
| `reel` | `{ scenes[], caption, hashtags, coverSceneIndex, audioMood }` | ✅ exists | Remotion |
| `trial_reel` | same as reel | ✅ (alias) | Remotion |
| `head_talk` | `{ script, caption, hashtags }` | ✅ exists (separate path) | Remotion (teleprompter template) |
| `carousel` | `{ slides[], caption, hashtags, coverSlideIndex }` | ❌ to build | Remotion / static |
| `static_post` | `{ image: { mediaTags, altText }, caption, hashtags }` | ❌ to build | Image renderer |
| `story` | `{ screen: { type, textSlots, mediaTags }, caption }` | ❌ to build | Remotion |

---

## `creative` JSON shapes

### reel / trial_reel (existing)
```ts
interface ReelCreative {
  scenes: Array<{
    type: string           // scene type from catalog
    textSlots: Record<string, string>
    timing?: number        // seconds
    mediaTags?: string[]
  }>
  caption: string
  hashtags: string[]
  coverSceneIndex: number
  audioMood?: string
}
```

### head_talk (existing, separate path)
```ts
interface HeadTalkCreative {
  script: string           // teleprompter-ready, conversational
  caption: string
  hashtags: string[]
}
```

### carousel (to build)
```ts
interface CarouselCreative {
  slides: Array<{
    heading: string
    body: string
    mediaTags?: string[]
    isListSlide?: boolean   // recap/summary slide variant
  }>
  caption: string
  hashtags: string[]
  coverSlideIndex: number  // usually 0
}
```

**Composer logic:** AI receives the idea text + brand voice. Produces a structured slide sequence. The cover slide sets a clear promise ("How to X in Y steps"). Each content slide = one point. Last slide = CTA.

### static_post (to build)
```ts
interface StaticPostCreative {
  image: {
    mediaTags: string[]    // used for asset selection
    altText: string
  }
  caption: string
  hashtags: string[]
}
```

**Composer logic:** Minimal AI involvement — primarily asset selection + caption writing. No scene structure needed.

### story (to build)
```ts
interface StoryCreative {
  screen: {
    type: string           // text-only | image-overlay | video-clip
    textSlots: Record<string, string>
    mediaTags?: string[]
  }
  caption: string          // optional for stories
}
```

---

## Composer service changes

All formats should funnel through a single `composePost()` entry point that dispatches by format:

```ts
async function composePost(input: ComposeInput): Promise<Post> {
  switch (input.format) {
    case 'reel':
    case 'trial_reel':  return composeReel(input)
    case 'head_talk':   return composeHeadTalk(input)
    case 'carousel':    return composeCarousel(input)
    case 'static_post': return composeStaticPost(input)
    case 'story':       return composeStory(input)
  }
}
```

Each format composer returns a `creative` object + `caption` + `hashtags`, which are written to `Post.creative`, `Post.caption`, `Post.hashtags`.

The `payload` (rendering timeline) is compiled separately by the format-specific timeline compiler after the creative is approved.

---

## Template changes

Each format has an associated `Template` that defines:
- `systemPrompt` — creative direction for the AI
- `contentSchema` — the slot schema the AI must fill
- `sceneType` — the Remotion component to use for rendering

Templates are format-scoped. The composer selects the template via `BrandTemplateConfig` (which templates are enabled for this brand + which format).

---

## Auto-approval at draft stage

`BrandTemplateConfig.autoApproveDraft` — if true, composition goes straight to `DRAFT_APPROVED` after AI generates it, skipping manual review.

---

## Priority: After Post model refactor. Before post-frequency-feature.
