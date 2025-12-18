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

    This is a pure AI primitive: messages → response.
    
    **Important:**
    - This endpoint does NOT manage conversation state or persist messages
    - The backend is responsible for building conversation history and storing responses
    - System prompt (e.g., DocLove personality) should be provided by the backend

    Args:
        request: Request containing messages and optional system prompt

    Returns:
        Response with generated chat message

    Raises:
        HTTPException: If the chat generation fails
    """
    try:
        return await chat_service.generate_chat(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate chat response: {str(e)}",
        )
