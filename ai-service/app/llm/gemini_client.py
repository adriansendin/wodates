"""
Gemini Client - Adapter for Google Gemini LLM API

Implements the LLMClient protocol using Google Gemini's generateContent endpoint.
This adapter translates the generic LLM contract to Gemini-specific API calls.
"""

import asyncio
import logging
from typing import Any

import httpx

from app.core.settings import settings

logger = logging.getLogger(__name__)


class GeminiClient:
    """
    Gemini adapter implementing the LLMClient protocol.

    Uses Google Gemini's generateContent endpoint for text generation
    and v1beta embedContent endpoint for embeddings.
    """

    BASE_URL = "https://generativelanguage.googleapis.com/v1"
    BASE_URL_V1BETA = "https://generativelanguage.googleapis.com/v1beta"

    def __init__(self):
        """
        Initialize Gemini client with API key and configuration.

        Raises:
            ValueError: If GEMINI_API_KEY is not configured
        """
        if not settings.gemini_api_key:
            raise ValueError(
                "GEMINI_API_KEY is required for Gemini provider. "
                "Please set GEMINI_API_KEY environment variable."
            )

        self.api_key = settings.gemini_api_key
        self.default_model = settings.gemini_model
        self.timeout = settings.gemini_timeout / 1000  # ms → seconds

        logger.debug(
            f"GeminiClient initialized: model='{self.default_model}', "
            f"timeout={self.timeout}s"
        )

    def _build_url(self, endpoint: str, use_v1beta: bool = False) -> str:
        """
        Build a full URL for Gemini API endpoint.

        Args:
            endpoint: API endpoint path (e.g., '/models/{model}:generateContent')
            use_v1beta: If True, use v1beta base URL instead of v1

        Returns:
            Full URL with API key query parameter
        """
        base_url = self.BASE_URL_V1BETA if use_v1beta else self.BASE_URL
        url = f"{base_url}{endpoint}"
        return f"{url}?key={self.api_key}"

    async def _retry_request(
        self,
        client: httpx.AsyncClient,
        method: str,
        url: str,
        max_retries: int = 2,
        **kwargs: Any,
    ) -> httpx.Response:
        """
        Execute HTTP request with retry logic for 429 and 5xx errors.

        Args:
            client: HTTP client instance
            method: HTTP method ('POST', 'GET', etc.)
            url: Request URL
            max_retries: Maximum number of retries
            **kwargs: Additional arguments to pass to request

        Returns:
            HTTP response

        Raises:
            httpx.HTTPStatusError: If request fails after retries
        """
        last_exception: Exception | None = None
        for attempt in range(max_retries + 1):
            try:
                response = await client.request(method, url, **kwargs)
                # Retry on 429 (rate limit) and 5xx (server errors)
                if response.status_code in (429, 500, 502, 503, 504):
                    if attempt < max_retries:
                        wait_time = 2 ** attempt  # Exponential backoff
                        logger.warning(
                            f"Gemini API returned {response.status_code}, "
                            f"retrying in {wait_time}s (attempt {attempt + 1}/{max_retries + 1})"
                        )
                        await asyncio.sleep(wait_time)
                        continue
                response.raise_for_status()
                return response
            except httpx.HTTPStatusError as e:
                last_exception = e
                if e.response and e.response.status_code in (429, 500, 502, 503, 504):
                    if attempt < max_retries:
                        wait_time = 2 ** attempt
                        logger.warning(
                            f"Gemini API error {e.response.status_code}, "
                            f"retrying in {wait_time}s (attempt {attempt + 1}/{max_retries + 1})"
                        )
                        await asyncio.sleep(wait_time)
                        continue
                raise
            except httpx.RequestError as e:
                last_exception = e
                if attempt < max_retries:
                    wait_time = 2 ** attempt
                    logger.warning(
                        f"Gemini API connection error, "
                        f"retrying in {wait_time}s (attempt {attempt + 1}/{max_retries + 1})"
                    )
                    await asyncio.sleep(wait_time)
                    continue
                raise

        # If we get here, all retries failed
        if last_exception:
            raise last_exception
        raise RuntimeError("Request failed after retries")

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
        Generate text using Gemini generateContent endpoint.

        Implements the LLMClient protocol, using Gemini's REST API.
        Converts messages format to Gemini's contents format.

        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model name (defaults to configured model)
            system: Optional system instructions (added as first user message)
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            top_p: Top-p sampling parameter (not used by Gemini, ignored)
            timeout: Request timeout in seconds

        Returns:
            Generated text response

        Raises:
            httpx.HTTPStatusError: If the HTTP request fails
            ValueError: If the response format is invalid
        """
        model = model or self.default_model
        timeout_seconds = float(timeout or self.timeout)
        temperature_value = (
            temperature if temperature is not None else settings.gemini_temperature
        )
        max_output_tokens = (
            max_tokens if max_tokens is not None else settings.gemini_max_output_tokens
        )

        # Convert messages to Gemini format
        # Gemini uses "contents" array with "role" and "parts" containing "text"
        # Roles: "user" or "model" (assistant)
        # Note: Developer API doesn't support systemInstruction, so we prepend system to first user message
        contents: list[dict[str, Any]] = []

        # Convert conversation messages to Gemini format
        first_user_message = True
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            # Map "assistant" role to "model" for Gemini
            gemini_role = "model" if role == "assistant" else "user"

            # Prepend system prompt to first user message if provided
            if system and gemini_role == "user" and first_user_message:
                logger.info(
                    f"GeminiClient.chat: Prepending system message to first user message, "
                    f"system_length={len(system)}, preview={system[:200]}"
                )
                content = f"SYSTEM:\n{system}\n\nUSER:\n{content}"
                first_user_message = False
            elif gemini_role == "user":
                first_user_message = False

            contents.append({
                "role": gemini_role,
                "parts": [{"text": content}]
            })

        # If no messages but system prompt exists, add user message with system prompt
        if not contents and system:
            logger.info(
                f"GeminiClient.chat: Adding system message as user message, "
                f"system_length={len(system)}, preview={system[:200]}"
            )
            contents.append({
                "role": "user",
                "parts": [{"text": f"SYSTEM:\n{system}\n\nUSER:\n"}]
            })

        # Build payload for generateContent
        payload: dict[str, Any] = {
            "contents": contents,
        }

        # Add generation config
        generation_config: dict[str, Any] = {}
        if temperature_value is not None:
            generation_config["temperature"] = temperature_value
        if max_output_tokens is not None:
            generation_config["maxOutputTokens"] = max_output_tokens

        if generation_config:
            payload["generationConfig"] = generation_config

        url = self._build_url(f"/models/{model}:generateContent")

        logger.info(
            f"Calling Gemini generateContent: model='{model}', "
            f"contents_count={len(contents)}"
        )

        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            try:
                response = await self._retry_request(
                    client, "POST", url, json=payload
                )
            except httpx.HTTPStatusError as e:
                # Log error without leaking API key or prompt content
                error_detail = ""
                if e.response:
                    try:
                        error_body = e.response.json()
                        # Remove sensitive data from error logging
                        error_detail = f", error={error_body.get('error', {}).get('message', 'Unknown error')}"
                    except Exception:
                        error_detail = f", status={e.response.status_code}"

                logger.error(
                    f"Gemini API request failed: method=POST, "
                    f"model='{model}', status_code={e.response.status_code if e.response else 'N/A'}{error_detail}"
                )
                raise
            except httpx.RequestError as e:
                logger.error(
                    f"Gemini API connection error: model='{model}', error={str(e)}"
                )
                raise

            data = response.json()

            # Parse Gemini response: candidates[0].content.parts[0].text
            if "candidates" not in data or not data["candidates"]:
                raise ValueError(
                    "Invalid response format from Gemini: expected 'candidates' array"
                )

            candidate = data["candidates"][0]
            if "content" not in candidate or "parts" not in candidate["content"]:
                raise ValueError(
                    "Invalid response format from Gemini: expected 'content.parts' in candidate"
                )

            parts = candidate["content"]["parts"]
            if not parts or "text" not in parts[0]:
                raise ValueError(
                    "Invalid response format from Gemini: expected 'text' in parts[0]"
                )

            content = parts[0]["text"]
            if not isinstance(content, str):
                raise ValueError(
                    "Invalid response format from Gemini: expected 'text' to be a string"
                )

            return content

    async def generate_embedding(
        self,
        text: str,
        model: str | None = None,
        timeout: float | None = None,
    ) -> list[float]:
        """
        Generate an embedding for the given text.

        Implements the LLMClient protocol for embeddings.
        Uses Gemini's v1beta embedContent endpoint.

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
        model = model or settings.gemini_embedding_model
        timeout_seconds = float(timeout or self.timeout)

        # Gemini embeddings use v1beta embedContent endpoint
        payload = {
            "content": {"parts": [{"text": text}]}
        }

        url = self._build_url(f"/models/{model}:embedContent", use_v1beta=True)

        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            try:
                response = await self._retry_request(
                    client, "POST", url, json=payload
                )
            except httpx.HTTPStatusError as e:
                error_detail = ""
                if e.response:
                    try:
                        error_body = e.response.json()
                        error_detail = f", error={error_body.get('error', {}).get('message', 'Unknown error')}"
                    except Exception:
                        error_detail = f", status={e.response.status_code}"

                logger.error(
                    f"Gemini embeddings API request failed: model='{model}'{error_detail}"
                )
                raise
            except httpx.RequestError as e:
                logger.error(
                    f"Gemini embeddings API connection error: model='{model}', error={str(e)}"
                )
                raise

            data = response.json()

            # Parse Gemini embeddings response from embedContent endpoint
            # Response format: {"embedding": {"values": [...]}}
            if "embedding" not in data:
                raise ValueError(
                    "Invalid response format from Gemini embeddings: expected 'embedding' field"
                )

            embedding_obj = data["embedding"]
            if "values" not in embedding_obj:
                raise ValueError(
                    "Invalid response format from Gemini embeddings: expected 'values' in embedding"
                )

            embedding = embedding_obj["values"]
            if not isinstance(embedding, list):
                raise ValueError(
                    "Invalid response format from Gemini embeddings: expected 'values' to be a list"
                )

            # Validate that all elements are numbers
            if not all(isinstance(x, (int, float)) for x in embedding):
                raise ValueError(
                    "Invalid response format from Gemini embeddings: expected all values to be numbers"
                )

            return [float(x) for x in embedding]

    async def health_check(self) -> bool:
        """
        Check if Gemini service is available.

        Returns:
            True if Gemini API is reachable, False otherwise
        """
        try:
            # Try to list models as a health check
            url = self._build_url("/models")
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url)
                return response.status_code == 200
        except Exception as e:
            logger.warning(f"Gemini health check failed: {str(e)}")
            return False
