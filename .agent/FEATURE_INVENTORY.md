# NAŬ PLATFORM — GLOBAL FEATURE INVENTORY
> **Purpose:** A master catalog of all active capabilities in the platform. No more forgetting what you've built.
> **Maintenance:** This file is AUTOMATICALLY updated by the `/merger` protocol at the end of every successful feature deployment.

---

## 🎯 Marketing & Engagement
* **WhatsApp CRM Orchestration (`whatsnau`)** — Manages automated sales campaigns and agent dispatching via WhatsApp.
* **Embeddable Chatbot (`web-chatbot-widget`)** — RAG chatbot running on Karen Explora to answer questions and capture leads.
* **Instant Instagram Publishing (`flownau`)** — Direct media publishing to Instagram via Graph API using `NAU_SERVICE_KEY` auth. Supports explicit scheduling and auto-post fallback.
* **Automated Ideation Engine (`flownau`)** — Converts brand DNA and inspiration from `nauthenticity` into structured content ideas and composition schemas.
* **Batch Video Rendering (`flownau`)** — Headless Remotion rendering pipeline for generating high-definition video assets at scale without human intervention.

## 🧠 Knowledge & AI Processing
* **Instagram Profile Scraping (`nauthenticity`)** — Heavy downloading of Instagram profiles for knowledge extraction via Apify.
* **Vector Semantic Search (`nauthenticity`)** — Built-in `pgvector` database to query your scraped brand context via embeddings.
* **Proactive Comment Suggester (`nauthenticity` + `zazu`)** — AI-generated brand-aware comments on competitor/target posts, delivered via grouped Telegram messages. Supports user-defined time windows and feedback loops.

## ⚙️ Orchestration & Infrastructure
* **Telegram Command Hub (`zazu`)** — Personal admin interface in Telegram for interacting with the naŭ platform seamlessly.
* **Telegram Mini App Console (`zazu`)** — Native React-based administrative UI inside Telegram for managing brands, targets, and platform settings without leaving the chat.
* **Local Voice Transcription (`whisper-service`)** — Fast local-only transcription of audio files (GPU optimized).
* **Universal Telegram Linking (`9nau` + `zazu`)** — Persistent identity bridge connecting 9naŭ Accounts to Telegram via one-time tokens. Enables cross-app banner notification and bot-side identity verification.
* **GitOps Documentation (`platform`)** — Automated generation of `DOCUMENTATION.md` and feature logs so context is never lost.

---
_Last updated via Protocol: 2026-04-10. If you use a feature and it's missing here, run the `/auditor` to log it._
