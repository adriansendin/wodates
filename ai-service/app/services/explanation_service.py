"""
Explanation Service - Business logic for affinity explanations

Handles generation of human-readable explanations for user affinity.
"""

from app.core.settings import settings
from app.llm.llm_client import LLMClient
from app.llm.llm_factory import create_llm_client
from app.schemas.explanations import (
    GenerateExplanationRequest,
    GenerateExplanationResponse,
)

EXPLANATION_PROMPT = """
Analiza la compatibilidad entre dos usuarios basándote en sus perfiles.

PERFIL USUARIO A:
\"\"\"
{USER_A_PROFILE}
\"\"\"

PERFIL USUARIO B:
\"\"\"
{USER_B_PROFILE}
\"\"\"

OBJETIVO:
Genera una explicación clara y concisa (2-4 párrafos) sobre por qué estos dos usuarios podrían ser compatibles o no, destacando:
- Puntos de conexión específicos (valores, intereses, estilos de vida)
- Áreas de complementariedad
- Posibles desafíos o diferencias importantes
- Razones concretas basadas en los perfiles (no genéricas)

REGLAS:
- Sé específico y concreto, evita generalidades.
- Usa información real de los perfiles, no inventes.
- Si hay poca información, sé honesto sobre las limitaciones.
- El tono debe ser profesional pero accesible.

Genera la explicación ahora.
"""


class ExplanationService:
    """Service for generating affinity explanations."""

    def __init__(self, llm_client: LLMClient | None = None):
        """
        Initialize the explanation service.

        Args:
            llm_client: LLM client implementation (defaults to factory-created client)
        """
        self.llm_client: LLMClient = llm_client or create_llm_client()

    async def generate_explanation(
        self, request: GenerateExplanationRequest
    ) -> GenerateExplanationResponse:
        """
        Generate an explanation of affinity between two users.

        Args:
            request: Request containing both user profiles and optional affinity score

        Returns:
            Response with explanation and key points
        """
        # Build the explanation prompt
        prompt = EXPLANATION_PROMPT.replace(
            "{USER_A_PROFILE}", request.user_a_profile
        ).replace("{USER_B_PROFILE}", request.user_b_profile)

        # Add affinity score context if provided
        if request.affinity_score is not None:
            prompt += f"\n\nNota: El score de afinidad calculado es {request.affinity_score:.2f}."

        # Generate explanation using LLM (using protocol-compliant parameters)
        # Provider-aware: use appropriate settings based on LLM_PROVIDER
        is_gemini = settings.llm_provider.lower() == "gemini"
        explanation_text = await self.llm_client.chat(
            messages=[{"role": "user", "content": prompt}],
            temperature=(
                settings.gemini_temperature
                if is_gemini
                else settings.ollama_temperature
            ),
            max_tokens=(
                settings.gemini_max_output_tokens
                if is_gemini
                else settings.ollama_num_predict
            ),
            top_p=settings.ollama_top_p,  # Gemini ignores this, but harmless to pass
        )

        # Extract key points (simple extraction - can be enhanced)
        # For now, we'll return the explanation and an empty list
        # In a production system, you might parse the explanation to extract key points
        key_points: list[str] = []

        return GenerateExplanationResponse(
            explanation=explanation_text.strip(), key_points=key_points
        )

