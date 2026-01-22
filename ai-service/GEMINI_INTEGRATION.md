# Gemini Provider Integration

This document describes the Gemini provider integration added to the ai-service.

## Overview

Google Gemini has been added as a production LLM provider alongside the existing Ollama provider. The integration follows the existing architecture patterns and maintains backward compatibility.

## Configuration

### Environment Variables

Set the following environment variables to use Gemini:

```bash
# Required: Select Gemini as provider
LLM_PROVIDER=gemini

# Required: Gemini API key
GEMINI_API_KEY=your_api_key_here

# Optional: Model configuration
GEMINI_MODEL=gemini-2.0-flash-lite  # Default: gemini-2.0-flash-lite
GEMINI_TEMPERATURE=0.1              # Default: 0.1
GEMINI_MAX_OUTPUT_TOKENS=200        # Default: 200
GEMINI_TIMEOUT=60000                # Default: 60000 (milliseconds)

# Optional: Embeddings configuration
GEMINI_EMBEDDING_MODEL=gemini-embedding-001  # Default: gemini-embedding-001
```

### Provider Selection

- **LLM_PROVIDER=gemini**: Uses Gemini for all text generation tasks (DOC_LOVE, PROFILE_CHATS_TO_RESUME, PROFILE_MERGE_RESUMES, AFFINITY)
- **LLM_PROVIDER=ollama** or unset: Uses Ollama (existing behavior)
- **EMBEDDINGS_PROVIDER**: Independent setting for embedding generation (defaults to LLM_PROVIDER if not set)
  - Can be set separately to use different providers for embeddings vs chat/text
  - Example: `LLM_PROVIDER=gemini EMBEDDINGS_PROVIDER=openai` uses Gemini for chat, OpenAI for embeddings

## Files Changed

### New Files
- `app/llm/gemini_client.py`: Gemini client implementation
- `app/llm/llm_factory.py`: Factory function for provider selection
- `scripts/test_gemini.py`: Simple test script for Gemini integration
- `GEMINI_INTEGRATION.md`: This documentation file

### Modified Files
- `app/core/settings.py`: Added Gemini configuration settings
- `app/services/chat_service.py`: Updated to use factory and provider-aware model selection
- `app/services/agent_service.py`: Updated to use factory and provider-aware settings
- `app/services/profile_service.py`: Updated to use factory and provider-aware settings
- `app/services/embedding_service.py`: Updated to use factory and provider-aware model selection
- `app/services/explanation_service.py`: Updated to use factory and provider-aware settings

## Architecture

The integration follows the existing patterns:

1. **LLMClient Protocol**: GeminiClient implements the same `LLMClient` protocol as OllamaClient
2. **Factory Pattern**: `create_llm_client()` selects the appropriate provider based on `LLM_PROVIDER`
3. **Service Layer**: All services use the factory to get the LLM client, maintaining the same interface
4. **Configuration**: All settings are environment-based, following the existing pattern

## Features

### Text Generation
- Supports all text generation tasks:
  - DOC_LOVE (agent conversations)
  - PROFILE_CHATS_TO_RESUME (profile generation)
  - PROFILE_MERGE_RESUMES (profile merging)
  - AFFINITY (affinity sentences)
- Proper message format conversion (role-based to Gemini format)
- System instruction support via `systemInstruction` field
- Configurable temperature and max output tokens

### Embeddings
- Supports Gemini embeddings using `gemini-embedding-001`
- Uses `batchEmbedContents` endpoint
- Returns 768-dimensional vectors (same as Ollama's multilingual-e5-base)

### Reliability
- Retry logic: 2 retries with exponential backoff on 429 and 5xx errors
- Timeout configuration: Configurable per-operation timeouts
- Error logging: Clear error messages without leaking API keys or prompts

## Testing

### Quick Test

Run the test script:

```bash
# Set environment variables
export LLM_PROVIDER=gemini
export GEMINI_API_KEY=your_api_key_here

# Run test
python scripts/test_gemini.py
```

### Manual API Test

You can also test via the FastAPI endpoints:

```bash
# Start the service
uvicorn main:app --reload

# Test chat endpoint (in another terminal)
curl -X POST http://localhost:8000/chat/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}],
    "system": "You are a helpful assistant."
  }'
```

### Example Test Call

```python
import asyncio
from app.llm.llm_factory import create_llm_client

async def test():
    client = create_llm_client()
    response = await client.chat(
        messages=[{"role": "user", "content": "Say hello"}],
        system="You are helpful."
    )
    print(response)

asyncio.run(test())
```

## API Endpoints

All existing endpoints work with Gemini when `LLM_PROVIDER=gemini`:

- `POST /chat/generate`: Chat generation
- `POST /agent/next-question`: Agent question generation
- `POST /profile/generate`: Profile generation
- `POST /profile/merge`: Profile merging
- `POST /embeddings/generate`: Embedding generation
- `POST /explanations/generate`: Affinity explanations

## Notes

- **Model Selection**: When using Gemini, the client uses its default model unless explicitly overridden
- **Parameter Mapping**: Some Ollama-specific parameters (like `top_p`) are ignored by Gemini but passed for compatibility
- **Embedding Dimension**: Both Ollama and Gemini embeddings return 768 dimensions, so no changes needed
- **Backward Compatibility**: All existing Ollama functionality remains unchanged when `LLM_PROVIDER` is not set to "gemini"

## Troubleshooting

### "GEMINI_API_KEY is required" error
- Ensure `GEMINI_API_KEY` environment variable is set
- Verify the API key is valid

### "Unsupported LLM provider" error
- Check that `LLM_PROVIDER` is set to exactly "gemini" (case-insensitive)
- Valid values: "gemini", "ollama", or empty string (defaults to ollama)

### Embedding errors
- Verify `GEMINI_EMBEDDING_MODEL` is set correctly (default: "gemini-embedding-001")
- Check API key has permissions for embeddings API

### Timeout errors
- Increase `GEMINI_TIMEOUT` if requests are timing out
- Default is 60000ms (60 seconds)
