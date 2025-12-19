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

        # Generate response using LLM
        response_text = await self.llm_client.chat(
            messages=messages,
            system=request.system,
            temperature=settings.ollama_temperature,
            max_tokens=settings.ollama_num_predict,
            top_p=settings.ollama_top_p,
        )

        # Return the generated content
        return GenerateChatResponse(content=response_text.strip())
