"""
Ollama Client - Adapter for Ollama LLM API

Implements the LLMClient protocol using Ollama's /api/chat endpoint.
This adapter translates the generic LLM contract to Ollama-specific API calls.
"""

import logging
import httpx
from typing import Any

from app.core.settings import settings
from app.llm.llm_client import LLMClient

logger = logging.getLogger(__name__)


class OllamaClient:
    """
    Ollama adapter implementing the LLMClient protocol.

    Uses Ollama's modern /api/chat endpoint exclusively for text generation.
    This ensures compatibility with current Ollama installations.
    """

    def __init__(self):
        """
        Initialize Ollama client with normalized base URL.

        The base URL is normalized to ensure consistent URL construction.
        All endpoints are appended to this base URL (e.g., /api/chat, /api/tags).
        """
        # Normalize base URL: remove trailing slashes to ensure clean URL construction
        # This ensures URLs like "http://localhost:11434/api/chat" are built correctly
        raw_base_url = settings.ollama_base_url
        self.base_url = raw_base_url.rstrip("/")
        self.default_model = settings.ollama_model
        self.timeout = settings.ollama_timeout / 1000  # ms → seconds

        # Log the effective base URL once at initialization (debug level)
        logger.debug(
            f"OllamaClient initialized: base_url='{self.base_url}' "
            f"(normalized from '{raw_base_url}')"
        )

    def _build_url(self, endpoint: str) -> str:
        """
        Build a full URL by appending an endpoint to the base URL.

        Ensures consistent URL construction across all methods.
        The endpoint should start with '/' (e.g., '/api/chat').

        Args:
            endpoint: API endpoint path (should start with '/')

        Returns:
            Full URL combining base_url and endpoint

        Examples:
            >>> client._build_url("/api/chat")
            "http://localhost:11434/api/chat"
        """
        # Ensure endpoint starts with '/' for proper URL joining
        if not endpoint.startswith("/"):
            endpoint = "/" + endpoint
        full_url = f"{self.base_url}{endpoint}"

        # Log the constructed URL once at debug level (only for /api/chat to avoid spam)
        if endpoint == "/api/chat":
            logger.debug(
                f"Constructed Ollama URL: base_url='{self.base_url}', "
                f"endpoint='{endpoint}', full_url='{full_url}'"
            )

        return full_url

    async def chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        system: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        top_p: float | None = None,
        timeout: float | None = None,
    ) -> str:
        """
        Generate text using Ollama /api/chat endpoint.

        Implements the LLMClient protocol, using Ollama's modern chat API.
        This method uses /api/chat exclusively, which is the recommended
        and most compatible endpoint for conversational interactions.

        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model name (defaults to configured model)
            system: Optional system instructions (added as system message)
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate (mapped to num_predict)
            top_p: Top-p sampling parameter
            timeout: Request timeout in seconds

        Returns:
            Generated text response

        Raises:
            httpx.HTTPStatusError: If the HTTP request fails
            ValueError: If the response format is invalid
        """
        model = model or self.default_model
        timeout_seconds = float(timeout or self.timeout)

        # Prepare messages for Ollama /api/chat
        # Ollama expects messages with 'role' and 'content' keys
        ollama_messages: list[dict[str, str]] = []

        # Add system message if provided
        if system:
            ollama_messages.append({"role": "system", "content": system})

        # Add conversation messages
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            # Ensure role is valid for Ollama (user, assistant, system)
            if role not in ["user", "assistant", "system"]:
                role = "user"
            ollama_messages.append({"role": role, "content": content})

        # Build payload for /api/chat
        payload: dict[str, Any] = {
            "model": model,
            "messages": ollama_messages,
            "stream": False,
        }

        # Optional generation options (Ollama-specific)
        options: dict[str, Any] = {}
        if temperature is not None:
            options["temperature"] = temperature
        if max_tokens is not None:
            # Ollama uses 'num_predict' instead of 'max_tokens'
            options["num_predict"] = max_tokens
        if top_p is not None:
            options["top_p"] = top_p

        if options:
            payload["options"] = options

        chat_url = self._build_url("/api/chat")
        
        # Log the request details at INFO level for debugging
        logger.info(
            f"Calling Ollama /api/chat: url='{chat_url}', model='{model}', "
            f"base_url='{self.base_url}'"
        )
        
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            try:
                response = await client.post(
                    chat_url,
                    json=payload,
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                # Log detailed error information
                error_detail = ""
                if e.response:
                    try:
                        error_body = e.response.json()
                        error_detail = f", error_body={error_body}"
                    except Exception:
                        error_detail = f", response_text={e.response.text[:200]}"
                
                logger.error(
                    f"Ollama API request failed: method=POST, url='{chat_url}', "
                    f"status_code={e.response.status_code if e.response else 'N/A'}, "
                    f"base_url='{self.base_url}', model='{model}'{error_detail}"
                )
                
                # Provide more helpful error message
                if e.response and e.response.status_code == 404:
                    # Check if model is available
                    model_available = await self.verify_model_available(model)
                    if not model_available:
                        raise ValueError(
                            f"Model '{model}' is not available in Ollama. "
                            f"Please ensure the model is installed: 'ollama pull {model}'"
                        ) from e
                    else:
                        raise ValueError(
                            f"Ollama endpoint '/api/chat' returned 404. "
                            f"This might indicate an issue with Ollama version or configuration. "
                            f"URL attempted: '{chat_url}'"
                        ) from e
                
                raise
            except httpx.RequestError as e:
                # Log network/connection errors
                logger.error(
                    f"Ollama API connection error: url='{chat_url}', "
                    f"base_url='{self.base_url}', model='{model}', error={str(e)}"
                )
                raise

            data = response.json()

            # Ollama /api/chat returns response in 'message.content'
            if "message" not in data or "content" not in data["message"]:
                raise ValueError(
                    "Invalid response format from Ollama /api/chat: "
                    "expected 'message.content' in response"
                )

            return data["message"]["content"]

    async def generate_embedding(
        self,
        text: str,
        model: str | None = None,
        timeout: float | None = None,
    ) -> list[float]:
        """
        Generate an embedding for the given text.

        Implements the LLMClient protocol for embeddings.
        Uses Ollama's /api/embeddings endpoint.

        Args:
            text: Text to generate embedding for
            model: Embedding model name (defaults to configured embedding model)
            timeout: Request timeout in seconds

        Returns:
            Embedding vector as list of floats

        Raises:
            httpx.HTTPStatusError: If the HTTP request fails
            ValueError: If the response format is invalid
        """
        model = model or settings.ollama_embedding_model
        timeout_seconds = float(
            timeout
            if timeout is not None
            else settings.ollama_embedding_timeout / 1000
        )

        payload = {
            "model": model,
            "prompt": text,
        }

        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(
                self._build_url("/api/embeddings"),
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

            if "embedding" not in data:
                raise ValueError("Invalid response format from Ollama embeddings")

            return data["embedding"]

    async def verify_model_available(self, model: str | None = None) -> bool:
        """
        Verify if the specified model is available in Ollama.

        Args:
            model: Model name to check (defaults to configured model)

        Returns:
            True if model is available, False otherwise
        """
        model = model or self.default_model
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(self._build_url("/api/tags"))
                if response.status_code != 200:
                    return False
                data = response.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                return model in models
        except Exception as e:
            logger.warning(f"Failed to verify model availability: {str(e)}")
            return False

    async def health_check(self) -> bool:
        """
        Check if Ollama service is available.

        Returns:
            True if Ollama is reachable, False otherwise
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(self._build_url("/api/tags"))
                return response.status_code == 200
        except Exception as e:
            logger.warning(f"Ollama health check failed: {str(e)}")
            return False
