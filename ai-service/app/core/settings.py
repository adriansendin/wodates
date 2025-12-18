"""
Application Settings and Configuration

Centralized configuration using Pydantic Settings.
Reads from environment variables with sensible defaults.
"""

import logging
from pydantic import Field, field_validator
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
    
    ollama_timeout: int = 60000  # milliseconds
    ollama_embedding_model: str = "yxchia/multilingual-e5-base"
    ollama_embedding_timeout: int = 30000  # milliseconds

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

    # Embedding Configuration
    embedding_dimension: int = 768  # Fixed dimension for multilingual-e5-base

    # CORS Configuration
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # Service Configuration
    service_name: str = "ai-service"
    log_level: str = "INFO"


settings = Settings()

