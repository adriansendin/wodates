"""
Embedding Service - Business logic for embedding operations

Handles generation of embeddings from text.
"""

from app.llm.ollama_client import OllamaClient
from app.schemas.embeddings import GenerateEmbeddingRequest, GenerateEmbeddingResponse
from app.core.settings import settings


class EmbeddingService:
    """Service for embedding operations."""

    def __init__(self, ollama_client: OllamaClient | None = None):
        """
        Initialize the embedding service.

        Args:
            ollama_client: Ollama client implementation (defaults to OllamaClient)
        """
        self.ollama_client: OllamaClient = ollama_client or OllamaClient()

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
        # Generate embedding using Ollama
        embedding = await self.ollama_client.generate_embedding(
            text=request.text,
            model=settings.ollama_embedding_model,
            timeout=settings.ollama_embedding_timeout / 1000,  # ms → seconds
        )

        # Return the embedding vector
        return GenerateEmbeddingResponse(
            embedding=embedding,
            dimension=settings.embedding_dimension,
        )
