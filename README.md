# WODATES v0.1 - Dating App MVP

A Clean Architecture monorepo with React Native mobile app and Node.js backend API.

## Quick Start

### Prerequisites
- Node.js 20+
- npm or yarn
- Expo CLI (for mobile development)

### Backend API
```bash
cd backend-api
npm install
npm run dev
```
API runs on http://localhost:3000
OpenAPI docs: http://localhost:3000/documentation

### Mobile App
```bash
cd mobile-app
npm install
npm start
```

## Project Structure

```
wodates/
├── mobile-app/     # Expo React Native app
├── backend-api/    # Fastify Node.js API
├── docs/          # Architecture and API documentation
└── README.md      # This file
```

## Architecture

Both projects follow Clean Architecture with Ports & Adapters:
- `domain/` - Entities, use-cases, repository interfaces (no external deps)
- `data/` - Repository implementations, data sources, mappers
- `app/` - UI (mobile) or HTTP (backend) layer

## Features (v0.1)

- Mock authentication with JWT
- User profiles with preferences
- **Avatar uploads** (NEW)
  - Supabase Storage integration
  - Automatic image compression (max 500KB)
  - Camera and gallery support
  - Integrated in registration flow
- Swipeable feed with like/pass
- Matches and text-only chat
- Polling-based real-time updates
- In-memory data storage (backend) / AsyncStorage (mobile)

## Development

- TypeScript strict mode
- Zod validation at all boundaries
- ESLint + Prettier
- Vitest (backend) + Jest (mobile) testing
- OpenAPI documentation

## Recent Updates

### Avatar Upload Feature (October 2025)
Complete implementation of profile picture uploads with:
- Step 6 added to registration flow
- Profile screen avatar update
- Automatic compression for large images
- Supabase Storage integration

See `/docs/AVATAR_UPLOAD_SETUP.md` for setup instructions and `CHANGELOG_AVATAR_FEATURE.md` for implementation details.
