"""
Tests for Ollama Client URL Construction

Validates that URLs are constructed correctly regardless of base_url format.
"""

import pytest
from unittest.mock import patch

from app.llm.ollama_client import OllamaClient
from app.core.settings import Settings


def test_base_url_normalization_no_trailing_slash():
    """Test that base URL without trailing slash works correctly."""
    with patch("app.llm.ollama_client.settings") as mock_settings:
        mock_settings.ollama_base_url = "http://localhost:11434"
        mock_settings.ollama_model = "test-model"
        mock_settings.ollama_timeout = 60000

        client = OllamaClient()
        assert client.base_url == "http://localhost:11434"
        assert client._build_url("/api/chat") == "http://localhost:11434/api/chat"
        assert client._build_url("/api/tags") == "http://localhost:11434/api/tags"


def test_base_url_normalization_with_trailing_slash():
    """Test that base URL with trailing slash is normalized correctly."""
    with patch("app.llm.ollama_client.settings") as mock_settings:
        mock_settings.ollama_base_url = "http://localhost:11434/"
        mock_settings.ollama_model = "test-model"
        mock_settings.ollama_timeout = 60000

        client = OllamaClient()
        assert client.base_url == "http://localhost:11434"
        assert client._build_url("/api/chat") == "http://localhost:11434/api/chat"
        assert client._build_url("/api/tags") == "http://localhost:11434/api/tags"


def test_base_url_normalization_multiple_trailing_slashes():
    """Test that multiple trailing slashes are removed."""
    with patch("app.llm.ollama_client.settings") as mock_settings:
        mock_settings.ollama_base_url = "http://localhost:11434///"
        mock_settings.ollama_model = "test-model"
        mock_settings.ollama_timeout = 60000

        client = OllamaClient()
        assert client.base_url == "http://localhost:11434"
        assert client._build_url("/api/chat") == "http://localhost:11434/api/chat"


def test_build_url_without_leading_slash():
    """Test that _build_url adds leading slash if missing."""
    with patch("app.llm.ollama_client.settings") as mock_settings:
        mock_settings.ollama_base_url = "http://localhost:11434"
        mock_settings.ollama_model = "test-model"
        mock_settings.ollama_timeout = 60000

        client = OllamaClient()
        # Should add leading slash if missing
        assert client._build_url("api/chat") == "http://localhost:11434/api/chat"
        # Should work correctly with leading slash
        assert client._build_url("/api/chat") == "http://localhost:11434/api/chat"


def test_settings_normalize_ollama_base_url():
    """Test that Settings normalizes ollama_base_url correctly."""
    # Test with trailing slash
    settings = Settings(ollama_base_url="http://localhost:11434/")
    assert settings.ollama_base_url == "http://localhost:11434"

    # Test without trailing slash
    settings = Settings(ollama_base_url="http://localhost:11434")
    assert settings.ollama_base_url == "http://localhost:11434"

    # Test with multiple trailing slashes
    settings = Settings(ollama_base_url="http://localhost:11434///")
    assert settings.ollama_base_url == "http://localhost:11434"
