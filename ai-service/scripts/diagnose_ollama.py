#!/usr/bin/env python3
"""
Quick diagnostic script to check Ollama connectivity and model availability.

Run this script to diagnose issues with Ollama before using the ai-service.
"""

import asyncio
import httpx
import sys


async def check_ollama():
    """Check Ollama connectivity and model availability."""
    base_url = "http://localhost:11434"
    
    print("=" * 60)
    print("Ollama Diagnostic Script")
    print("=" * 60)
    print(f"\nBase URL: {base_url}\n")
    
    # Check 1: Health check via /api/tags
    print("1. Checking Ollama connectivity (/api/tags)...")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{base_url}/api/tags")
            if response.status_code == 200:
                print("   ✓ Ollama is reachable")
                data = response.json()
                models = data.get("models", [])
                print(f"   ✓ Found {len(models)} model(s) installed:")
                for model in models:
                    name = model.get("name", "unknown")
                    print(f"     - {name}")
            else:
                print(f"   ✗ Ollama returned status {response.status_code}")
                return False
    except Exception as e:
        print(f"   ✗ Cannot reach Ollama: {e}")
        return False
    
    # Check 2: Test /api/chat endpoint
    print("\n2. Testing /api/chat endpoint...")
    test_model = "llama3.2:1b"
    chat_url = f"{base_url}/api/chat"
    
    # Check if model is available
    model_names = [m.get("name", "") for m in models]
    if test_model not in model_names:
        print(f"   ✗ Model '{test_model}' is NOT installed")
        print(f"   → Install it with: ollama pull {test_model}")
        return False
    else:
        print(f"   ✓ Model '{test_model}' is installed")
    
    # Try a simple chat request
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            payload = {
                "model": test_model,
                "messages": [{"role": "user", "content": "Hello"}],
                "stream": False,
            }
            response = await client.post(chat_url, json=payload)
            
            if response.status_code == 200:
                print(f"   ✓ /api/chat endpoint works correctly")
                data = response.json()
                if "message" in data and "content" in data["message"]:
                    print(f"   ✓ Response format is correct")
                    return True
                else:
                    print(f"   ✗ Unexpected response format: {data}")
                    return False
            else:
                print(f"   ✗ /api/chat returned status {response.status_code}")
                try:
                    error_body = response.json()
                    print(f"   Error details: {error_body}")
                except:
                    print(f"   Error text: {response.text[:200]}")
                return False
    except httpx.RequestError as e:
        print(f"   ✗ Connection error: {e}")
        return False
    except Exception as e:
        print(f"   ✗ Unexpected error: {e}")
        return False


async def main():
    """Main entry point."""
    success = await check_ollama()
    
    print("\n" + "=" * 60)
    if success:
        print("✓ All checks passed! Ollama is configured correctly.")
        sys.exit(0)
    else:
        print("✗ Some checks failed. Please fix the issues above.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())








