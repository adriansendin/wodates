"""
Agent API Endpoints

HTTP endpoints for agent operations.
Delegates all business logic to AgentService.
"""

from fastapi import APIRouter, HTTPException, status

from app.schemas.agent import NextQuestionRequest, NextQuestionResponse
from app.services.agent_service import AgentService

router = APIRouter()
agent_service = AgentService()


@router.post("/next-question", response_model=NextQuestionResponse)
async def generate_next_question(request: NextQuestionRequest) -> NextQuestionResponse:
    """
    Generate the next question for the agent based on conversation history.

    The endpoint accepts user_context values as either strings or integers.
    For example, both `{"age": 28}` and `{"age": "28"}` are valid.
    All values are automatically normalized to strings internally.

    Args:
        request: Request containing conversation history and optional user context.
                 user_context values can be strings or integers (e.g., age: 28 or age: "28").

    Returns:
        Response with generated question

    Raises:
        HTTPException: If the LLM request fails

    Example Request:
        ```json
        {
          "conversation_history": [
            {"role": "user", "content": "Hello"}
          ],
          "user_context": {
            "name": "Juan",
            "age": 28,
            "bio": "Developer"
          }
        }
        ```
    """
    try:
        return await agent_service.generate_next_question(request)
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
        logger.error(f"Failed to generate next question: {str(e)}", exc_info=True)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate next question: {str(e)}",
        )

