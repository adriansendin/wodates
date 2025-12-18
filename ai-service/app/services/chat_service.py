"""
Chat Service - Business logic for chat operations

Handles generation of chat responses (e.g., DocLove conversations).
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

        This is a pure AI primitive: messages → response.
        The service does NOT:
        - Manage conversation state
        - Persist messages
        - Validate user permissions
        - Handle match/conversation logic

        The backend is responsible for:
        - Building the conversation history
        - Providing the system prompt (e.g., DocLove personality)
        - Persisting the response
        - Managing conversation context

        Args:
            request: Request containing messages and optional system prompt

        Returns:
            Response with generated chat message

        Raises:
            Exception: If the chat generation fails
        """
        # Convert messages to LLM format
        llm_messages = [
            {"role": msg.role, "content": msg.content} for msg in request.messages
        ]

        # Generate response using LLM
        response_text = await self.llm_client.chat(
            messages=llm_messages,
            system=request.system,
            temperature=settings.ollama_temperature,
            max_tokens=settings.ollama_num_predict,
            top_p=settings.ollama_top_p,
        )

        return GenerateChatResponse(content=response_text.strip())
