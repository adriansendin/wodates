"""
Profile API Endpoints

HTTP endpoints for profile operations.
Delegates all business logic to ProfileService.
"""

from fastapi import APIRouter, HTTPException, status

from app.schemas.profile import (
    GenerateProfileRequest,
    GenerateProfileResponse,
    MergeProfilesRequest,
    MergeProfilesResponse,
)
from app.services.profile_service import ProfileService

router = APIRouter()
profile_service = ProfileService()


@router.post("/merge", response_model=MergeProfilesResponse)
async def merge_profiles(request: MergeProfilesRequest) -> MergeProfilesResponse:
    """
    Merge two profile summaries into a single consolidated profile.

    Args:
        request: Request containing consolidated and incremental profiles

    Returns:
        Response with merged profile

    Raises:
        HTTPException: If the merge operation fails
    """
    try:
        return await profile_service.merge_profiles(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to merge profiles: {str(e)}",
        )


@router.post("/generate", response_model=GenerateProfileResponse)
async def generate_profile(
    request: GenerateProfileRequest,
) -> GenerateProfileResponse:
    """
    Generate a profile summary from conversation messages.

    Args:
        request: Request containing conversations and main user marker

    Returns:
        Response with generated profile

    Raises:
        HTTPException: If the profile generation fails
    """
    try:
        return await profile_service.generate_profile(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate profile: {str(e)}",
        )

