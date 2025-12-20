"""
Chat Service - Business logic for chat operations

Handles generation of chat responses from conversation messages.
"""

from app.llm.llm_client import LLMClient
from app.llm.ollama_client import OllamaClient
from app.schemas.chat import GenerateChatRequest, GenerateChatResponse
from app.core.settings import settings


class ChatService:
    """Service for chat operations."""

    def __init__(self, llm_client: LLMClient | None = None):
        """
        Initialize the chat service.

        Args:
            llm_client: LLM client implementation (defaults to OllamaClient)
        """
        self.llm_client: LLMClient = llm_client or OllamaClient()

    async def generate_chat(
        self, request: GenerateChatRequest
    ) -> GenerateChatResponse:
        """
        Generate a chat response from conversation messages.

        Args:
            request: Request containing messages and optional system prompt

        Returns:
            Response with generated chat content

        Raises:
            ValueError: If the LLM request fails
            Exception: For other unexpected errors
        """
        # Convert messages to LLM format
        messages = []
        for msg in request.messages:
            messages.append({"role": msg.role, "content": msg.content})

        # Determine which model to use
        # If model is specified in request, use it; otherwise use default
        model = request.model or settings.ollama_model
        
        # Use different parameters for affinity sentences (faster, lower temperature)
        # Check if it's the affinity sentences model
        is_affinity_model = (
            request.model == settings.ollama_model_affinity_sentences
            or request.model == "gemma3:1b"
        )
        
        temperature = 0.3 if is_affinity_model else settings.ollama_temperature
        max_tokens = 150 if is_affinity_model else settings.ollama_num_predict
        top_p = 0.7 if is_affinity_model else settings.ollama_top_p
        # Use timeout for affinity sentences (60 seconds to match backend)
        # Backend has 60s timeout, so ai-service should match
        timeout = (
            60.0 if is_affinity_model else settings.ollama_timeout / 1000
        )  # Convert ms to seconds

        # Generate response using LLM
        try:
            response_text = await self.llm_client.chat(
                messages=messages,
                system=request.system,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=top_p,
                timeout=timeout,
            )

            # Return the generated content
            return GenerateChatResponse(content=response_text.strip())
        except Exception as e:
            # Log error for debugging
            import logging
            logger = logging.getLogger(__name__)
            logger.error(
                f"LLM chat failed: model='{model}', error='{str(e)}'",
                exc_info=True
            )
            # Re-raise to be handled by API endpoint
            raise
