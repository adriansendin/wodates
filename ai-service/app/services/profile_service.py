"""
Profile Service - Business logic for profile operations

Handles generation and merging of user profiles from conversations.
"""

from app.core.settings import settings
from app.llm.llm_client import LLMClient
from app.llm.llm_factory import create_llm_client
from app.schemas.profile import (
    GenerateProfileRequest,
    GenerateProfileResponse,
    MergeProfilesRequest,
    MergeProfilesResponse,
)

# Prompt for creating new profile from conversations
CREATE_PROFILE_PROMPT = """
ROLE:
You are an assistant specialized in factual extraction and clean synthesis to generate structured profiles for matching embeddings.
You convert chat-style conversations into clear, normalized information without interpretation.
Do not invent or infer; use only what the user explicitly states.

CONTEXT:
You will receive WhatsApp-style chats with multiple participants.
Only one participant is marked with "(MAIN)" after their name. This is the user whose profile you must build.
All other participants (users or bots) are context only and must be ignored for extraction.

OBJECTIVE:
Build a structured profile in English composed of exactly 11 fixed sections,
using only explicit data expressed by the user marked as "(MAIN)".
The result will be used to generate embeddings for user matching, so it must contain differentiating information and avoid generic content.

EXTRACTION RULES:
- Use only clear, literal information stated by the MAIN.
- Normalize spelling and style while preserving exact meaning.
- Do not interpret or deduce unstated information.
- Completely remove conversational noise ("haha", "ok", "yes/no" without context, etc.).

SECTIONS (MANDATORY ORDER):
The profile must contain exactly these 11 lines, in this exact order:
Basic identity: ...
Communication style: ...
Personality: ...
Preferences and interests: ...
Dislikes and deal-breakers: ...
Activities and real life: ...
Work and education: ...
Personal and relational values: ...
Relationship preferences: ...
Behavioral patterns: ...
Relevant verbatim quotes: ...

FORMAT RULES:
- Output ONLY the final profile, with no explanations or extra text.
- Each section must contain 1 to 3 sentences, maximum 50 words per section.
- Do not use lists, bullets, markdown, tables, or JSON.
- If a section has NO explicit, useful, differentiating data from the MAIN, write exactly: "no data".

Now generate the profile EXACTLY in this format using ONLY the explicit information from messages written by the user marked as "(MAIN)".
"""

# Prompt for merging profiles
MERGE_PROFILES_PROMPT = """
Merge the two user profiles into ONE updated profile.

BASE PROFILE (Previously consolidated information):
\"\"\"
{PROFILE_1}
\"\"\"

INCREMENTAL PROFILE (New recent information):
\"\"\"
{PROFILE_2}
\"\"\"

INSTRUCTIONS:
You act as a strict information merger, not as a creative writer.
You must combine the BASE PROFILE and the INCREMENTAL PROFILE into a single coherent profile whose goal is to maximize differentiating signal for compatibility and semantic matching.

LOGICAL RULES:
- Work section by section (Basic identity, Communication style, etc.).
- Use UNION logic:
  * If a data point exists in the BASE PROFILE and is NOT explicitly contradicted by the INCREMENTAL PROFILE, KEEP it.
  * If a data point appears only in the INCREMENTAL PROFILE, ADD it.
  * If there is a direct and explicit contradiction, the INCREMENTAL PROFILE takes priority.
- Do NOT invent anything: you may only use explicit information present in either profile.

OUTPUT FORMAT:
You must return exactly these 11 sections, in this order, written in continuous prose:
Basic identity: ...
Communication style: ...
Personality: ...
Preferences and interests: ...
Dislikes and deal-breakers: ...
Activities and real life: ...
Work and education: ...
Personal and relational values: ...
Relationship preferences: ...
Behavioral patterns: ...
Relevant verbatim quotes: ...

FORMAT RULES:
- Respond ONLY with the final merged profile (no additional explanations).
- Each section must contain 1 to 3 sentences (max. 50 words per section).
- If a section has no useful, differentiating data in either profile, write exactly: "no data".
- Do not use JSON, markdown, lists, or bullets.

Now generate ONLY the final merged profile following all these rules.
"""


class ProfileService:
    """Service for profile operations."""

    def __init__(self, llm_client: LLMClient | None = None):
        """
        Initialize the profile service.

        Args:
            llm_client: LLM client implementation (defaults to factory-created client)
        """
        self.llm_client: LLMClient = llm_client or create_llm_client()

    async def generate_profile(
        self, request: GenerateProfileRequest
    ) -> GenerateProfileResponse:
        """
        Generate a profile summary from conversation messages.

        Args:
            request: Request containing conversations and main user marker

        Returns:
            Response with generated profile summary
        """
        # Format conversations for the prompt
        conversation_text = "\n".join(
            [
                f"{msg.sender}: {msg.content}"
                for msg in request.conversations
            ]
        )

        # Build the full prompt
        full_prompt = f"{CREATE_PROFILE_PROMPT}\n\nConversaciones:\n{conversation_text}"

        # Generate profile using LLM with PROFILE_RESUME-specific parameters
        # Provider-aware: use appropriate timeout based on LLM_PROVIDER
        is_gemini = settings.llm_provider.lower() == "gemini"
        profile_text = await self.llm_client.chat(
            messages=[{"role": "user", "content": full_prompt}],
            model=None,  # Use client default model
            temperature=settings.profile_resume_temperature,
            max_tokens=settings.profile_resume_max_output_tokens,
            top_p=settings.profile_resume_top_p,
            timeout=(
                settings.gemini_timeout
                if is_gemini
                else settings.ollama_timeout
            ) / 1000,
        )

        return GenerateProfileResponse(profile=profile_text.strip())

    async def merge_profiles(
        self, request: MergeProfilesRequest
    ) -> MergeProfilesResponse:
        """
        Merge two profile summaries into a single consolidated profile.

        Args:
            request: Request containing consolidated and incremental profiles

        Returns:
            Response with merged profile summary
        """
        # Build the merge prompt with both profiles
        merge_prompt = MERGE_PROFILES_PROMPT.replace(
            "{PROFILE_1}", request.consolidated_profile
        ).replace("{PROFILE_2}", request.incremental_profile)

        # Generate merged profile using LLM with PROFILE_MERGE-specific parameters
        # Provider-aware: use appropriate timeout based on LLM_PROVIDER
        is_gemini = settings.llm_provider.lower() == "gemini"
        merged_profile = await self.llm_client.chat(
            messages=[{"role": "user", "content": merge_prompt}],
            model=None,  # Use client default model
            temperature=settings.profile_merge_temperature,
            max_tokens=settings.profile_merge_max_output_tokens,
            top_p=settings.profile_merge_top_p,
            timeout=(
                settings.gemini_timeout
                if is_gemini
                else settings.ollama_merge_timeout
            ) / 1000,  # Use merge-specific timeout (convert ms to seconds)
        )

        return MergeProfilesResponse(merged_profile=merged_profile.strip())

