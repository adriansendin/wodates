"""
Chat Service - Business logic for chat operations

Handles generation of chat responses from conversation messages.
"""

from app.core.settings import settings
from app.llm.llm_client import LLMClient
from app.llm.ollama_client import OllamaClient
from app.schemas.chat import GenerateChatRequest, GenerateChatResponse


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

        # Task-based routing: if task is provided, ai-service owns model selection
        # Backward compatibility: if no task, use existing behavior (request.model or default)
        if request.task == "AFFINITY_SENTENCE":
            # Task-based: ai-service selects model and parameters internally
            # Ignore any client-sent model when task is present
            model = settings.ollama_model_affinity
            model_source = "AI_MODEL_AFFINITY (task: AFFINITY_SENTENCE)"
            # Fast, low-risk parameters for affinity sentences
            temperature = 0.3
            max_tokens = 150
            top_p = 0.7
            timeout = 60.0  # 60 seconds (matches backend timeout)
        else:
            # Backward compatibility: use existing behavior
            model = request.model or settings.ollama_model
            model_source = "request" if request.model else "AI_MODEL_DOC_LOVE (default)"
            temperature = settings.ollama_temperature
            max_tokens = settings.ollama_num_predict
            top_p = settings.ollama_top_p
            timeout = settings.ollama_timeout / 1000  # Convert ms to seconds

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
