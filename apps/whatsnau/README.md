# whatsnaŭ 🚀

whatsnaŭ is a premium, high-performance CRM and orchestration platform for WhatsApp-based sales campaigns. It is designed to bridge the gap between automated lead nurturing and high-conversion human intervention using strategic AI integration.

Built with **enterprise-grade resilience** and **world-class development standards**, it serves as a robust backbone for modern digital sales teams.

---

## 🎯 Project Purpose

The platform empowers businesses to scale their WhatsApp outreach while maintaining a boutique, high-value interaction style. It integrates directly with the **WhatsApp Business Cloud API** and **OpenAI GPT-4o** to create a conversation-aware experience that knows when to automate and when to step aside for a human.

### Core Philosophy

- **Campaign-First Logic**: System behavior is governed by structured outreach sequences.
- **Strategic AI usage**: AI acts as a sophisticated assistant (Closer or Receptionist), while deterministic logic ensures outreach reliability.
- **Human-in-the-Loop**: Seamless transitions between AI and manual agents to ensure no "bot-like" friction during high-stakes moments.
- **Spanish-First**: Native support for Spanish (Spain) linguistic and cultural nuances.

---

## ✨ Key Features (Platform v2.0)

### 🖥️ High-End Dashboard

- **Glassmorphic UI**: A premium, modern interface for managing leads and campaigns.
- **Real-time SSE Engine**: Instant updates for new messages, delivery statuses, and handover alerts via Server-Sent Events.
- **Unified Command Center**: Overview of campaign metrics, conversion rates, and active outreach.
- **Lead Segmentation**: Visual breakdown of COLD, INTERESTED, NURTURING, and CLIENT leads.

### 🤖 Intelligent AI Agents (3 Specialized Roles)

- **Conversational Closer**: Pre-sale conversations with INTERESTED leads, gathering key information and warming relationships.
- **Receptionist (Demo Agent)**: Time-limited demo sessions (5-10 min) using lead's business context to demonstrate competence.
- **Nurturing Buddy**: Community host for weekly tips subscribers, building long-term relationships and identifying opportunities.
- **Lead-Specific Context**: All agents receive personalized context (name, business data, tags, conversation history).
- **Business Knowledge Base**: Inject your specific business context directly into the AI's "brain".
- **Dynamic Prompt Management**: Fine-tune agent personality and instructions through the dashboard.
- **Manual AI Toggle**: Granular control to enable/disable the AI assistant on a per-lead basis.

### 💬 Advanced Messaging & CRM

- **Live Chat**: Integrated chat modal with real-time feedback and delivery status tracking (Sent, Delivered, Read).
- **Intelligent Handover**: Automatic detection of human intent with "Silent Takeover" for manual agents.
- **Template-Driven Sequences**: Configurable message templates with variable substitution ({{name}}, {{business}}, etc.).
- **Multi-Stage Campaigns**:
  - Main Outreach: M1 (Pitch) → M2 (Follow-up) → M3 (Weekly Tips Invite)
  - Nurturing Onboarding: 3 welcome messages over 23 hours
- **Smart State Machine**: Automatic lead progression through COLD → INTERESTED → DEMO → NURTURING → CLIENTS.
- **Conditional Logic**: YES/NO response handling with immediate M3 delivery on rejection.

---

## 🛡️ Resilience & Reliability (Standard)

whatsnaŭ is engineered for production environments where reliability is non-negotiable:

- **Unified Error Architecture**: Centralized error handling using custom `AppError` classes and global middleware to ensure no crash goes silent.
- **Self-Healing Integrations**: All external API calls (WhatsApp, OpenAI) are wrapped in a **Retry Utility with Exponential Backoff**.
- **Data Atomicity**: Critical multi-step operations (like Mass Import) are protected by **Prisma Transactions** to prevent partial data state.
- **Observability**: Standardized structured logging and a `/health` endpoint for external monitoring and uptime validation.
- **Defensive UI**: Global React Error Boundaries and a real-time Notification System (Toasts) provide immediate user feedback on system status.

---

## 🧪 Testing & Quality Assurance

We follow industry-standard TDD (Test-Driven Development) practices to ensure the platform remains stable as it evolves.

- **Unit Tests**: Critical logic normalization and AI service interactions are fully unit-tested with **Vitest**.
- **Integration Tests**: Full-flow API validation using **Supertest**, verifying everything from health checks to error propagation.
- **Deterministic Mocking**: All external service dependencies are mocked to ensure tests are fast, reliable, and offline-compatible.

### Run Tests:

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Watch mode for development
npm run test:watch
```

---

## 🛠 Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/) (ESM) + [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/) + [Lucide Icons](https://lucide.dev/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Testing**: [Vitest](https://vitest.dev/) + [Supertest](https://github.com/ladjs/supertest)
- **Database**: SQLite (Dev) / PostgreSQL (Prod)
- **AI**: OpenAI API (GPT-4o & GPT-4o-mini)
- **Styling**: Vanilla CSS (Premium Custom Design)

---

## 📂 Project Structure

```text
├── src/
│   ├── core/         # Orchestrator, Database, Config, Logger, Errors (Resilience Core)
│   ├── api/          # Webhook, Dashboard, & Import Controllers
│   ├── services/     # AI, WhatsApp, Lead, Sequence, Metrics, Events
│   └── index.ts      # Application entry point & Observability
├── frontend/         # React SPA Dashboard + Resilience Components
├── prisma/           # Schema & Migrations (SQLite/PostgreSQL)
├── .agent/           # Automation workflows & Project Rules
└── .cursorrules      # Strategic AI coding rules
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v20+)
- Meta WhatsApp Cloud API credentials
- OpenAI API Key

### Installation

1.  **Clone and Install**:
    ```bash
    npm install
    cd frontend && npm install && cd ..
    ```
2.  **Environment Setup**:
    Copy `.env.example` to `.env` and fill in your Meta and OpenAI credentials.
3.  **Database Migration**:
    ```bash
    npx prisma migrate dev
    ```
4.  **Run Development**:
    ```bash
    # Backend
    npm run dev
    # Frontend (Separate terminal)
    cd frontend && npm run dev
    ```

---

## ⚖️ License

Proprietary. Developed for high-performance production environments.
