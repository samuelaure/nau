# Plan: Remove /api Prefix from 9naŭ API

## Context
The 9naŭ API is currently hosted on `api.9nau.com` but its routes are configured with an `/api/` global prefix (i.e. `api.9nau.com/api/...`). This is redundant and undesirable. The goal is to remove the `/api` prefix from the 9naŭ API so its routes start at the root (`api.9nau.com/...`), and to update all naŭ Platform apps that consume it.

## Goals
- Remove the global prefix from the 9naŭ API service.
- Update the 9naŭ Next.js web client to stop appending `/api` to the base URL.
- Update Nauthenticity proxy routes to point to the new root paths.
- Update Zazu Bot and Dashboard to consume the correct paths.
- Update Flownau's `NAU_API_URL` requests to remove the `/api` prefix.

## Execution Roadmap
- [x] **Phase 1: Update 9naŭ API and Web Client** (`9nau/apps/api` and `9nau/apps/app`)
- [x] **Phase 2: Update Nauthenticity Proxy** (`nauthenticity`)
- [x] **Phase 3: Update Zazu** (`zazu/apps/bot` and `zazu/apps/dashboard`)
- [x] **Phase 4: Update Flownau** (`flownau`)
- [x] **Phase 5: Verification and Commit**
