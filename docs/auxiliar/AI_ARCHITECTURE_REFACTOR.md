# AI Architecture Refactor - Three-Layer Design

## Overview

This document describes the refactored AI architecture for the Wodates backend, implementing a clean separation of concerns with three distinct layers:

1. **`ai/core`** - Model abstractions (how we call AI models)
2. **`ai/chat`** - Doc Love online chat orchestration
3. **`ai/profile`** - Long-term personality/memory & embeddings

## Architecture Layers

### 1. `ai/core` - Model Abstractions

**Purpose**: Abstract how we call AI models, not business logic.

**Location**: `backend-api/src/app/ai/core/`

**Interfaces**:
- `ChatModel` - For real-time conversational AI (Doc Love chat)
- `SummarizerModel` - For generating/updating user personality summaries
- `EmbeddingModel` - For generating vector embeddings from text

**Implementations**:
- `ChatModelOllama` / `ChatModelOpenAI` - Chat model providers
- `SummarizerModelOllama` - Summary generation (OpenAI version can be added later)
- `EmbeddingModelOllama` / `EmbeddingModelOpenAI` - Embedding providers

**Factory**: `ai/core/config.ts` - Creates model instances based on `AI_PROVIDER` env var

### 2. `ai/chat` - Doc Love Chat Orchestration

**Purpose**: Handles real-time chat conversations with Doc Love.

**Location**: `backend-api/src/app/ai/chat/`

**Service**: `DocLoveChatService`
- Detects Doc Love conversations
- Builds prompts with conversation history
- Calls `ChatModel` to generate responses
- Persists bot replies in `messages` table

**Integration**: Called from `SendMessage` use case when a user sends a message to Doc Love.

### 3. `ai/profile` - Long-Term Memory & Embeddings

**Purpose**: Builds and maintains user personality summaries asynchronously.

**Location**: `backend-api/src/app/ai/profile/`

**Service**: `UserProfileAIService`
- Collects user conversations (Doc Love, user-to-user, imported)
- Generates/updates textual summaries using `SummarizerModel`
- Generates embeddings using `EmbeddingModel`
- Stores summaries and embeddings in `user_profile_summaries` table

**Repository**: `UserProfileSummaryRepository` (interface) / `SupabaseUserProfileSummaryRepository` (implementation)

**Database**: `user_profile_summaries` table (see migration SQL)

## Database Schema

### `user_profile_summaries` Table

```sql
CREATE TABLE public.user_profile_summaries (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id),
  summary text NOT NULL,
  embedding vector(1536), -- or text[] as fallback
  provider text NOT NULL,
  model text,
  dimension integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);
```

See `docs/db/2025-01-XX_create_user_profile_summaries_table.sql` for full migration.

## Migration from Old Architecture

### Old Structure (Deprecated)
- `ai/AIService` - Orchestrator
- `ai/providers/IAProvider` - Single interface for all AI operations
- `services/doc-love-service.ts` - Mixed chat and AI logic

### New Structure
- `ai/core/*` - Model interfaces and implementations
- `ai/chat/DocLoveChatService` - Chat-specific orchestration
- `ai/profile/UserProfileAIService` - Profile/memory orchestration

### Backward Compatibility

The old `DocLoveService` is still present but deprecated. The new `DocLoveChatService` provides the same interface, so `SendMessage` continues to work without changes.

## Usage

### Doc Love Chat (Online)

Doc Love chat continues to work as before. When a user sends a message to Doc Love:

1. `SendMessage` use case saves the message
2. Detects if it's a Doc Love conversation
3. Calls `DocLoveChatService.generateAndSaveReply()`
4. Service builds prompt and calls `ChatModel`
5. Bot reply is saved as a message

### User Profile Summaries (Async)

To build/update a user's profile summary (should be done asynchronously via jobs/cron):

```typescript
const userProfileAIService = new UserProfileAIService(
  summarizerModel,
  embeddingModel,
  summaryRepository,
  messageRepository,
  matchRepository,
  userRepository,
  docLoveHelper,
  logger,
);

// Build or update summary for a user
await userProfileAIService.buildOrUpdateSummary(userId, {
  includeDocLoveChats: true,
  includeUserChats: true,
  includeImportedConversations: true,
});
```

### Getting User Summary

```typescript
const summaryResult = await userProfileAIService.getSummary(userId);
if (summaryResult.success && summaryResult.data) {
  const summary = summaryResult.data.summary;
  const embedding = summaryResult.data.embedding;
  // Use for feed ranking, matching, etc.
}
```

## Configuration

Environment variables (same as before):

- `AI_PROVIDER` - `ollama` or `openai` (default: `ollama` in dev, `openai` in prod)
- `AI_MODEL` - Model name (e.g., `llama3.2:1b` for Ollama)
- `OLLAMA_URL` - Ollama API URL (default: `http://localhost:11434`)
- `OPENAI_API_KEY` - Required if using OpenAI
- `OPENAI_EMBEDDING_MODEL` - Embedding model (default: `text-embedding-3-small`)
- `OPENAI_EMBEDDING_DIMENSION` - Embedding dimension (default: `1536`)

## Future Enhancements

1. **LangChain/LangGraph Integration**: Can be added to `ai/core` providers without affecting other layers
2. **OpenAI Summarizer**: Add `SummarizerModelOpenAI` implementation
3. **Async Jobs**: Set up cron jobs or job queue to periodically update user summaries
4. **Feed Ranking**: Use embeddings for semantic similarity matching in feed
5. **Doc Love Advice**: Use summaries to provide better advice about active chats

## Testing

The architecture maintains backward compatibility, so existing tests should continue to work. New tests should be added for:

- `ai/core` model implementations
- `ai/chat/DocLoveChatService`
- `ai/profile/UserProfileAIService`
- `UserProfileSummaryRepository`

## Notes

- The old `IAProvider` interface is still present for backward compatibility but should not be used for new code
- `DocLoveService` is deprecated in favor of `DocLoveChatService`
- User profile summaries are built asynchronously and should not block request/response paths
- Embeddings can be used for semantic search once pgvector extension is enabled in PostgreSQL

