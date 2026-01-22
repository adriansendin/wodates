"""
Embeddings Schemas - Request/Response models for embedding operations
"""

from pydantic import BaseModel, Field


class GenerateEmbeddingRequest(BaseModel):
    """Request to generate an embedding from text."""

    text: str = Field(
        ...,
        description=(
            "Text to generate embedding for. "
            "MUST be a consolidated profile summary (user_ai_profiles.summary), "
            "NOT an incremental summary (summary_incremental). "
            "The backend is responsible for ensuring this constraint."
        ),
        min_length=1,
    )


class GenerateEmbeddingResponse(BaseModel):
    """Response containing the generated embedding vector."""

    embedding: list[float] = Field(
        ...,
        description="Vector embedding (1536-dimensional for OpenAI text-embedding-3-small, 768 for multilingual-e5-base)",
    )
    dimension: int = Field(
        default=1536,
        description="Embedding dimension (1536 for OpenAI text-embedding-3-small, 768 for multilingual-e5-base)",
    )
