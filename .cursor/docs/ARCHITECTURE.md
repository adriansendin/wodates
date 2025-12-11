# Wodates Architecture (v0.1)

## Overview
Wodates v0.1 follows **Clean Architecture + Ports & Adapters** to ensure separation of concerns, testability, and future scalability.

---

## Layered Structure
Each project (mobile-app, backend-api) uses the same three-layer structure:

```
src/
├── domain/      # Pure business logic (framework-agnostic)
│   ├── entities/        # User, Match, Message, Preferences
│   ├── use-cases/       # LikeUser, SendMessage, GetMatches, UpdateProfile
│   ├── repositories/    # IUserRepository, IMatchRepository, IMessageRepository
│   ├── schemas/         # Zod validation schemas
│   └── errors/          # Custom errors: NotFoundError, ValidationError, etc.
│
├── data/        # Implementation details
│   ├── repositories/    # InMemoryUserRepo, InMemoryMatchRepo
│   ├── data-sources/    # AsyncStorage (mobile), InMemory (backend), SupabaseDataSource (TODO)
│   ├── mappers/         # DTO ↔ Entity conversions
│   └── seeds/           # demo-users.ts
│
└── app/         # Framework-specific code
    ├── (mobile) screens, components, navigation, stores
    ├── (backend) routes, controllers, middleware, plugins
    ├── config/          # env.ts (validated with Zod), constants.ts
    └── utils/           # logger, helpers
```

---

## Dependency Rules
- `domain/` must not depend on `data/` or `app/`.  
- `data/` may depend on `domain/`, but never on `app/`.  
- `app/` may depend on both `domain/` and `data/`.  
- Use-cases only know repository interfaces.  

---

## Error Handling
- No `throw` inside use-cases.  
- Use **Result<T,E> pattern**:

```ts
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

- Errors in domain are mapped to HTTP status codes in the backend layer.  

---

## Validation
- All boundaries use **Zod schemas**:
  - API requests/responses  
  - Form inputs in mobile  
  - Environment variables  
  - Local storage I/O  

---

## Backend (Fastify)
- Framework: Fastify 5.x + Node 20  
- Plugins:
  - `@fastify/jwt`, `@fastify/swagger`, `@fastify/rate-limit`, `@fastify/cors` (dev only)  
- Logging: pino (structured JSON)  
- Testing: vitest  
- API versioning: all routes under `/api/v1`.  

---

## Mobile (Expo React Native)
- Framework: Expo SDK 52+  
- State management: Zustand slices (auth, profile, feed, matches, chat)  
- Navigation: React Navigation (stack + tabs)  
- Forms: react-hook-form + Zod resolvers  
- Storage: AsyncStorage for persistence  
- Chat: polling every 5s (WebSockets planned for v0.2).  

---
