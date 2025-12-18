"""
Embeddings API Endpoints

HTTP endpoints for embedding operations.
Delegates all business logic to EmbeddingService.
"""

from fastapi import APIRouter, HTTPException, status

from app.schemas.embeddings import (
    GenerateEmbeddingRequest,
    GenerateEmbeddingResponse,
)
from app.services.embedding_service import EmbeddingService

router = APIRouter()
embedding_service = EmbeddingService()


@router.post("/generate", response_model=GenerateEmbeddingResponse)
async def generate_embedding(
    request: GenerateEmbeddingRequest,
) -> GenerateEmbeddingResponse:
    """
    Generate a vector embedding from text.

    This is a pure AI primitive: text → vector embedding.
    
    **Important:**
    - Input should be a consolidated profile summary (not incremental)
    - This endpoint does NOT validate profile state or decide when to generate embeddings
    - The backend is responsible for ensuring the text is appropriate and storing the result

    Args:
        request: Request containing text to embed

    Returns:
        Response with 768-dimensional embedding vector

    Raises:
        HTTPException: If the embedding generation fails
    """
    try:
        return await embedding_service.generate_embedding(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate embedding: {str(e)}",
        )
