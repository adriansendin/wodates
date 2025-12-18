"""
Embedding Service - Business logic for embedding operations

Handles generation of vector embeddings from text (specifically consolidated profile summaries).
"""

from app.llm.llm_client import LLMClient
from app.llm.ollama_client import OllamaClient
from app.schemas.embeddings import (
    GenerateEmbeddingRequest,
    GenerateEmbeddingResponse,
)
from app.core.settings import settings


class EmbeddingService:
    """Service for generating embeddings."""

    def __init__(self, llm_client: LLMClient | None = None):
        """
        Initialize the embedding service.

        Args:
            llm_client: LLM client implementation (defaults to OllamaClient)
        """
        self.llm_client: LLMClient = llm_client or OllamaClient()

    async def generate_embedding(
        self, request: GenerateEmbeddingRequest
    ) -> GenerateEmbeddingResponse:
        """
        Generate an embedding vector from text.

        This is a pure AI primitive: text → vector.
        The service does NOT:
        - Check if the text is a valid summary
        - Validate profile state
        - Decide when to generate embeddings
        - Interact with databases

        The backend is responsible for:
        - Ensuring the text is a consolidated summary (not incremental)
        - Deciding when to call this endpoint
        - Storing the resulting embedding

        Args:
            request: Request containing text to embed

        Returns:
            Response with embedding vector (768-dimensional)

        Raises:
            Exception: If the embedding generation fails
        """
        # Generate embedding using LLM client
        embedding = await self.llm_client.generate_embedding(
            text=request.text,
            model=settings.ollama_embedding_model,
            timeout=settings.ollama_embedding_timeout / 1000,
        )

        return GenerateEmbeddingResponse(
            embedding=embedding,
            dimension=settings.embedding_dimension,
        )
