# naŭ Mobile App — Architecture Refactor

> Separate, larger refactor of the mobile app itself (not the capture modal action labels — those are part of `source-concepts-and-knowledge-bases.md` Priority 1).
> Out of scope of the source-concepts-and-knowledge-bases plan. Tackled after.

## Context
The naŭ Mobile App was originally a **captured-posts inbox**. With the new architecture (four-category naŭthenticity + workspaces + projects), the app needs significant refactoring to coexist in harmony.

## Refactor topics

### 1. Centralized Instagram processing
- **All Instagram captures will be processed by naŭthenticity.** This centralizes ownership of processing pipelines (download, optimize, transcribe, thumbnail).
- **Processing in naŭthenticity ≠ displayed in naŭthenticity.** Examples:
  - "Posts for Replication" → processed by naŭthenticity, displayed in flownaŭ.
  - Mobile-app-only captures (no special feature) → processed by naŭthenticity, displayed in app / mobile-app.
- naŭthenticity acts as a **service provider** for the consuming apps in these cases.

### 2. Per-app file storage
- Even when naŭthenticity processes the media, the storage location may be the **consuming app's folder**.
- TBD whether all media goes to a single naŭthenticity bucket vs per-app buckets.

### 3. User → Workspace refactor
- Today: captures are attached to **user + optional tags**.
- Target: captures attach to **workspaces**. Tags, projects, etc. all become workspace-scoped.
- Same app/mobile-app system and feature surface, just scoped per workspace.

### 4. Data migration
- The user has a bunch of captured posts in the **old mobile app version** that must continue to work.
- Migration must safely move that data into the new architecture so existing captures keep displaying.

## Audit needed first
Before designing this refactor:
- Map current mobile-app capture model (what tables, what user/tag relations).
- Identify all current capture types and where they currently display.
- Identify integration points with naŭthenticity, flownaŭ, and any backend-for-frontend layer.

### 5. Capture modal: create Brand or Project inline
- The capture modal ("Send Profile/Post to...") must allow the user to **create a new Brand or Project** without leaving the modal flow.
- On "Send to Brand" → if no brand exists or the user wants a new one, show an inline "New Brand" creation step (name → create → auto-select).
- On "Send to Project" → same pattern: "New Project" inline creation step.
- Both entities must be workspace-scoped; workspace context is already available in the modal.
- API calls: `POST /workspaces/:id/brands` and `POST /workspaces/:id/projects` (already live in api).
- nauthenticity sync is automatic (fires from api's ProjectsService/BrandsService on create).

## Status
- Stand-by until source-concepts-and-knowledge-bases (Priority 1) lands.
- Audit and refactor are their own multi-step efforts.

---

## User's notes (verbatim)

> On the other hand, the naŭ Mobile App itself was an captured posts inbox... Of course, this should be accordingly refactored too to coexist in harmony with the new implementations. But this is a talk for another moment, and again, I will leave some notes for reference:
> - All instagram captures will be processed by naŭthenticity, to centralize responsibility ownership, however, being processed by naŭthenticity doesn't mean displayed on naŭthenticity... For example, 'Post for replication' are processed (downloaded, optimized, transcribed, thumbnailed,...) by naŭthenticity, but displayed only in flownaŭ. What the mobile app currently capture for itself (not special features) will be also processed by naŭthenticity, but displayed in app/mobile-app. We may want to store the files in their respective app folder even that naŭthenticity process them, because at this level/cases, naŭthenticity works as a service provider for these apps.
> - What is currently attached to user + optional-tags, should be refactored into workspaces, so we can have the same app/mobile-app system and features, but now by workspaces... (tags by workspaces, projects, by workspaces, etc...)
> - I have a a bunch of captured posts in my old version app mobile, that data should be migrated safetly to the new architecture to be displayed again...
