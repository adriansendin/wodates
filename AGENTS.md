# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Wodates is a dating app monorepo with three services:

| Service | Dir | Port | Stack | Run command |
|---|---|---|---|---|
| **backend-api** | `backend-api/` | 3000 | Node.js / Fastify / TypeScript | `npm run dev` |
| **mobile-app** | `mobile-app/` | 8081 | Expo / React Native / TypeScript | `npx expo start --web` |
| **ai-service** | `ai-service/` | 8000 | Python / FastAPI | `source .venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload` |

### Environment variables

Each service needs a `.env` file. Key variables:

- **backend-api**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DOC_LOVE_ID` (UUID), `AI_PROVIDER=ai-service`, `AI_SERVICE_BASE_URL=http://localhost:8000`
- **mobile-app**: `EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **ai-service**: `LLM_PROVIDER` (ollama/gemini/openai), plus the corresponding API key if using a cloud provider

The backend **requires** valid Supabase credentials to handle any data requests. Without them, the server starts and responds to `/health` but all data operations fail.

### Running tests

- **backend-api**: `npm test` (vitest, 41 tests, no Supabase required)
- **mobile-app**: `npm test` (jest-expo, 23 tests, no Supabase required)
- **ai-service**: `source .venv/bin/activate && pytest tests/ -v` (11 tests, no LLM required)

### Running linters

- **backend-api**: `npm run lint` (ESLint)
- **mobile-app**: `npm run lint` (ESLint)
- **ai-service**: `source .venv/bin/activate && ruff check app main.py`

### Gotchas

- The backend startup guard **requires** `AI_PROVIDER=ai-service` in `.env`; other values cause a hard crash.
- The backend startup guard **requires** `DOC_LOVE_ID` to be a valid UUID format (not just any string).
- The mobile-app `web` npm script uses `powershell`, which doesn't work on Linux. Use `EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0 REACT_NATIVE_PACKAGER_HOSTNAME=0.0.0.0 npx expo start --web --host lan -c` instead.
- The ai-service Python venv lives at `ai-service/.venv`; always activate it before running Python commands.
- All unit/integration tests pass without external services (Supabase, LLM providers); they use in-memory fakes.
