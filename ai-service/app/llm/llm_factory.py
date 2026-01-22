"""
LLM Factory - Provider selection and client instantiation

Provides factory functions to create the appropriate LLM client
based on configuration (LLM_PROVIDER for chat/text, EMBEDDINGS_PROVIDER for embeddings).
"""

import logging

from app.core.settings import settings
from app.llm.gemini_client import GeminiClient
from app.llm.llm_client import LLMClient
from app.llm.ollama_client import OllamaClient
from app.llm.openai_client import OpenAIClient

logger = logging.getLogger(__name__)


def _create_client_for_provider(provider: str, provider_type: str = "LLM") -> LLMClient:
    """
    Internal helper to create a client for a specific provider.

    Args:
        provider: Provider name ('ollama', 'gemini', or 'openai')
        provider_type: Type of provider ('LLM' or 'Embeddings') for logging

    Returns:
        LLMClient instance

    Raises:
        ValueError: If provider is not supported or misconfigured
    """
    provider_lower = provider.lower().strip()

    if provider_lower == "gemini":
        logger.info(f"Initializing Gemini {provider_type} client")
        try:
            return GeminiClient()
        except ValueError as e:
            logger.error(f"Failed to initialize Gemini {provider_type} client: {str(e)}")
            raise
    elif provider_lower == "openai":
        logger.info(f"Initializing OpenAI {provider_type} client")
        try:
            return OpenAIClient()
        except ValueError as e:
            logger.error(f"Failed to initialize OpenAI {provider_type} client: {str(e)}")
            raise
    elif provider_lower == "ollama" or provider_lower == "":
        logger.info(f"Initializing Ollama {provider_type} client")
        return OllamaClient()
    else:
        raise ValueError(
            f"Unsupported {provider_type} provider: '{provider}'. "
            f"Supported providers: 'ollama', 'gemini', 'openai'"
        )


def create_llm_client() -> LLMClient:
    """
    Create an LLM client based on configured LLM_PROVIDER.

    Used for chat/text generation tasks.

    Returns:
        LLMClient instance (OllamaClient, GeminiClient, or OpenAIClient)

    Raises:
        ValueError: If provider is not supported or misconfigured
    """
    return _create_client_for_provider(settings.llm_provider, "LLM")


def create_embedding_client() -> LLMClient:
    """
    Create an LLM client based on configured EMBEDDINGS_PROVIDER.

    Used for embedding generation tasks. Defaults to LLM_PROVIDER if not set.

    Returns:
        LLMClient instance (OllamaClient, GeminiClient, or OpenAIClient)

    Raises:
        ValueError: If provider is not supported or misconfigured
    """
    return _create_client_for_provider(settings.embeddings_provider, "Embeddings")
