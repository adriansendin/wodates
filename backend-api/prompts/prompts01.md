WODATES v0.1 — Agent Build Prompt (Condensed)
ROLE

You are a pragmatic senior full-stack engineer (Clean Architecture, React Native, Node.js, TypeScript). Ship working software, never break core principles.

OBJECTIVE

Create a monorepo with:

/mobile-app: Expo React Native (SDK 52+, TypeScript)

/backend-api: Fastify (Node 20+, TypeScript)

/docs: minimal architecture + API contracts

Scope v0.1 = local/in-memory data, mocked auth, Supabase prepared (interfaces only, NOT implemented).

ARCHITECTURE (MANDATORY)

Clean Architecture + Ports & Adapters in both projects.

Folder layout (per project):

src/
  domain/      # entities, use-cases, repo interfaces, zod schemas, domain errors
  data/        # repo impls, data-sources (AsyncStorage/InMemory now, Supabase TODO), mappers, seeds
  app/         # UI (mobile: screens/components/stores/navigation) or HTTP (backend: routes/controllers/middleware/plugins)


Dependency rule: domain → knows nothing outside; data → depends on domain only; app → depends on domain and data.

Type safety & validation: TS strict; Zod at all boundaries (API req/res, forms, env, storage).

Error handling: Result<T,E> (no throws from use-cases). Map domain errors→HTTP in backend.

State (mobile): Zustand slices (auth, profile, feed, matches, chat). UI calls use-cases, never repos directly.

Supabase-ready: add Supabase*Repository stubs (method signatures + TODO).

FEATURES (MVP)

Auth (mock): email/password; issue fake JWT in memory (no OAuth).

Profile: name, birthDate, gender, bio, 1 photo URL, location stub; view/edit.

Preferences: ageMin/ageMax, gender filter, distance stub.

Feed: swipeable cards (like / pass). Exclude already liked/passed.

Matches: create match on mutual like; list with last message preview.

Chat: text-only messages per match; polling every 5s; pagination (50/page).

DELIVERABLES

Monorepo structure:

wodates/
  mobile-app/   (src/domain, src/data, src/app, tsconfig, eslint, prettier, .env.example, README)
  backend-api/  (src/domain, src/data, src/app, tsconfig, eslint, prettier, .env.example, README)
  docs/         (README.md, API.md, ARCHITECTURE.md, openapi.json)
  .husky/       (pre-commit: lint+format)
  .gitignore
  README.md     (root quick start)


Backend API (all under /api/v1):
POST /auth/register, POST /auth/login, POST /auth/refresh, POST /auth/logout
GET /profile, PUT /profile, PUT /preferences
GET /feed?limit&offset, POST /likes, POST /passes
GET /matches
GET /chats/:matchId/messages?limit&before, POST /chats/:matchId/messages
Use Fastify + @fastify/type-provider-zod, @fastify/swagger, @fastify/rate-limit, @fastify/cors, pino.

Data sources v0.1: in-memory (backend) and AsyncStorage (mobile). Seed 10 demo users (data/seeds/demo-users.ts).

Tests (min 2):
Backend (vitest): LikeUser, SendMessage (happy path + error path).
Mobile (jest): one store test (e.g., authStore).

OpenAPI generated and served at /documentation.

.env.example for both apps; API_URL in mobile points to backend.

Constraints: one profile photo, text-only chat, no realtime (polling), no Supabase yet.

Success = both apps run; feed→like→match→chat flows work with seed data; OpenAPI available; tests pass; README quick-start is clear.