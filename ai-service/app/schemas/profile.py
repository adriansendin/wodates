"""
Profile Schemas - Request/Response models for profile operations
"""

from pydantic import BaseModel, Field


class ConversationMessage(BaseModel):
    """Single message in a conversation."""

    role: str = Field(..., description="Message role: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")
    sender: str = Field(..., description="Sender identifier (with '(MAIN)' marker if applicable)")


class MergeProfilesRequest(BaseModel):
    """Request to merge two profile summaries."""

    consolidated_profile: str = Field(
        ..., description="Existing consolidated profile summary"
    )
    incremental_profile: str = Field(
        ..., description="New incremental profile summary to merge"
    )


class MergeProfilesResponse(BaseModel):
    """Response containing the merged profile."""

    merged_profile: str = Field(..., description="Merged profile summary")


class GenerateProfileRequest(BaseModel):
    """Request to generate a profile from conversations."""

    conversations: list[ConversationMessage] = Field(
        ..., description="Conversation messages to extract profile from"
    )
    main_user_marker: str = Field(
        default="(MAIN)", description="Marker to identify the main user in conversations"
    )


class GenerateProfileResponse(BaseModel):
    """Response containing the generated profile."""

    profile: str = Field(..., description="Generated profile summary")

