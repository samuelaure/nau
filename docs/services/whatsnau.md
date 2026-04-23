# Service — whatsnaŭ

- **Domain:** `whatsnau.9nau.com`
- **Role:** WhatsApp CRM & sales campaign orchestration. Standalone SaaS.
- **Stack:** Node.js ESM · Prisma · PostgreSQL · Redis · BullMQ · React/Vite (dashboard)

---

## Scope

whatsnaŭ is presently **standalone** — not integrated with the platform's workspace/brand/user model. Its own Prisma schema owns its tenants and credentials.

**This foundational refactor does not touch whatsnaŭ.** Documented here for platform completeness.

---

## Future integration (out of scope for this phase)

When integrating, likely steps:

1. Migrate whatsnaŭ's user model to 9naŭ API via SSO (same as other services).
2. Introduce workspace/brand scoping (a workspace can have WhatsApp CRM attached as a feature).
3. Replace whatsnaŭ's JWT with platform JWT via `@nau/auth`.
4. Consume 9naŭ API for identity, keep local schemas for WhatsApp-specific data (leads, messages, campaigns).

Timeline: post-launch. Separate ADR if/when this work starts.

---

## Status

🟢 Production (standalone).
