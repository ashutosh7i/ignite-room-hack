# EnSight

**A universal user-context layer for platform operators.**  
Demo use case: **context-aware support** on a developer SaaS / API platform.

> **The ticket is identical. The context is not.**

Slides and narrative: **[deck.pdf](./deck.pdf)** (Ignite Delhi · Context Layer track).

---

## Problem

Platforms store plenty of user data—signups, usage, errors, tickets—but **facts are not context**. Two customers can report the same issue (“My API stopped working”) while needing opposite actions: one is a **new integration** with a missing API key; the other is a **production account** with a sudden error spike and no config change.

EnSight sits **above the raw database**, continuously compiles **structured understanding** per user, and exposes it to **applications** (support UI, conversational agent, similar-user discovery)—not as a text dump from RAG.

---

## What we built

| Capability | Description |
|------------|-------------|
| **User directory** | 656 hackathon participants imported from CSV + search |
| **Platform telemetry** | Simulated SaaS signals (SDK, volume, error rates, API key, features) |
| **Context engine** | Deterministic facts + **Jev** semantic judgments → JSONB profile |
| **Living context** | Refresh on demand + **Simulate error spike** demo |
| **Conversational agent** | Grounded Q&A on a user profile (with response timing) |
| **Support intelligence** | Side-by-side **User A vs User B**, same ticket, different handling |
| **Similar contexts** | Weighted similarity for incident-style bonus demo |

### Design principle

**SQL handles facts. Jev handles judgment. The LLM handles language.**

Structured state stays structured end-to-end—we do not embed platform JSON into a vector DB for this use case.

---

## Architecture

![EnSight — a living context layer above fragmented platform data](./image.png)

*Raw sources → Postgres + Prisma → Context Engine (Facts · Judgment · Language) → living `user_context` → applications.*

```text
CSV + simulated activity  →  PostgreSQL (users, activity, tickets)
                                      ↓
                    Facts (code)  +  Jev (OpenRouter Decisions API)
                                      ↓
                           user_context (JSONB)
                                      ↓
              UI · Support demo · Agent (optional LLM summaries)
```

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Vite, React, TypeScript, Tailwind, shadcn/ui |
| Backend | Express, TypeScript, Prisma |
| Database | PostgreSQL (Docker Compose) |
| Semantic decisions | [TypeSafe Jev 1.13](https://openrouter.ai/typesafe/jev-1.13) via OpenRouter |
| Language (when needed) | OpenRouter chat (e.g. Gemini Flash) |

---

## Quick start

### Prerequisites

- Node.js 20+
- Docker (for Postgres)
- [OpenRouter](https://openrouter.ai/) API key (Jev + optional chat)

### 1. Install

```bash
npm install
```

### 2. Database

```bash
npm run docker:up
```

Copy env and set your key:

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — set OPENROUTER_API_KEY and DATABASE_URL if needed
```

Default Postgres (from `docker-compose.yml`):

```text
postgresql://ignite:ignite_dev@localhost:5432/ignite?schema=public
```

### 3. Seed data

Imports [`Dataset for PS-3 (Ignite Room).csv`](./Dataset%20for%20PS-3%20(Ignite%20Room).csv), creates **Demo User A** (onboarding) and **Demo User B** (production regression), and builds context for demo users (calls Jev).

```bash
npm run db:seed
```

### 4. Run

```bash
npm run dev
```

- **UI:** http://localhost:5173  
- **API:** http://localhost:3001  

---

## Demo script (~2 minutes)

1. Open **Support demo** — same message, different escalation (User A vs User B).  
2. Open **Ashwin Gupta** (Demo B) — evidence, FACT / DERIVED / JEV tags, high escalation.  
3. **Ask EnSight** — e.g. “Why is their API failing?” (grounded, fast) or a custom question.  
4. **Simulate error spike** on another user — watch context refresh.  
5. **Find similar contexts** or ask about similar behaviour — incident cluster narrative.

Golden fixtures are seeded as `demoRole` **A** (onboarding) and **B** (production).

---

## API overview

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Health + DB |
| `GET` | `/api/users?search=` | User directory |
| `GET` | `/api/users/:id` | User + activity + tickets |
| `GET` | `/api/users/:id/context` | Stored context JSON |
| `POST` | `/api/users/:id/context/refresh` | Rebuild context (facts + Jev) |
| `POST` | `/api/users/:id/simulate-spike` | Demo: spike errors + refresh |
| `GET` | `/api/users/:id/similar` | Similar context matches |
| `POST` | `/api/support/analyze` | Side-by-side support demo payload |
| `POST` | `/api/agent/query` | `{ message, userId? }` — grounded + optional LLM |
| `POST` | `/api/context/evaluate` | Raw Jev evaluate (debug) |

---

## Project layout

```text
ignite-room-hack/
├── deck.pdf                 # Final presentation
├── image.png                # Architecture diagram (README)
├── docker-compose.yml
├── Dataset for PS-3 (...).csv
├── backend/
│   ├── prisma/              # Schema + migrations
│   ├── scripts/seed.ts      # CSV import + demo fixtures
│   └── src/
│       ├── services/context/   # buildContext, facts, similarity
│       ├── services/jev/       # OpenRouter Decisions
│       └── services/agent/     # Grounded + LLM agent
└── frontend/
    └── src/pages/           # Users, User context, Support demo
```

---

## Environment variables

See [`backend/.env.example`](./backend/.env.example).

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `JEV_MODEL` | Default `typesafe/jev-1.13` |
| `CHAT_MODEL` | Chat model for agent fallback |
| `OPENROUTER_HTTP_REFERER` / `OPENROUTER_X_TITLE` | Optional OpenRouter app metadata |
| `AGENT_USE_LLM` | Set `false` to disable LLM fallback (context-only answers) |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Backend + frontend |
| `npm run build` | Production build both workspaces |
| `npm run docker:up` / `docker:down` | Postgres container |
| `npm run db:seed` | Import CSV + seed demo users |
| `npm run db:migrate -w backend` | Prisma migrate (dev) |
| `npm run db:studio -w backend` | Prisma Studio |

---

## Hackathon alignment

Built for **Ignite with Delhi · Context Layer track**: chosen platform (developer SaaS), ingested CSV + simulated activity, synthesized context above raw data, conversational agent, generalizable layer design, and a **downstream support + similarity** demo.

---

## License

Private hackathon project.
