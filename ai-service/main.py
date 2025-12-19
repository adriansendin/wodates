"""
AI Service - Main Application Entry Point

Microservicio dedicado a operaciones de IA para Wodates.
Orquesta llamadas a LLMs, genera perfiles, embeddings y explicaciones de afinidad.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import agent, chat, profile, explanations, embeddings
from app.core.settings import settings

app = FastAPI(
    title="Wodates AI Service",
    description="Microservicio de IA para generación de perfiles, agentes y explicaciones",
    version="1.0.0",
)

# CORS configuration for integration with Node.js backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(agent.router, prefix="/agent", tags=["agent"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(profile.router, prefix="/profile", tags=["profile"])
app.include_router(explanations.router, prefix="/explanations", tags=["explanations"])
app.include_router(embeddings.router, prefix="/embeddings", tags=["embeddings"])


@app.get("/health")
async def health_check():
    """Health check endpoint for service monitoring."""
    return {"status": "healthy", "service": "ai-service"}


@app.get("/")
async def root():
    """Root endpoint with service information."""
    return {
        "service": "Wodates AI Service",
        "version": "1.0.0",
        "endpoints": {
            "agent": "/agent/next-question",
            "chat": "/chat/generate",
            "profile": "/profile/merge",
            "explanations": "/explanations/generate",
            "embeddings": "/embeddings/generate",
        },
    }

