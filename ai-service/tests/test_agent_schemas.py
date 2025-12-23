"""
Tests for Agent Schemas

Validates that NextQuestionRequest correctly handles user_context
with both string and integer values for fields like age.
"""

import pytest
from pydantic import ValidationError

from app.schemas.agent import ConversationMessage, NextQuestionRequest


def test_next_question_request_with_string_age():
    """Test that user_context accepts string values (e.g., age: '28')."""
    request = NextQuestionRequest(
        conversation_history=[
            ConversationMessage(role="user", content="Hello")
        ],
        user_context={"name": "Juan", "age": "28", "bio": "Developer"},
    )

    assert request.user_context is not None
    assert request.user_context["age"] == "28"
    assert request.user_context["name"] == "Juan"
    assert isinstance(request.user_context["age"], str)


def test_next_question_request_with_integer_age():
    """Test that user_context accepts integer values (e.g., age: 28) and normalizes to string."""
    request = NextQuestionRequest(
        conversation_history=[
            ConversationMessage(role="user", content="Hello")
        ],
        user_context={"name": "Juan", "age": 28, "bio": "Developer"},
    )

    assert request.user_context is not None
    # After normalization, age should be a string
    assert request.user_context["age"] == "28"
    assert isinstance(request.user_context["age"], str)
    assert request.user_context["name"] == "Juan"


def test_next_question_request_with_mixed_types():
    """Test that user_context accepts mixed string and integer values."""
    request = NextQuestionRequest(
        conversation_history=[
            ConversationMessage(role="user", content="Hello")
        ],
        user_context={
            "name": "Juan",
            "age": 28,  # int
            "height": "180",  # str
            "weight": 75,  # int
        },
    )

    assert request.user_context is not None
    # All values should be normalized to strings
    assert request.user_context["age"] == "28"
    assert request.user_context["height"] == "180"
    assert request.user_context["weight"] == "75"
    assert all(isinstance(v, str) for v in request.user_context.values())


def test_next_question_request_without_user_context():
    """Test that user_context can be None."""
    request = NextQuestionRequest(
        conversation_history=[
            ConversationMessage(role="user", content="Hello")
        ],
        user_context=None,
    )

    assert request.user_context is None


def test_next_question_request_with_empty_user_context():
    """Test that empty user_context dict is handled correctly."""
    request = NextQuestionRequest(
        conversation_history=[
            ConversationMessage(role="user", content="Hello")
        ],
        user_context={},
    )

    assert request.user_context == {}


def test_next_question_request_with_float_age():
    """Test that float values are also normalized to strings."""
    request = NextQuestionRequest(
        conversation_history=[
            ConversationMessage(role="user", content="Hello")
        ],
        user_context={"age": 28.5},
    )

    assert request.user_context is not None
    assert request.user_context["age"] == "28.5"
    assert isinstance(request.user_context["age"], str)





