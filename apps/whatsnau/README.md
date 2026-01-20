# whatsnaŭ 🚀

whatsnaŭ is a premium, high-performance CRM and orchestration platform for WhatsApp-based sales campaigns. It is designed to bridge the gap between automated lead nurturing and high-conversion human intervention using strategic AI integration.

---

## 🎯 Project Purpose

The platform empowers businesses to scale their WhatsApp outreach while maintaining a boutique, high-value interaction style. It integrates directly with the **WhatsApp Business Cloud API** and **OpenAI GPT-4o** to create a conversation-aware experience that knows when to automate and when to step aside for a human.

### Core Philosophy
- **Campaign-First Logic**: System behavior is governed by structured outreach sequences.
- **Strategic AI usage**: AI acts as a sophisticated assistant (Closer or Receptionist), while deterministic logic ensures outreach reliability.
- **Human-in-the-Loop**: Seamless transitions between AI and manual agents to ensure no "bot-like" friction during high-stakes moments.
- **Spanish-First**: Native support for Spanish (Spain) linguistic and cultural nuances.

---

## ✨ Key Features

### 🖥️ High-End Dashboard
- **Glassmorphic UI**: A premium, modern interface for managing leads and campaigns.
- **Real-time SSE Engine**: Instant updates for new messages, delivery statuses, and handover alerts via Server-Sent Events.
- **Unified Command Center**: Overview of campaign metrics, conversion rates, and active outreach.

### 🤖 Intelligent AI Agents
- **Closer & Receptionist Roles**: Specialized AI personas for different stages of the funnel.
- **Business Knowledge Base**: Inject your specific business context directly into the AI's "brain".
- **Dynamic Prompt Management**: Fine-tune agent personality and instructions through the dashboard.
- **Manual AI Toggle**: Granular control to enable/disable the AI assistant on a per-lead basis.

### 💬 Advanced Messaging & CRM
- **Live Chat**: Integrated chat modal with real-time feedback and delivery status tracking (Sent, Delivered, Read).
- **Intelligent Handover**: Automatic detection of human intent with "Silent Takeover" for manual agents.
- **Sequence Orchestration**: Manage multi-stage follow-ups (M0, M1, M2...) with configurable wait times.
- **Template Management**: Direct visibility into Meta-approved marketing templates.

---

## 🛠 Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/) (ESM) + [TypeScript](https://www.typescriptlang.org/)
- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/) + [Lucide Icons](https://lucide.dev/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: SQLite (Dev) / PostgreSQL (Prod)
- **Messaging**: Meta WhatsApp Cloud API
- **AI**: OpenAI API (GPT-4o & GPT-4o-mini)
- **Styling**: Vanilla CSS (Premium Custom Design)

---

## 📂 Project Structure

```text
├── src/
│   ├── core/         # Orchestrator, Database, Config, Logger
│   ├── api/          # Webhook & Dashboard Controllers
│   ├── services/     # AI, WhatsApp, Lead, Sequence, Metrics, Events
│   └── index.ts      # Application entry point
├── frontend/         # React SPA Dashboard
├── prisma/           # Schema & Migrations (SQLite/PostgreSQL)
├── .cursorrules      # Strategic AI coding rules
└── .agent/           # Automation workflows
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
