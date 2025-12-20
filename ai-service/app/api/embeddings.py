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
    Generate an embedding vector for the given text.

    Args:
        request: Request containing text to embed

    Returns:
        Response with generated embedding vector

    Raises:
        HTTPException: If the embedding generation fails
    """
    try:
        return await embedding_service.generate_embedding(request)
    except ValueError as e:
        # ValueError usually indicates configuration or model issues
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Configuration error: {str(e)}",
        )
    except Exception as e:
        # Log the full error for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to generate embedding: {str(e)}", exc_info=True)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate embedding: {str(e)}",
        )
