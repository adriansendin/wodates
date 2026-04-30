# Wodates - Cursor Agent Session (excerpt)

**Context:** building production architecture for a consumer matchmaking app.  
**Tool:** Cursor Agent  
**Format:** sanitized pair-programming excerpt

---

## Session

**Founder**

I want Wodates to stay simple enough for a solo founder, but not turn into a messy prototype. The frontend, backend, and AI parts are already growing. Help me structure this properly for production without overengineering it.

**Cursor Agent**

The architecture should stay pragmatic:

- frontend: UI and client state only;
- backend: business logic, auth flow, chat orchestration, matching rules;
- AI service: isolated layer for LLM calls, embeddings, and profile generation;
- Supabase: auth, database, storage.

In this repo that maps naturally to:

- `mobile-app`: Expo/React Native screens, stores, API clients, upload UX;
- `backend-api`: Fastify routes, use cases, Supabase repositories, jobs;
- `ai-service`: FastAPI endpoints for chat, profiles, merge, embeddings, explanations.

AI must not leak into backend domain logic. It should be a separate service with a strict HTTP contract.

---

**Founder**

Do not introduce heavy frameworks like LangChain. I want to ship fast and keep full control.

**Cursor Agent**

No orchestration frameworks for now.

The backend should communicate with the AI service through a thin HTTP layer. The AI service handles all provider-specific logic. The backend remains the source of truth for product behavior and matching rules.

```ts
export class AiServiceChatClient {
  async generateChat(request: AiServiceChatRequest) {
    if (!AIConfig.enabled) {
      throw new Error('AI functionality is disabled (AI_ENABLED=false)');
    }

    const response = await fetch(`${this.baseUrl}/chat/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`ai-service /chat/generate returned ${response.status}`);
    }

    return await response.json();
  }
}
```

This client should not know about matching, prompts, persistence, users, or Supabase.

Also add a backend startup guard:

```ts
if (process.env.AI_PROVIDER !== 'ai-service') {
  throw new Error("AI_PROVIDER must be 'ai-service'.");
}
```

That prevents production from drifting back into direct provider calls.

---

**Founder**

The feed cannot just be a list of users. It needs to respect preferences, past interactions, and compatibility constraints.

**Cursor Agent**

Start deterministic.

Feed rules should live in the backend:

- exclude self;
- exclude users already liked, passed, matched, or blocked;
- apply the viewer's preferences;
- enforce mutual compatibility constraints;
- exclude bots unless intentionally included;
- return paginated candidates.

AI should not be used in real-time feed generation.

The feed must always work even if AI is down. AI can later improve ranking or explain why two profiles might fit, but it should not decide whether the user gets a feed.

---

**Founder**

Users reveal more in conversations than onboarding. We should build profiles from chat history.

**Cursor Agent**

Design this as an async pipeline, not a request-time LLM call.

```txt
collect chat messages
  -> aggregate conversations per user
  -> send batch to ai-service /profile/generate
  -> generate structured profile
  -> store profile in database
  -> merge with existing consolidated profile when needed
  -> generate embeddings
  -> update public-facing bio
```

In the repo this maps to:

- `GenerateUserProfileFromChats`
- `AiServiceProfileClient`
- `UserAIProfileEmbeddingService`
- `UserBioGenerationService`
- `ProcessUserProfileService`
- scheduled background job with `node-cron`

This must run in the background and never block chat or core flows.

---

**Founder**

Should profile generation run when a user sends a message?

**Cursor Agent**

No. Persist the chat message first. Keep chat fast.

Profile generation can run later through the job pipeline or an explicit "build my profile" action. If one AI step fails, keep any useful progress and retry later.

```ts
if (hasSummary && summaryChanged) {
  try {
    await this.embeddingService.generateEmbeddingFromSummary(userId);
  } catch (err) {
    this.logger?.warn?.(`Embedding generation failed for user ${userId}`);
  }
}
```

The summary is still valuable even if embedding or bio generation fails.

---

**Founder**

The AI service should support local development and production providers.

**Cursor Agent**

Expose product-level endpoints, not provider-level endpoints:

- `/chat/generate`
- `/profile/generate`
- `/profile/merge`
- `/embeddings/generate`
- `/explanations/generate`

Provider selection stays inside `ai-service`:

```py
def create_llm_client() -> LLMClient:
    return _create_client_for_provider(settings.llm_provider, "LLM")

def create_embedding_client() -> LLMClient:
    return _create_client_for_provider(settings.embeddings_provider, "Embeddings")
```

This allows local Ollama during development, Gemini or OpenAI for chat/text generation, and OpenAI `text-embedding-3-small` for 1536-dimensional embeddings.

The AI service should not own database access, auth, authorization, sessions, matching rules, or persistent state. It should validate requests, call the configured provider, normalize responses, and return structured results.

---

**Founder**

UI supports English and Spanish, but AI prompts were mostly Spanish. Could this be solved by only editing `ai-settings.ts`?

**Cursor Agent**

Only partially. You can add English prompt strings there, but something still has to select the right language.

Use a narrow locale and pass it explicitly where prompts are built:

```ts
export type Locale = 'en' | 'es';

export function normalizeLocale(locale?: string | null): Locale {
  if (locale?.toLowerCase().startsWith('es')) return 'es';
  return 'en';
}
```

Implicit global context means fewer parameters but hidden behavior. Explicit `locale` is more plumbing, but easier to test and reason about.

---

**Founder**

What happens if AI is down?

**Cursor Agent**

The system must degrade gracefully:

- chat must still work;
- feed must still work with deterministic logic only;
- profile generation can retry later;
- missing AI outputs must not break the user experience.

Safeguards:

- timeouts on AI calls;
- retryable background jobs;
- `AI_ENABLED=false` feature flag / kill switch;
- fallbacks for missing affinity text;
- partial progress saved during profile processing;
- logs for failed AI steps instead of silent failures.

Key principle:

AI improves the product, but it is never required for core functionality.

---

**Founder**

Summarize the decisions we are keeping.

**Cursor Agent**

- Fastify backend owns business logic and Supabase persistence.
- Supabase owns auth, PostgreSQL data, and storage.
- FastAPI `ai-service` owns LLM calls, embeddings, provider selection, and response normalization.
- Expo/React Native app owns UI, local state, and API consumption.
- Matching starts deterministic.
- AI profile generation is asynchronous and retryable.
- Feed and chat continue working when AI is unavailable.
- No heavy AI orchestration framework until the product actually needs one.
