"""
Embedding Service - Business logic for embedding operations

Handles generation of embeddings from text.
"""

from app.core.settings import settings
from app.llm.llm_client import LLMClient
from app.llm.llm_factory import create_embedding_client
from app.schemas.embeddings import GenerateEmbeddingRequest, GenerateEmbeddingResponse


class EmbeddingService:
    """Service for embedding operations."""

    def __init__(self, llm_client: LLMClient | None = None):
        """
        Initialize the embedding service.

        Args:
            llm_client: LLM client implementation (defaults to factory-created embedding client)
        """
        self.llm_client: LLMClient = llm_client or create_embedding_client()

    async def generate_embedding(
        self, request: GenerateEmbeddingRequest
    ) -> GenerateEmbeddingResponse:
        """
        Generate an embedding for the given text.

        Args:
            request: Request containing text to embed

        Returns:
            Response with generated embedding vector

        Raises:
            ValueError: If the embedding generation fails
            Exception: For other unexpected errors
        """
        # Generate embedding using LLM client
        # Use appropriate model based on embeddings provider
        provider = settings.embeddings_provider.lower()
        if provider == "gemini":
            embedding_model = settings.gemini_embedding_model
            timeout_ms = settings.gemini_timeout
        elif provider == "openai":
            embedding_model = settings.openai_embedding_model
            timeout_ms = settings.openai_timeout
        else:  # ollama or default
            embedding_model = settings.ollama_embedding_model
            timeout_ms = settings.ollama_embedding_timeout

        embedding = await self.llm_client.generate_embedding(
            text=request.text,
            model=embedding_model,
            timeout=timeout_ms / 1000,  # ms → seconds
        )

        # Return the embedding vector
        return GenerateEmbeddingResponse(
            embedding=embedding,
            dimension=settings.embedding_dimension,
        )
