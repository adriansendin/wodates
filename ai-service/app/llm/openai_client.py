"""
OpenAI Client - Adapter for OpenAI LLM API

Implements the LLMClient protocol using OpenAI's API.
This adapter translates the generic LLM contract to OpenAI-specific API calls.
"""

import logging
from typing import Any

import httpx

from app.core.settings import settings

logger = logging.getLogger(__name__)


class OpenAIClient:
    """
    OpenAI adapter implementing the LLMClient protocol.

    Uses OpenAI's chat completions endpoint for text generation
    and embeddings endpoint for embeddings.
    """

    BASE_URL = "https://api.openai.com/v1"

    def __init__(self):
        """
        Initialize OpenAI client with API key and configuration.

        Raises:
            ValueError: If OPENAI_API_KEY is not configured
        """
        if not settings.openai_api_key:
            raise ValueError(
                "OPENAI_API_KEY is required for OpenAI provider. "
                "Please set OPENAI_API_KEY environment variable."
            )

        self.api_key = settings.openai_api_key
        self.default_model = settings.openai_model
        self.timeout = settings.openai_timeout / 1000  # ms → seconds

        logger.debug(
            f"OpenAIClient initialized: model='{self.default_model}', "
            f"timeout={self.timeout}s"
        )

    def _build_headers(self) -> dict[str, str]:
        """Build headers for OpenAI API requests."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

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
        Generate text using OpenAI's chat completions endpoint.

        Args:
            messages: List of message dicts with 'role' and 'content' keys
            model: Model name (defaults to configured model)
            system: System instructions (added as system message)
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            top_p: Top-p sampling parameter
            timeout: Request timeout in seconds

        Returns:
            Generated text response

        Raises:
            httpx.HTTPStatusError: If the HTTP request fails
            ValueError: If the response format is invalid
        """
        model = model or self.default_model
        timeout_seconds = float(
            timeout if timeout is not None else self.timeout
        )

        # Prepare messages
        openai_messages: list[dict[str, str]] = []

        # Add system message if provided
        if system:
            openai_messages.append({"role": "system", "content": system})

        # Convert messages to OpenAI format
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            # Map roles: OpenAI uses 'user', 'assistant', 'system'
            if role not in ("user", "assistant", "system"):
                role = "user"  # Default to user for unknown roles

            openai_messages.append({"role": role, "content": content})

        # Build payload
        payload: dict[str, Any] = {
            "model": model,
            "messages": openai_messages,
        }

        # Add optional parameters
        if temperature is not None:
            payload["temperature"] = temperature
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        if top_p is not None:
            payload["top_p"] = top_p

        url = f"{self.BASE_URL}/chat/completions"

        logger.info(
            f"Calling OpenAI chat completions: model='{model}', "
            f"messages_count={len(openai_messages)}"
        )

        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            try:
                response = await client.post(
                    url, headers=self._build_headers(), json=payload
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                error_detail = ""
                if e.response:
                    try:
                        error_body = e.response.json()
                        error_detail = (
                            f", error={error_body.get('error', {}).get('message', 'Unknown error')}"
                        )
                    except Exception:
                        error_detail = (
                            f", status={e.response.status_code}"
                        )

                logger.error(
                    f"OpenAI API request failed: method=POST, "
                    f"model='{model}', status_code={e.response.status_code if e.response else 'N/A'}{error_detail}"
                )
                raise
            except httpx.RequestError as e:
                logger.error(
                    f"OpenAI API connection error: model='{model}', error={str(e)}"
                )
                raise

            data = response.json()

            # Parse OpenAI response: choices[0].message.content
            if "choices" not in data or not data["choices"]:
                raise ValueError(
                    "Invalid response format from OpenAI: expected 'choices' array"
                )

            choice = data["choices"][0]
            if "message" not in choice or "content" not in choice["message"]:
                raise ValueError(
                    "Invalid response format from OpenAI: expected 'message.content' in choice"
                )

            content = choice["message"]["content"]
            if not isinstance(content, str):
                raise ValueError(
                    "Invalid response format from OpenAI: expected 'content' to be a string"
                )

            return content

    async def generate_embedding(
        self,
        text: str,
        model: str | None = None,
        timeout: float | None = None,
    ) -> list[float]:
        """
        Generate an embedding for the given text using OpenAI's embeddings endpoint.

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
        model = model or settings.openai_embedding_model
        timeout_seconds = float(
            timeout if timeout is not None else settings.openai_timeout / 1000
        )

        payload = {
            "model": model,
            "input": text,
        }

        url = f"{self.BASE_URL}/embeddings"

        logger.info(
            f"Calling OpenAI embeddings: model='{model}', "
            f"text_length={len(text)}"
        )

        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            try:
                response = await client.post(
                    url, headers=self._build_headers(), json=payload
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                error_detail = ""
                if e.response:
                    try:
                        error_body = e.response.json()
                        error_detail = (
                            f", error={error_body.get('error', {}).get('message', 'Unknown error')}"
                        )
                    except Exception:
                        error_detail = (
                            f", status={e.response.status_code}"
                        )

                logger.error(
                    f"OpenAI embeddings API request failed: model='{model}', "
                    f"status_code={e.response.status_code if e.response else 'N/A'}{error_detail}"
                )
                raise
            except httpx.RequestError as e:
                logger.error(
                    f"OpenAI embeddings API connection error: model='{model}', error={str(e)}"
                )
                raise

            data = response.json()

            # Parse OpenAI response: data[0].embedding
            if "data" not in data or not data["data"]:
                raise ValueError(
                    "Invalid response format from OpenAI embeddings: expected 'data' array"
                )

            embedding_data = data["data"][0]
            if "embedding" not in embedding_data:
                raise ValueError(
                    "Invalid response format from OpenAI embeddings: expected 'embedding' in data[0]"
                )

            embedding = embedding_data["embedding"]
            if not isinstance(embedding, list):
                raise ValueError(
                    "Invalid response format from OpenAI embeddings: expected 'embedding' to be a list"
                )

            # Validate that all elements are numbers
            if not all(isinstance(x, (int, float)) for x in embedding):
                raise ValueError(
                    "Invalid response format from OpenAI embeddings: "
                    "expected all embedding values to be numbers"
                )

            return [float(x) for x in embedding]

    async def health_check(self) -> bool:
        """
        Check if OpenAI service is available.

        Returns:
            True if the service is available, False otherwise
        """
        try:
            # Simple check: try to list models (lightweight endpoint)
            url = f"{self.BASE_URL}/models"
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    url, headers=self._build_headers()
                )
                return response.status_code == 200
        except Exception:
            return False
