# Contributing to Wodates

Thank you for helping improve Wodates. This document describes how to run, verify, and test the monorepo locally.

## Prerequisites

- Node.js **20+**
- Python **3.11+**
- npm
- A Supabase project for development (copy keys into each package’s `.env` from `env.example`)

Optional:

- **Docker Desktop** — required only if you use Supabase CLI commands that pull/dump schema via the CLI’s Postgres image.

## Install dependencies

```bash
cd backend-api && npm install && cd ..
cd mobile-app && npm install && cd ..
cd ai-service && pip install -r requirements.txt && cd ..
```

For Python type-check and lint (same as `check.py`), also install dev tools:

```bash
cd ai-service && pip install -r requirements-dev.txt && cd ..
```

## Run all services (VS Code)

**Ctrl+Shift+P** → **Tasks: Run Task**:

| Task | Purpose |
|------|---------|
| `bbbb1` | Start **Backend API**, **Mobile App**, and **AI Service** in parallel |
| `bbbb2` | Stop those services (script kills common ports and related processes) |

Task definitions: `.vscode/tasks.json`  
Stop script: `.vscode/stop-services.ps1`

## Run services manually

### Backend API

```bash
cd backend-api
npm run dev
```

Default URL: `http://localhost:3000`  
Swagger UI: `http://localhost:3000/documentation`

### AI service

```bash
cd ai-service
py -m uvicorn main:app --reload --host 127.0.0.1 --port 8010
```

Ensure `backend-api/.env` sets `AI_SERVICE_BASE_URL` (or `AI_SERVICE_URL`) to match this host/port.

### Mobile app (Expo)

```bash
cd mobile-app
npm start
```

The `start` script runs Expo with LAN-friendly settings (see `mobile-app/package.json`).

## Verification (before commits)

### AI service (Python)

```bash
cd ai-service
py check.py
```

Runs **mypy** and **ruff** (requires `requirements-dev.txt`).

### Backend API and mobile app (TypeScript)

```bash
cd backend-api
npm run check
```

```bash
cd mobile-app
npm run check
```

### Backend — full gate before a release commit

```bash
cd backend-api
npm run check
npm run build
```

### Mobile — during active development

```bash
cd mobile-app
npm run check
```

## Tests

### Backend unit tests (Vitest)

```bash
cd backend-api
npm test
npm run test:coverage
```

### Backend integration tests

```bash
cd backend-api
npm test -- src/tests/integration/auth
npm test -- src/tests/integration/feed
npm test -- src/tests/integration/chat-user
```

Or the full integration suite:

```bash
cd backend-api
npm test -- src/tests/integration
```

### Mobile unit tests (Jest)

```bash
cd mobile-app
npm test
npm run test:watch
```

### End-to-end (Cypress) — from `mobile-app/`

Start the stack (API + app as needed), then:

```bash
cd mobile-app
npx cypress run --spec "cypress/e2e/registration.cy.ts"
npx cypress run --spec "cypress/e2e/auth.cy.ts"
npx cypress run --spec "cypress/e2e/feed.cy.ts"
npx cypress run --spec "cypress/e2e/chat.cy.ts"
```

Or all E2E specs:

```bash
cd mobile-app
npx cypress run
```

## Database schema

The repo includes a **schema-only** export of the `public` schema:

`supabase/schema.public.sql`

It contains **no application data**. Do not commit `.env` files or database dumps with real user content.

## Secrets and backups

- Never commit `.env` files or folders that hold copies of production secrets (for example a local `env_/` backup directory).  
- Keep real values in a password manager or your hosting provider’s environment settings.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature  
- `fix:` — bug fix  
- `docs:` — documentation only  
- `chore:` — maintenance, tooling, deps  
- `test:` — tests only  
- `refactor:` — code change without behavior change  

Example:

```text
docs: add CONTRIBUTING guide for local dev and tests
```

## Pull requests

- Keep changes focused and described in the PR body.  
- Run the relevant `npm run check` / `py check.py` / tests before requesting review.  
- Never commit secrets; use `env.example` and platform env vars (Railway, Supabase, etc.).
