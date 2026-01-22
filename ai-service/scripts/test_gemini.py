"""
Simple test script for Gemini provider integration.

Usage:
    Set environment variables:
        LLM_PROVIDER=gemini
        GEMINI_API_KEY=your_api_key_here
        GEMINI_MODEL=gemini-2.0-flash-lite  # optional
    
    Run:
        python scripts/test_gemini.py
"""

import asyncio
import os
import sys

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.llm.gemini_client import GeminiClient
from app.llm.llm_factory import create_llm_client


async def test_gemini_chat():
    """Test Gemini chat functionality."""
    print("Testing Gemini chat...")
    
    try:
        client = create_llm_client()
        print(f"✓ Created LLM client: {type(client).__name__}")
        
        response = await client.chat(
            messages=[
                {"role": "user", "content": "Say 'Hello from Gemini!' in one sentence."}
            ],
            system="You are a helpful assistant.",
        )
        
        print(f"✓ Chat response: {response[:100]}...")
        return True
    except Exception as e:
        print(f"✗ Chat test failed: {str(e)}")
        return False


async def test_gemini_embeddings():
    """Test Gemini embeddings functionality."""
    print("\nTesting Gemini embeddings...")
    
    try:
        client = create_llm_client()
        
        embedding = await client.generate_embedding(
            text="This is a test sentence for embeddings."
        )
        
        print(f"✓ Generated embedding with dimension: {len(embedding)}")
        print(f"✓ First few values: {embedding[:5]}")
        return True
    except Exception as e:
        print(f"✗ Embeddings test failed: {str(e)}")
        return False


async def test_gemini_health():
    """Test Gemini health check."""
    print("\nTesting Gemini health check...")
    
    try:
        client = create_llm_client()
        is_healthy = await client.health_check()
        
        if is_healthy:
            print("✓ Health check passed")
            return True
        else:
            print("✗ Health check failed")
            return False
    except Exception as e:
        print(f"✗ Health check failed: {str(e)}")
        return False


async def main():
    """Run all tests."""
    print("=" * 60)
    print("Gemini Provider Integration Test")
    print("=" * 60)
    
    # Check environment
    if os.getenv("LLM_PROVIDER", "").lower() != "gemini":
        print("⚠ Warning: LLM_PROVIDER is not set to 'gemini'")
        print("  Set LLM_PROVIDER=gemini to test Gemini provider")
    
    if not os.getenv("GEMINI_API_KEY"):
        print("✗ Error: GEMINI_API_KEY is not set")
        print("  Set GEMINI_API_KEY environment variable")
        return
    
    print(f"✓ LLM_PROVIDER: {os.getenv('LLM_PROVIDER', 'not set')}")
    print(f"✓ GEMINI_API_KEY: {'*' * 20}...{os.getenv('GEMINI_API_KEY', '')[-4:]}")
    print(f"✓ GEMINI_MODEL: {os.getenv('GEMINI_MODEL', 'not set (using default)')}")
    print()
    
    # Run tests
    results = []
    results.append(await test_gemini_health())
    results.append(await test_gemini_chat())
    results.append(await test_gemini_embeddings())
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("✓ All tests passed!")
        return 0
    else:
        print("✗ Some tests failed")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
