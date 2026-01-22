"""
Application Settings and Configuration

Centralized configuration using Pydantic Settings.
Reads from environment variables with sensible defaults.
"""

import logging

from pydantic import Field, field_validator, ValidationInfo, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        # Allow aliases to be used for environment variable names
        populate_by_name=True,
    )

    # Ollama Configuration
    # Maps to OLLAMA_URL from .env (your existing variable name)
    ollama_base_url: str = Field(
        default="http://localhost:11434",
        validation_alias="OLLAMA_URL",
        description="Ollama API base URL. Uses OLLAMA_URL from .env if available."
    )

    @field_validator("ollama_base_url", mode="before")
    @classmethod
    def normalize_ollama_base_url(cls, v: str) -> str:
        """
        Normalize Ollama base URL by removing trailing slashes.

        Ensures the base URL is clean (e.g., "http://localhost:11434")
        without trailing slashes, so endpoints can be appended correctly.

        Args:
            v: Raw base URL string

        Returns:
            Normalized base URL without trailing slashes

        Examples:
            >>> normalize_ollama_base_url("http://localhost:11434/")
            "http://localhost:11434"
            >>> normalize_ollama_base_url("http://localhost:11434")
            "http://localhost:11434"
        """
        normalized = v.rstrip("/")
        # Log normalization if URL was changed (debug level, once per startup)
        if normalized != v:
            logger.debug(
                f"Normalized ollama_base_url: '{v}' -> '{normalized}'"
            )
        return normalized

    @model_validator(mode="after")
    def default_embeddings_provider(self) -> "Settings":
        """
        Default embeddings_provider to llm_provider if not set.

        Ensures backward compatibility: if EMBEDDINGS_PROVIDER is not set,
        it defaults to LLM_PROVIDER value.
        """
        if not self.embeddings_provider or self.embeddings_provider.strip() == "":
            self.embeddings_provider = self.llm_provider
            logger.debug(
                f"embeddings_provider not set, defaulting to llm_provider: '{self.llm_provider}'"
            )
        else:
            self.embeddings_provider = self.embeddings_provider.strip().lower()
        return self

    # Maps to AI_MODEL_DOC_LOVE from .env (your existing variable name)
    # This is the model used for the agent (DocLove)
    ollama_model: str = Field(
        default="llama3.2:1b",
        validation_alias="AI_MODEL_DOC_LOVE",
        description="Model for agent conversations. Uses AI_MODEL_DOC_LOVE from .env if available."
    )

    # Model for profile generation from chats
    ollama_model_profile_chats: str = Field(
        default="llama3.2:1b",
        validation_alias="AI_MODEL_PROFILE_CHATS_TO_RESUME",
        description="Model for generating profiles from conversations. Uses AI_MODEL_PROFILE_CHATS_TO_RESUME from .env if available."
    )

    # Model for profile merging
    ollama_model_profile_merge: str = Field(
        default="llama3.2:1b",
        validation_alias="AI_MODEL_PROFILE_MERGE_RESUMES",
        description="Model for merging profiles. Uses AI_MODEL_PROFILE_MERGE_RESUMES from .env if available."
    )

    # Model for affinity sentences task
    ollama_model_affinity: str = Field(
        default="gemma3:1b",
        validation_alias="AI_MODEL_AFFINITY",
        description="Model for AFFINITY_SENTENCE task. Uses AI_MODEL_AFFINITY from .env if available."
    )

    ollama_model_affinity_timeout: int = Field(
        default=60000,  # milliseconds
        validation_alias="AI_MODEL_AFFINITY_TIMEOUT",
        description="Timeout for affinity sentence generation. Uses AI_MODEL_AFFINITY_TIMEOUT from .env if available."
    )

    ollama_timeout: int = Field(
        default=60000,  # milliseconds
        validation_alias="OLLAMA_TIMEOUT",
        description="Timeout for Ollama chat operations. Uses OLLAMA_TIMEOUT from .env if available."
    )

    @field_validator("ollama_timeout", mode="before")
    @classmethod
    def parse_ollama_timeout(cls, v: str | int) -> int:
        """
        Parse OLLAMA_TIMEOUT environment variable.
        Extracts numeric value from string if it contains extra text.
        """
        if isinstance(v, int):
            return v
        if isinstance(v, str):
            # Extract numeric value from string (handles cases like "120000clear")
            import re
            match = re.search(r"\d+", v)
            if match:
                return int(match.group())
            raise ValueError(f"Could not extract integer from OLLAMA_TIMEOUT: {v}")
        return 60000  # Default fallback
    ollama_embedding_model: str = "yxchia/multilingual-e5-base"
    ollama_embedding_timeout: int = Field(
        default=30000,  # milliseconds
        validation_alias="OLLAMA_EMBEDDING_TIMEOUT",
        description="Timeout for Ollama embedding operations. Uses OLLAMA_EMBEDDING_TIMEOUT from .env if available."
    )

    # Ollama API Parameters
    ollama_temperature: float = 0.1
    ollama_num_predict: int = 500
    ollama_top_p: float = 0.5
    ollama_num_ctx: int = 512

    # Summarization-specific parameters
    ollama_summarizer_num_ctx: int = 32768
    ollama_summarizer_num_predict: int = 1500
    ollama_summarizer_temperature: float = 0.0
    ollama_summarizer_seed: int = 12345

    # Merge-specific parameters
    ollama_merge_num_ctx: int = 4096
    ollama_merge_num_predict: int = 1500
    ollama_merge_temperature: float = 0.0
    ollama_merge_seed: int = 12345
    ollama_merge_timeout: int = Field(
        default=600000,  # 10 minutes in milliseconds
        validation_alias="OLLAMA_MERGE_TIMEOUT",
        description="Timeout for profile merge operations. Uses OLLAMA_MERGE_TIMEOUT from .env if available."
    )

    # Embedding Configuration
    embedding_dimension: int = Field(
        default=1536,
        validation_alias="EMBEDDING_DIMENSION",
        description="Embedding dimension (1536 for OpenAI text-embedding-3-small, 768 for multilingual-e5-base)",
    )

    # CORS Configuration
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # Service Configuration
    service_name: str = "ai-service"
    log_level: str = "INFO"

    # Global AI kill-switch
    # When false, all AI functionality is completely disabled
    # No LLM calls, embeddings, or AI jobs will be executed
    ai_enabled: bool = Field(
        default=True,
        validation_alias="AI_ENABLED",
        description="Global AI kill-switch. Set to 'false' to disable all AI functionality. Uses AI_ENABLED from .env if available.",
    )

    @field_validator("ai_enabled", mode="before")
    @classmethod
    def parse_ai_enabled(cls, v: str | bool) -> bool:
        """
        Parse AI_ENABLED environment variable.
        Handles string "false"/"true" and boolean values.
        """
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            # Case-insensitive check for "false"
            return v.strip().lower() not in ("false", "0", "no", "off")
        return True  # Default to enabled if value is unexpected

    # LLM Provider Selection
    llm_provider: str = Field(
        default="ollama",
        validation_alias="LLM_PROVIDER",
        description="LLM provider to use: 'ollama', 'gemini', or 'openai'. Uses LLM_PROVIDER from .env if available.",
    )

    # Embeddings Provider Selection (can be different from LLM provider)
    embeddings_provider: str = Field(
        default="",
        validation_alias="EMBEDDINGS_PROVIDER",
        description="Embeddings provider to use: 'ollama', 'gemini', or 'openai'. Defaults to LLM_PROVIDER if not set. Uses EMBEDDINGS_PROVIDER from .env if available.",
    )

    # Gemini Configuration
    gemini_api_key: str = Field(
        default="",
        validation_alias="GEMINI_API_KEY",
        description="Google Gemini API key. Uses GEMINI_API_KEY from .env if available."
    )
    gemini_model: str = Field(
        default="gemini-2.0-flash-lite",
        validation_alias="GEMINI_MODEL",
        description="Gemini model name. Uses GEMINI_MODEL from .env if available."
    )
    gemini_temperature: float = Field(
        default=0.1,
        validation_alias="GEMINI_TEMPERATURE",
        description="Gemini temperature. Uses GEMINI_TEMPERATURE from .env if available."
    )
    gemini_max_output_tokens: int = Field(
        default=200,
        validation_alias="GEMINI_MAX_OUTPUT_TOKENS",
        description="Gemini max output tokens. Uses GEMINI_MAX_OUTPUT_TOKENS from .env if available."
    )
    gemini_timeout: int = Field(
        default=60000,  # milliseconds
        validation_alias="GEMINI_TIMEOUT",
        description="Timeout for Gemini operations. Uses GEMINI_TIMEOUT from .env if available."
    )
    gemini_embedding_model: str = Field(
        default="gemini-embedding-001",
        validation_alias="GEMINI_EMBEDDING_MODEL",
        description="Gemini embedding model. Uses GEMINI_EMBEDDING_MODEL from .env if available."
    )

    # OpenAI Configuration
    openai_api_key: str = Field(
        default="",
        validation_alias="OPENAI_API_KEY",
        description="OpenAI API key. Uses OPENAI_API_KEY from .env if available.",
    )
    openai_model: str = Field(
        default="gpt-4o-mini",
        validation_alias="OPENAI_MODEL",
        description="OpenAI model name. Uses OPENAI_MODEL from .env if available.",
    )
    openai_embedding_model: str = Field(
        default="text-embedding-3-small",
        validation_alias="OPENAI_EMBEDDING_MODEL",
        description="OpenAI embedding model. Uses OPENAI_EMBEDDING_MODEL from .env if available.",
    )
    openai_timeout: int = Field(
        default=60000,  # milliseconds
        validation_alias="OPENAI_TIMEOUT",
        description="Timeout for OpenAI operations. Uses OPENAI_TIMEOUT from .env if available.",
    )

    # Task-specific configuration (provider-agnostic)
    # DOC LOVE (chat corto)
    doclove_temperature: float = Field(
        default=0.2,
        validation_alias="DOCLOVE_TEMPERATURE",
        description="Temperature for DOC_LOVE task. Uses DOCLOVE_TEMPERATURE from .env if available."
    )
    doclove_max_output_tokens: int = Field(
        default=120,
        validation_alias="DOCLOVE_MAX_OUTPUT_TOKENS",
        description="Max output tokens for DOC_LOVE task. Uses DOCLOVE_MAX_OUTPUT_TOKENS from .env if available."
    )
    doclove_top_p: float = Field(
        default=0.9,
        validation_alias="DOCLOVE_TOP_P",
        description="Top-p for DOC_LOVE task. Uses DOCLOVE_TOP_P from .env if available."
    )

    # PROFILE: CHATS -> RESUME (job nocturno)
    profile_resume_temperature: float = Field(
        default=0.1,
        validation_alias="PROFILE_RESUME_TEMPERATURE",
        description="Temperature for PROFILE_CHATS_TO_RESUME task. Uses PROFILE_RESUME_TEMPERATURE from .env if available."
    )
    profile_resume_max_output_tokens: int = Field(
        default=600,
        validation_alias="PROFILE_RESUME_MAX_OUTPUT_TOKENS",
        description="Max output tokens for PROFILE_CHATS_TO_RESUME task. Uses PROFILE_RESUME_MAX_OUTPUT_TOKENS from .env if available."
    )
    profile_resume_top_p: float = Field(
        default=0.8,
        validation_alias="PROFILE_RESUME_TOP_P",
        description="Top-p for PROFILE_CHATS_TO_RESUME task. Uses PROFILE_RESUME_TOP_P from .env if available."
    )

    # PROFILE: MERGE RESUMES (job)
    profile_merge_temperature: float = Field(
        default=0.1,
        validation_alias="PROFILE_MERGE_TEMPERATURE",
        description="Temperature for PROFILE_MERGE_RESUMES task. Uses PROFILE_MERGE_TEMPERATURE from .env if available."
    )
    profile_merge_max_output_tokens: int = Field(
        default=500,
        validation_alias="PROFILE_MERGE_MAX_OUTPUT_TOKENS",
        description="Max output tokens for PROFILE_MERGE_RESUMES task. Uses PROFILE_MERGE_MAX_OUTPUT_TOKENS from .env if available."
    )
    profile_merge_top_p: float = Field(
        default=0.8,
        validation_alias="PROFILE_MERGE_TOP_P",
        description="Top-p for PROFILE_MERGE_RESUMES task. Uses PROFILE_MERGE_TOP_P from .env if available."
    )

    # AFFINITY (10-15 palabras)
    affinity_temperature: float = Field(
        default=0.15,
        validation_alias="AFFINITY_TEMPERATURE",
        description="Temperature for AFFINITY_SENTENCE task. Uses AFFINITY_TEMPERATURE from .env if available."
    )
    affinity_max_output_tokens: int = Field(
        default=60,
        validation_alias="AFFINITY_MAX_OUTPUT_TOKENS",
        description="Max output tokens for AFFINITY_SENTENCE task. Uses AFFINITY_MAX_OUTPUT_TOKENS from .env if available."
    )
    affinity_top_p: float = Field(
        default=0.7,
        validation_alias="AFFINITY_TOP_P",
        description="Top-p for AFFINITY_SENTENCE task. Uses AFFINITY_TOP_P from .env if available."
    )


settings = Settings()

