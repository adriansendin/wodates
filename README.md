# Wodates

Monorepo for **Wodates**: a dating platform with a React Native (Expo) client, a Fastify API, a Python AI microservice, and Supabase as the data layer.

## Repository layout

| Path | Role |
|------|------|
| `mobile-app/` | Expo / React Native client |
| `backend-api/` | Fastify REST API |
| `ai-service/` | FastAPI service for LLM, embeddings, and profile tasks |
| `supabase/` | Schema reference (`schema.public.sql` — DDL only, no user data) |
| `docs/` | Architecture, API, and delivery documentation |

## Prerequisites

- **Node.js** 20+ and npm  
- **Python** 3.11+ (Windows: `py` launcher recommended)  
- **Supabase** project (URL + keys) for local/dev use  
- **Docker Desktop** (optional but required for `npx supabase db pull` / `db dump` against a linked project)

## Environment variables

Do **not** commit real `.env` files. Each package ships an `env.example`:

- `mobile-app/env.example` → copy to `mobile-app/.env`
- `backend-api/env.example` → copy to `backend-api/.env`
- `ai-service/env.example` → copy to `ai-service/.env`

For local dev, point `backend-api` at the AI service URL you actually run (default in this repo: **http://127.0.0.1:8010**).

## Quick start (three terminals)

**1. Backend API** (`http://localhost:3000`)

```bash
cd backend-api
npm install
npm run dev
```

**2. AI service** (`http://127.0.0.1:8010`)

```bash
cd ai-service
pip install -r requirements.txt
py -m uvicorn main:app --reload --host 127.0.0.1 --port 8010
```

**3. Mobile app** (Expo)

```bash
cd mobile-app
npm install
npm start
```

Health checks: API `http://localhost:3000/health`, AI `http://127.0.0.1:8010/health`.

## VS Code: start / stop all services

From the command palette (**Ctrl+Shift+P**):

- **Tasks: Run Task** → `bbbb1` — starts Backend API, Mobile App, and AI Service in parallel (see `.vscode/tasks.json`).
- **Tasks: Run Task** → `bbbb2` — stops services (ports + Node/Expo/Python processes via `.vscode/stop-services.ps1`).

## Database schema (no data)

A **public schema only** export lives at:

`supabase/schema.public.sql`

Apply it in a fresh Supabase project via **SQL Editor** (or your migration pipeline). It does not include production data.

## Contributing and quality gates

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for checks, tests, Cypress E2E, and commit conventions.

## Additional documentation (master delivery)

Structured docs (sections 0–7):

- [docs/00_PROJECT_INFO.md](docs/00_PROJECT_INFO.md)
- [docs/01_SYSTEM_ARCHITECTURE.md](docs/01_SYSTEM_ARCHITECTURE.md)
- [docs/02_DATA_MODEL.md](docs/02_DATA_MODEL.md)
- [docs/03_API_SPEC.md](docs/03_API_SPEC.md)
- [docs/04_USER_STORIES.md](docs/04_USER_STORIES.md)
- [docs/05_TICKETS.md](docs/05_TICKETS.md)
- [docs/06_PULL_REQUESTS.md](docs/06_PULL_REQUESTS.md)

Screenshots live under `screenshots/`.

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE).

## Security

See [SECURITY.md](SECURITY.md) for reporting issues responsibly.
