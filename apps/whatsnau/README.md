# whatsnaŭ 🚀

whatsnaŭ is a premium, high-performance CRM and orchestration platform for WhatsApp-based sales campaigns. It is designed to bridge the gap between automated lead nurturing and high-conversion human intervention using strategic AI integration.

The system has evolved into a **v7 High-Resilience Monorepo**, featuring strict multi-tenancy, tenant-scoped credentials, and a de-sentinelized infrastructure for absolute isolation and portability.

---

## 🎯 Project Purpose

The platform empowers businesses to scale their WhatsApp outreach while maintaining a boutique, high-value interaction style. It integrates directly with the **WhatsApp Business Cloud API** and **OpenAI GPT-4o** to create a conversation-aware experience that knows when to automate and when to step aside for a human.

### Core Philosophy

-   **Multi-Tenancy First**: Complete isolation between business accounts with tenant-scoped configurations.
-   **Campaign-First Logic**: System behavior is governed by structured outreach sequences.
-   **Strategic AI usage**: AI acts as a sophisticated assistant (Closer, Receptionist, or Nurturing Buddy).
-   **Human-in-the-Loop**: Seamless transitions between AI and manual agents to ensure no "bot-like" friction.
-   **Spanish-First**: Native support for Spanish (Spain) linguistic and cultural nuances.

---

## ✨ Key Features (Platform v7.0)

### 🖥️ High-End Dashboard
-   **Glassmorphic UI**: A premium, modern interface for managing leads and campaigns.
-   **Real-time SSE Engine**: Instant updates for new messages, delivery statuses, and handover alerts.
-   **Unified Command Center**: Overview of campaign metrics, conversion rates, and active outreach.
-   **Visual DAG Builder**: A sophisticated node-based interface for designing complex message sequences.

### 🤖 Intelligent AI Agents (Multi-Role)
-   **Conversational Closer**: Warm relationship building and pre-sale qualification.
-   **Receptionist (Demo Agent)**: Time-limited sessions demonstrating competence using lead context.
-   **Nurturing Buddy**: Long-term relationship maintenance for weekly subscriber updates.
-   **Tenant-Scoped Brain**: Each business can configure its own OpenAI keys and custom prompt instructions.

### 💬 Advanced Messaging & CRM
-   **Live Chat**: Real-time feedback and delivery status tracking (Sent, Delivered, Read).
-   **Intelligent Handover**: Automatic detection of human intent with "Silent Takeover".
-   **Smart State Machine**: Automatic lead progression through COLD → INTERESTED → DEMO → NURTURING → CLIENTS.
-   **Tenant-Scoped Providers**: Support for Meta WhatsApp Cloud API and YCloud with independent credentials per tenant.

---

## 📂 Monorepo Architecture

whatsnaŭ is managed as a high-performance monorepo using **Turborepo** for optimized task execution.

```text
├── packages/
│   ├── backend/      # Node.js (ESM) API, Workers, and Orchestration Core
│   ├── frontend/     # React SPA Dashboard (Vite + Framer Motion)
│   └── shared/       # Shared types, schemas, and utilities
├── prisma/           # Centralized Database Schema (PostgreSQL)
├── scripts/          # Orchestration and deployment utilities
├── .agent/           # Strategic evolution plans and phase tracking
└── turbo.json        # Turborepo task configuration
```

---

## 🛡️ Resilience & Reliability

-   **Isolated Infrastructure**: De-sentinelized setup where each instance manages its own PostgreSQL and Redis (BullMQ).
-   **Unified Error Architecture**: Centralized error handling using custom `AppError` classes.
-   **Self-Healing Integrations**: All external API calls (WhatsApp, OpenAI) feature **Retry Utility with Exponential Backoff**.
-   **Data Atomicity**: Multi-step operations protected by **Prisma Transactions**.
-   **Observability**: Structured logging, `/health` endpoints, and system-level alerting.

---

## 🛠 Tech Stack

-   **Runtime**: [Node.js](https://nodejs.org/) (ESM) + [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
-   **Orchestration**: [Turborepo](https://turbo.build/repo)
-   **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/) + [Framer Motion](https://www.framer.com/motion/)
-   **Database**: [PostgreSQL](https://www.postgresql.org/) + [Prisma](https://www.prisma.io/)
-   **Queuing**: [BullMQ](https://bullmq.io/) (Redis-backed)
-   **AI**: OpenAI API (GPT-4o & GPT-4o-mini)
-   **Styling**: Vanilla CSS (Premium Custom Design) + TailwindCSS

---

## 🚀 Getting Started

### Prerequisites

-   Node.js (v20+)
-   PostgreSQL (v15+)
-   Redis (v7+)
-   Meta WhatsApp / YCloud credentials

### Installation

1.  **Clone and Install**:
    ```bash
    npm install
    ```
2.  **Environment Setup**:
    Copy `.env.example` to `.env` and configure your `DATABASE_URL` and other credentials.
3.  **Database Setup**:
    ```bash
    npx prisma migrate dev
    npx prisma db seed
    ```

### Development

```bash
# Run all services in development mode
npm run dev

# Run full project verification (lint, format, type-check, test)
npm run verify

# Build for production
npm run build
```

---

## 🧪 Testing

We follow TDD practices with a focus on high-fidelity service mocking and integration validation.

```bash
# Run all tests via Turbo
npm test

# Run tests with coverage report
turbo run test -- --coverage
```

---

## ⚖️ License

Proprietary. Developed for high-performance production environments.

