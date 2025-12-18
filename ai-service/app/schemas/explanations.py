"""
Explanations Schemas - Request/Response models for affinity explanations
"""

from pydantic import BaseModel, Field


class GenerateExplanationRequest(BaseModel):
    """Request to generate an affinity explanation between two users."""

    user_a_profile: str = Field(..., description="Profile summary of user A")
    user_b_profile: str = Field(..., description="Profile summary of user B")
    affinity_score: float | None = Field(
        default=None, description="Optional pre-calculated affinity score"
    )


class GenerateExplanationResponse(BaseModel):
    """Response containing the generated affinity explanation."""

    explanation: str = Field(..., description="Human-readable explanation of affinity")
    key_points: list[str] = Field(
        default_factory=list, description="Key points of compatibility"
    )

