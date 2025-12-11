# WODATES Architecture Guide

This document outlines the system architecture and design decisions for the WODATES dating app.

## Overview

WODATES follows Clean Architecture principles with Ports & Adapters pattern, implemented consistently across both the mobile app and backend API.

## Architecture Principles

### Clean Architecture
- **Domain Layer**: Pure business logic, no external dependencies
- **Data Layer**: Repository implementations, external data sources
- **App Layer**: UI (mobile) or HTTP (backend) interfaces

### Dependency Rule
- Domain → knows nothing outside
- Data → depends on domain only  
- App → depends on domain and data

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Backend API   │
│                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │    App      │ │    │ │    App      │ │
│ │   Layer     │ │    │ │   Layer     │ │
│ │ (UI/State)  │ │    │ │ (HTTP/Routes)│ │
│ └─────────────┘ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │    Data     │ │    │ │    Data     │ │
│ │   Layer     │◄┼────┼►│   Layer     │ │
│ │(API/Storage)│ │    │ │(Repositories)│ │
│ └─────────────┘ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Domain   │ │    │ │   Domain    │ │
│ │   Layer    │ │    │ │   Layer     │ │
│ │(Entities/  │ │    │ │(Entities/   │ │
│ │Use Cases)  │ │    │ │Use Cases)  │ │
│ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘
```

## Backend Architecture

### Domain Layer
- **Entities**: User, Match, Message, Like, Pass, Preferences
- **Use Cases**: RegisterUser, LoginUser, LikeUser, SendMessage, etc.
- **Repository Interfaces**: Abstract contracts for data access
- **Result Type**: Error handling without exceptions

### Data Layer
- **In-Memory Repositories**: v0.1 implementation
- **Supabase Repositories**: Future implementation (interfaces only)
- **Seed Data**: Demo users and preferences

### App Layer
- **Fastify Server**: HTTP framework
- **Controllers**: Request/response handling
- **Middleware**: Authentication, CORS, rate limiting
- **OpenAPI**: Auto-generated documentation

## Mobile Architecture

### Domain Layer
- **Entities**: Same as backend
- **Stores**: Zustand state management
- **Result Type**: Consistent error handling

### Data Layer
- **API Clients**: HTTP communication with backend
- **AsyncStorage**: Local data persistence
- **Repository Pattern**: Abstract data access

### App Layer
- **React Native**: UI framework
- **Navigation**: Stack and tab navigation
- **Screens**: Login, Feed, Matches, Chat
- **Components**: Reusable UI elements

## Data Flow

### Authentication Flow
1. User enters credentials
2. Mobile app calls `/auth/login`
3. Backend validates and returns JWT
4. Mobile app stores token in AsyncStorage
5. Subsequent requests include Bearer token

### Feed Flow
1. Mobile app calls `/feed` with pagination
2. Backend filters users based on preferences
3. User swipes (like/pass)
4. Mobile app calls `/likes` or `/passes`
5. Backend creates like/pass record
6. If mutual like, backend creates match

### Chat Flow
1. User opens match conversation
2. Mobile app calls `/chats/:matchId/messages`
3. User sends message
4. Mobile app calls `POST /chats/:matchId/messages`
5. Polling every 5 seconds for new messages

## State Management

### Mobile App (Zustand)
- **authStore**: User session and tokens
- **feedStore**: Feed users and swiping state
- **matchesStore**: User matches and previews
- **chatStore**: Messages and chat state

### Backend (In-Memory)
- **Repositories**: In-memory data storage
- **Seed Data**: 10 demo users with preferences
- **Session Management**: JWT tokens

## Error Handling

### Result Pattern
```typescript
type Result<T, E> = Success<T> | Failure<E>;

// Use cases return Result, never throw
const result = await useCase.execute();
if (result.success) {
  // Handle success
} else {
  // Handle error
}
```

### Domain Errors
- **ValidationError**: Invalid input data
- **NotFoundError**: Resource not found
- **UnauthorizedError**: Authentication required
- **ConflictError**: Resource already exists

## Security

### Authentication
- JWT tokens for API access
- Bearer token in Authorization header
- Token refresh mechanism

### Validation
- Zod schemas at all boundaries
- Input validation on all endpoints
- Type safety with TypeScript strict mode

### Rate Limiting
- 100 requests per minute per IP
- Configurable limits via environment

## Testing Strategy

### Backend Tests
- **Unit Tests**: Use cases and repositories
- **Integration Tests**: API endpoints
- **Coverage**: Minimum 80% for critical paths

### Mobile Tests
- **Store Tests**: Zustand state management
- **Component Tests**: Screen rendering
- **API Tests**: Client integration

## Future Considerations

### Supabase Integration
- Replace in-memory repositories
- Real-time subscriptions
- Row Level Security (RLS)
- Database migrations

### Scalability
- Horizontal scaling with load balancers
- Database connection pooling
- Caching with Redis
- CDN for static assets

### Monitoring
- Application performance monitoring
- Error tracking and alerting
- User analytics and metrics
- Health checks and uptime monitoring

## Development Guidelines

### Code Organization
- Feature-based folder structure
- Consistent naming conventions
- Clear separation of concerns
- Comprehensive documentation

### Git Workflow
- Feature branches from main
- Conventional commit messages
- Pull request reviews
- Automated testing

### Code Quality
- ESLint and Prettier configuration
- TypeScript strict mode
- Comprehensive test coverage
- Regular dependency updates
