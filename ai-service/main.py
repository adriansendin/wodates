"""
AI Service - Main Application Entry Point

Microservicio dedicado a operaciones de IA para Wodates.
Expone primitivas puras de IA (chat, perfiles, embeddings) que ya existen en el backend.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import agent, profile, explanations, embeddings, chat
from app.core.settings import settings

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Wodates AI Service",
    description="Primitivas de IA para Wodates: chat, perfiles y embeddings",
    version="1.0.0",
)

# Log configuration at startup (once)
logger.info(f"AI Service starting with Ollama base URL: '{settings.ollama_base_url}'")

# CORS configuration for integration with Node.js backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
# Core primitives (visible in Swagger)
app.include_router(chat.router, prefix="/chat", tags=["chat (ia primitive)"])
app.include_router(profile.router, prefix="/profile", tags=["profile (ia primitive)"])
app.include_router(embeddings.router, prefix="/embeddings", tags=["embeddings (ia primitive)"])

# Experimental endpoints (hidden from Swagger)
app.include_router(
    agent.router,
    prefix="/agent",
    tags=["experimental"],
    include_in_schema=False,  # Hide from Swagger - not used yet
)
app.include_router(
    explanations.router,
    prefix="/explanations",
    tags=["experimental"],
    include_in_schema=False,  # Hide from Swagger - not used yet
)


@app.get("/health")
async def health_check():
    """Health check endpoint for service monitoring."""
    return {"status": "healthy", "service": "ai-service"}


@app.get("/", include_in_schema=False)
async def root():
    """Root endpoint with service information."""
    return {
        "service": "Wodates AI Service",
        "version": "1.0.0",
        "endpoints": {
            "chat": "/chat/generate",
            "profile": "/profile/generate, /profile/merge",
            "embeddings": "/embeddings/generate",
        },
    }


@app.get("/debug/config", include_in_schema=False)
async def debug_config():
    """
    Debug endpoint to verify Ollama configuration.

    Returns the effective Ollama base URL, related settings, and connectivity status.
    Useful for troubleshooting URL construction issues.
    """
    from app.llm.ollama_client import OllamaClient

    client = OllamaClient()
    
    # Check Ollama connectivity and model availability
    health_status = await client.health_check()
    model_available = await client.verify_model_available()
    
    return {
        "ollama_base_url_from_settings": settings.ollama_base_url,
        "ollama_base_url_normalized": client.base_url,
        "example_urls": {
            "chat": client._build_url("/api/chat"),
            "tags": client._build_url("/api/tags"),
            "embeddings": client._build_url("/api/embeddings"),
        },
        "model": {
            "configured": settings.ollama_model,
            "available": model_available,
        },
        "connectivity": {
            "ollama_reachable": health_status,
            "base_url": client.base_url,
        },
    }

