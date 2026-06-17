# 🌙 Midnight AI

A personal AI agent for Telegram — with memory, tasks, notes, reminders, file analysis, and more.

## Tech Stack

- **Runtime**: Node.js 20 + TypeScript
- **Bot**: Telegraf 4
- **ORM**: Prisma + PostgreSQL
- **Cache/Context**: Redis
- **LLM**: OpenAI-compatible (GPT-4o, Together AI, Groq, Ollama, etc.)
- **Deployment**: Railway / Docker

---

## Quick Start (Local)

### 1. Clone & Install

```bash
git clone <repo>
cd midnight-ai
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env — at minimum set:
#   TELEGRAM_BOT_TOKEN
#   OPENAI_API_KEY
#   DATABASE_URL
#   REDIS_URL
```

### 3. Start Infrastructure

```bash
docker compose up postgres redis -d
```

### 4. Run Migrations

```bash
npm run db:migrate:dev
```

### 5. Start Dev Server

```bash
npm run dev
```

---

## Docker (Full Stack)

```bash
# Production
docker compose up -d

# Development (with hot reload + Prisma Studio)
docker compose --profile dev up -d
```

---

## Railway Deployment

1. Push to GitHub
2. Create new Railway project → Deploy from GitHub
3. Add PostgreSQL plugin
4. Add Redis plugin
5. Set environment variables (see `.env.example`)
6. Railway auto-detects `railway.toml` and `Dockerfile`

`DATABASE_URL` and `REDIS_URL` are automatically injected by Railway plugins.

---

## Project Structure

```
src/
├── index.ts              # Entry point
├── types/                # Shared TypeScript types
├── utils/
│   ├── config.ts         # Validated env config (Zod)
│   └── logger.ts         # Winston logger
├── database/
│   └── prisma.ts         # Prisma singleton
├── services/
│   ├── redis.ts          # Redis: context, cache, sessions
│   └── health.ts         # HTTP health check
├── ai/
│   └── index.ts          # LLM client, intent classification
├── bot/
│   ├── index.ts          # Bot factory
│   ├── commands/         # /start /help /memory etc.
│   └── handlers/         # message.ts, file.ts
├── memory/               # Memory CRUD
├── notes/                # Notes CRUD
├── tasks/                # Tasks CRUD
├── reminders/
│   ├── index.ts          # Reminders CRUD
│   └── scheduler.ts      # Cron-based reminder delivery
├── calculator/           # Math evaluation
├── files/                # PDF/DOCX/image analysis
└── middleware/
    └── auth.ts           # Auth guard, typing indicator

prisma/
└── schema.prisma         # Full database schema
```

---

## Supported LLM Providers

Change `OPENAI_BASE_URL` and `OPENAI_MODEL` to use any OpenAI-compatible API:

| Provider | Base URL | Example Model |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| Together AI | `https://api.together.xyz/v1` | `meta-llama/Llama-3-70b-chat-hf` |
| Groq | `https://api.groq.com/openai/v1` | `llama3-70b-8192` |
| Ollama (local) | `http://localhost:11434/v1` | `llama3` |

---

## Example Conversations

```
You: Remember my GPU is RTX 3070
Bot: 🧠 Got it! Stored: GPU is RTX 3070

You: What GPU do I have?
Bot: Your GPU is an RTX 3070.

You: Add task: Review the PR by Friday  HIGH priority
Bot: ✅ Task created: Review the PR by Friday (high)

You: Remind me tomorrow at 18:00 to pay internet
Bot: ⏰ Reminder set! Pay internet — 19 Jun 2026 18:00

You: 17500 + 3200 - 500
Bot: 🧮 17500 + 3200 - 500 = 20200
```
