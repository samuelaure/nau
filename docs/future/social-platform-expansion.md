# Future — Social Platform Expansion

> Adding **TikTok**, **YouTube**, and eventually **Twitter/X** and **LinkedIn** as publishing targets beyond Instagram.

**Status:** scoped, not yet built. Data model already supports it via `SocialPlatform` enum.

---

## Context

Current state:
- `SocialProfile.platform` is an enum supporting `INSTAGRAM | TIKTOK | YOUTUBE | TWITTER | LINKEDIN`, but only `INSTAGRAM` is fully implemented end-to-end.
- Instagram Graph API is the only integration wired into flownaŭ's publishing pipeline.
- Remotion templates currently render 9:16 (Instagram/TikTok) — well positioned for TikTok.

Platform trajectory requires multi-platform publishing per brand. The data model supports it; the integrations don't.

## Target

Add per-platform publishing adapters to flownaŭ, each behind a common interface:

```ts
interface PublishingAdapter {
  platform: SocialPlatform
  refreshToken(credentials): Promise<Credentials>
  publish(composition): Promise<PublishResult>
  capabilities: {
    maxDuration: number
    aspectRatios: string[]
    supportsSchedule: boolean
    maxHashtags: number
  }
}
```

Adapters:

- `InstagramAdapter` (exists)
- `TikTokAdapter` — TikTok for Business API (developer.tiktok.com)
- `YouTubeShortsAdapter` — YouTube Data API v3
- `TwitterAdapter` — v2 API (paid tier)
- `LinkedInAdapter` — Marketing Developer Platform

## Template polymorphism

Templates may target multiple platforms. `Template.platforms: string[]` array lets a single template be reused across platforms with platform-specific `config` variants:

```
Template {
  id, name, remotionId,
  platforms: ['INSTAGRAM', 'TIKTOK'],   // multi-target
  ...
}
```

A `Composition` targeting a TikTok profile uses the TikTok variant of its template.

## Credential storage

Existing `SocialProfileCredentials` in flownaŭ is already platform-agnostic (stores `accessToken`, `refreshToken`, `tokenExpiresAt`). No schema change needed — just the adapter handles platform-specific refresh logic.

## Execution plan

Sequential:

1. TikTok — most similar UX to Instagram; short-form video.
2. YouTube Shorts — same asset type; different API shape.
3. Twitter, LinkedIn — post-launch, when user demand justifies.

Each addition:
- Build adapter (~1 week)
- UI for OAuth + credential management (already exists for Instagram; extend)
- Cron publisher picks up the right adapter based on `socialProfile.platform`
- Add per-platform defaults in Template / Composition logic

## Related

- [../platform/ENTITIES.md](../platform/ENTITIES.md) — `SocialProfile`, `SocialPlatform` enum
- [../services/flownau.md](../services/flownau.md) — current publishing pipeline
- [content-origins-expansion.md](content-origins-expansion.md) — complementary work on the ideation side
