# WODATES Documentation

This directory contains comprehensive documentation for the WODATES dating app project.

## Contents

- [API Documentation](./API.md) - Complete API reference with endpoints and schemas
- [Architecture Guide](./ARCHITECTURE.md) - System architecture and design decisions

## Quick Start

### Backend API
```bash
cd backend-api
npm install
npm run dev
```
- API: http://localhost:3000
- Documentation: http://localhost:3000/documentation

### Mobile App
```bash
cd mobile-app
npm install
npm start
```

## Project Structure

```
wodates/
├── mobile-app/     # React Native mobile application
├── backend-api/    # Fastify Node.js API server
├── docs/          # Project documentation
└── README.md      # Root project overview
```

## Architecture Overview

Both the mobile app and backend API follow Clean Architecture principles:

- **Domain Layer**: Business entities, use-cases, and repository interfaces
- **Data Layer**: Repository implementations, API clients, and data sources
- **App Layer**: UI components (mobile) or HTTP routes (backend)

## Key Features

- **Authentication**: JWT-based auth with refresh tokens
- **User Profiles**: Complete profile management with preferences
- **Feed System**: Swipeable user cards with like/pass functionality
- **Matching**: Mutual likes create matches
- **Messaging**: Real-time chat with polling
- **Offline Support**: Local data persistence

## Technology Stack

### Backend
- Node.js 20+ with TypeScript
- Fastify web framework
- Zod for validation
- OpenAPI documentation
- Vitest for testing

### Mobile
- React Native with Expo
- TypeScript
- Zustand for state management
- React Navigation
- AsyncStorage for persistence
- Jest for testing

## Development Guidelines

- Follow Clean Architecture principles
- Use TypeScript strict mode
- Validate all inputs with Zod
- Write comprehensive tests
- Document all public APIs
- Use conventional commit messages
