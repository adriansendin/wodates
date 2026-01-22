"""
Explanations API Endpoints

HTTP endpoints for affinity explanation operations.
Delegates all business logic to ExplanationService.
"""

from fastapi import APIRouter, HTTPException, status

from app.schemas.explanations import (
    GenerateExplanationRequest,
    GenerateExplanationResponse,
)
from app.services.explanation_service import ExplanationService

router = APIRouter()
explanation_service = ExplanationService()


@router.post("/generate", response_model=GenerateExplanationResponse)
async def generate_explanation(
    request: GenerateExplanationRequest,
) -> GenerateExplanationResponse:
    """
    Generate an explanation of affinity between two users.

    Args:
        request: Request containing both user profiles and optional affinity score

    Returns:
        Response with explanation and key points

    Raises:
        HTTPException: If the explanation generation fails
    """
    # Global kill-switch: abort immediately if AI is disabled
    from app.core.settings import settings
    if not settings.ai_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI functionality is disabled (AI_ENABLED=false)",
        )

    try:
        return await explanation_service.generate_explanation(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate explanation: {str(e)}",
        )

