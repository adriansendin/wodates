"""
Chat Service - Business logic for chat operations

Handles generation of chat responses from conversation messages.
"""

from app.core.settings import settings
from app.llm.llm_client import LLMClient
from app.llm.llm_factory import create_llm_client
from app.schemas.chat import GenerateChatRequest, GenerateChatResponse


class ChatService:
    """Service for chat operations."""

    def __init__(self, llm_client: LLMClient | None = None):
        """
        Initialize the chat service.

        Args:
            llm_client: LLM client implementation (defaults to factory-created client)
        """
        self.llm_client: LLMClient = llm_client or create_llm_client()

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

        # Task-based routing: if task is provided, ai-service owns model selection
        # Backward compatibility: if no task, use existing behavior (request.model or default)
        # Provider-aware: use appropriate model based on LLM_PROVIDER
        is_gemini = settings.llm_provider.lower() == "gemini"
        
        if request.task == "AFFINITY_SENTENCE":
            # Task-based: ai-service selects model and parameters internally
            # Ignore any client-sent model when task is present
            # Use provider-appropriate default model (client will use its default if None)
            model = None  # Let client use its default model
            model_source = f"{settings.llm_provider} default (task: AFFINITY_SENTENCE)"
            # Use AFFINITY-specific configuration
            temperature = settings.affinity_temperature
            max_tokens = settings.affinity_max_output_tokens
            top_p = settings.affinity_top_p
            timeout_ms = (
                settings.gemini_timeout
                if is_gemini
                else settings.ollama_model_affinity_timeout
            )
            timeout = timeout_ms / 1000  # Convert ms to seconds
        else:
            # DOC_LOVE task (chat corto) - use DOC_LOVE specific configuration
            model = request.model  # None means use client default
            model_source = "request" if request.model else f"{settings.llm_provider} default"
            temperature = settings.doclove_temperature
            max_tokens = settings.doclove_max_output_tokens
            top_p = settings.doclove_top_p
            timeout_ms = (
                settings.gemini_timeout if is_gemini else settings.ollama_timeout
            )
            timeout = timeout_ms / 1000  # Convert ms to seconds

        # Generate response using LLM
        try:
            # Log system prompt and model for debugging
            import logging
            logger = logging.getLogger(__name__)
            logger.info(
                f"ChatService.generate_chat: "
                f"model='{model}' (from {model_source}), "
                f"task={request.task or 'none'}, "
                f"system_prompt_present={request.system is not None}, "
                f"system_length={len(request.system) if request.system else 0}, "
                f"system_preview={request.system[:200] if request.system else 'N/A'}, "
                f"messages_count={len(messages)}, "
                f"temperature={temperature}, max_tokens={max_tokens}"
            )

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
