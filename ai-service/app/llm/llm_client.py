"""
LLM Client Abstraction

Defines the contract for LLM providers in Wodates.
All LLM interactions should go through this abstraction, not directly to providers.
"""

from typing import Protocol


class LLMClient(Protocol):
    """
    Protocol defining the contract for LLM providers.

    This abstraction allows the system to work with any LLM provider
    (Ollama, OpenAI, Anthropic, etc.) without coupling business logic
    to provider-specific details.
    """

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
        Generate text using a conversational chat interface.

        Args:
            messages: List of message dicts with 'role' and 'content' keys.
                     Roles typically: 'user', 'assistant', 'system'
            model: Model name (provider-specific, optional)
            system: Optional system instructions/prompt
            temperature: Sampling temperature (0.0-2.0, typically)
            max_tokens: Maximum tokens to generate
            top_p: Top-p sampling parameter
            timeout: Request timeout in seconds

        Returns:
            Generated text response as string

        Raises:
            Exception: If the LLM request fails
        """
        ...

    async def generate_embedding(
        self,
        text: str,
        model: str | None = None,
        timeout: float | None = None,
    ) -> list[float]:
        """
        Generate an embedding vector for the given text.

        Args:
            text: Text to generate embedding for
            model: Embedding model name (provider-specific, optional)
            timeout: Request timeout in seconds

        Returns:
            Embedding vector as list of floats

        Raises:
            Exception: If the embedding request fails
        """
        ...

    async def health_check(self) -> bool:
        """
        Check if the LLM service is available and reachable.

        Returns:
            True if the service is available, False otherwise
        """
        ...











