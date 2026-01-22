"""
Chat API Endpoints

HTTP endpoints for chat operations.
Delegates all business logic to ChatService.
"""

from fastapi import APIRouter, HTTPException, status

from app.schemas.chat import GenerateChatRequest, GenerateChatResponse
from app.services.chat_service import ChatService

router = APIRouter()
chat_service = ChatService()


@router.post("/generate", response_model=GenerateChatResponse)
async def generate_chat(
    request: GenerateChatRequest,
) -> GenerateChatResponse:
    """
    Generate a chat response from conversation messages.

    Args:
        request: Request containing messages and optional system prompt

    Returns:
        Response with generated chat content

    Raises:
        HTTPException: If the chat generation fails

    Example Request:
        ```json
        {
          "messages": [
            {"role": "user", "content": "Hello"}
          ],
          "system": "You are a helpful assistant."
        }
        ```
    """
    # Global kill-switch: abort immediately if AI is disabled
    from app.core.settings import settings
    if not settings.ai_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI functionality is disabled (AI_ENABLED=false)",
        )

    try:
        return await chat_service.generate_chat(request)
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
        logger.error(f"Failed to generate chat response: {str(e)}", exc_info=True)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate chat response: {str(e)}",
        )
