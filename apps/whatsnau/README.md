# whatsnaŭ 🚀

whatsnaŭ is a high-performance CRM and orchestration platform for WhatsApp-based sales campaigns. It is designed to manage cold outreach, conversational pre-sales, and long-term lead nurturing with strategic AI integration.

---

## 🎯 Project Purpose

The platform enables businesses to automate their WhatsApp sales funnel while maintaining a human, high-value interaction style. It integrates directly with the **WhatsApp Business Cloud API** and **OpenAI GPT-4o** to create a seamless, conversation-aware experience.

### Key Logic
- **Campaign-First Architecture**: System behavior is driven by predefined sequence structures.
- **Strategic AI usage**: GPT-4o is reserved for critical human-like interactions, while deterministic logic handles the "heavy lifting".
- **Spanish-First Interactions**: All client-facing content follows the Spanish (Spain) linguistic and cultural context.

---

## 🛠 Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: PostgreSQL (Production)
- **Messaging**: Meta WhatsApp Business Cloud API
- **AI**: OpenAI API (GPT-4o & specialized models)

---

## 🧠 Strategic Mindset

whatsnaŭ follows the **Four Agreements**:
1. Be impeccable with your word.
2. Don’t take anything personally.
3. Don’t make assumptions.
4. Always do your best.

The service is inherently valuable; our goal is to **expose**, not to convince.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+)
- PostgreSQL instance
- Meta Developer App (WhatsApp Cloud API)
- OpenAI API Key

### Installation
```bash
# Clone the repository
git clone <repo-url>

# Install dependencies
npm install

# Initialize Prisma
npx prisma generate
```

---

## 📂 Project Structure (Planned)

```text
├── src/
│   ├── core/         # State machine, campaign logic, context manager
│   ├── api/          # WhatsApp webhooks, OpenAI integrations
│   ├── services/     # CRM, Messaging, AI Agents
│   ├── templates/    # WhatsApp and Prompt templates (Spanish)
│   └── utils/        # Loggers, helpers
├── prisma/           # Schema & Migrations
├── .cursorrules      # Project-specific AI behavior rules
└── .agent/           # Automation workflows
```

---

## ⚖️ License

Proprietary. Developed for production use.
