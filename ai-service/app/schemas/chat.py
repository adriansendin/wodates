"""
Chat Schemas - Request/Response models for chat operations
"""

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """Single message in a conversation."""

    role: str = Field(..., description="Message role: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")


class GenerateChatRequest(BaseModel):
    """Request to generate a chat response."""

    messages: list[ChatMessage] = Field(
        ...,
        description="Conversation history (list of messages with role and content)",
        min_length=1,
    )
    system: str | None = Field(
        default=None,
        description="Optional system prompt/instructions (e.g., DocLove personality)",
    )
    model: str | None = Field(
        default=None,
        description="Optional model name to override default (e.g., 'gemma3:1b' for affinity sentences)",
    )


class GenerateChatResponse(BaseModel):
    """Response containing the generated chat message."""

    content: str = Field(..., description="Generated chat response")
