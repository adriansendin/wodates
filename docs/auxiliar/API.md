# WODATES API Documentation

Complete API reference for the WODATES backend service.

## Base URL

```
http://localhost:3000/api/v1
```

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Authentication

#### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "birthDate": "1990-01-01T00:00:00.000Z",
  "gender": "male"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "jwt-token"
}
```

#### POST /auth/login
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "jwt-token"
}
```

#### POST /auth/refresh
Refresh access token.

**Headers:**
```
Authorization: Bearer <current-token>
```

**Response:**
```json
{
  "token": "new-jwt-token"
}
```

#### POST /auth/logout
Logout user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

### Feed

#### GET /feed
Get feed users for swiping.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Number of users to return (default: 10, max: 50)
- `offset` (optional): Number of users to skip (default: 0)

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "name": "Jane Doe",
      "bio": "Love hiking and coffee",
      "photoUrl": "https://example.com/photo.jpg",
      "age": 25
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

#### POST /likes
Like a user.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "targetUserId": "uuid"
}
```

**Response:**
```json
{
  "action": "like",
  "result": {
    "id": "uuid",
    "userId": "uuid",
    "targetUserId": "uuid",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "isMatch": false
}
```

#### POST /passes
Pass on a user.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "targetUserId": "uuid"
}
```

**Response:**
```json
{
  "action": "pass",
  "result": {
    "id": "uuid",
    "userId": "uuid",
    "targetUserId": "uuid",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Chat

#### GET /chats/:matchId/messages
Get messages for a match.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Number of messages to return (default: 50, max: 100)
- `before` (optional): Message ID to fetch messages before

**Response:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "matchId": "uuid",
      "senderId": "uuid",
      "content": "Hello there!",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "before": null,
    "hasMore": false
  }
}
```

#### POST /chats/:matchId/messages
Send a message.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "content": "Hello there!"
}
```

**Response:**
```json
{
  "message": {
    "id": "uuid",
    "matchId": "uuid",
    "senderId": "uuid",
    "content": "Hello there!",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request data",
  "details": {}
}
```

### 401 Unauthorized
```json
{
  "error": "UNAUTHORIZED",
  "message": "Invalid or missing token"
}
```

### 404 Not Found
```json
{
  "error": "NOT_FOUND",
  "message": "Resource not found"
}
```

### 409 Conflict
```json
{
  "error": "CONFLICT",
  "message": "Resource already exists"
}
```

### 500 Internal Server Error
```json
{
  "error": "INTERNAL_ERROR",
  "message": "Internal server error"
}
```

## Rate Limiting

The API implements rate limiting:
- 100 requests per minute per IP
- Rate limit headers included in responses

## OpenAPI Documentation

Interactive API documentation is available at:
```
http://localhost:3000/documentation
```
