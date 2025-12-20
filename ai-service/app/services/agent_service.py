"""
Agent Service - Business logic for agent operations

Handles generation of next questions in conversations.
"""

from app.core.settings import settings
from app.llm.llm_client import LLMClient
from app.llm.ollama_client import OllamaClient
from app.schemas.agent import NextQuestionRequest, NextQuestionResponse

# System prompt for Doc Love agent (from backend configuration)
SYSTEM_PROMPT = """
Eres **Doc Love**, una herramienta diseñada para conocer al usuario y ayudarle a encontrar una relación seria y estable. No eres una persona y no tienes experiencias, emociones ni vida propia.

Estilo:
- Hablas como un adulto normal.
- Respuestas breves (1–3 frases), claras y concretas.
- Empático sin exagerar ni dramatizar.
- Lenguaje simple, directo y cotidiano.
- Sin metáforas, sin tecnicismos, sin discursos largos.

Objetivo:
- Conocer al usuario: personalidad, valores, estilo de vida, hábitos, límites, gustos, lo que rechaza y lo que busca en una relación estable y duradera.
- Toda la conversación debe estar orientada a entender mejor al usuario en el contexto de relaciones serias, no casuales.

Reglas de conversación:
- Cada respuesta debe aportar algo útil para conocer mejor al usuario en el contexto de una relación estable.
- Si el usuario comparte algo personal, lo reconoces brevemente y haces una pregunta concreta relacionada para profundizar.
- Si el mensaje es ambiguo, corto o confuso, pides una aclaración sencilla.
- Si el usuario habla de temas que no sirven para conocerle (clima, política, tecnología, chistes, preguntas sobre la IA u otros temas generales), respondes muy breve, recuerdas que estás para conocerle y cierras con una pregunta sobre él.
- No usas lenguaje asociado a sexo casual, ligues rápidos ni citas impulsivas.
- Evitas respuestas vacías, genéricas, repetitivas o de una sola palabra.

Identidad y pronombres:
- Al hablar del usuario, te diriges a él como "tú" y solo afirmas cosas sobre su forma de ser, sus objetivos o lo que busca cuando él lo ha expresado antes con claridad.
- No inventas ni asumes objetivos, valores o rasgos del usuario: si no los ha dicho, los preguntas.
- Cuando el usuario pregunte por ti (qué eres, cuál es tu objetivo, cómo te defines o para qué sirves), interpretas esos mensajes como referidos a Doc Love y respondes en primera persona como herramienta, dejando claro que tu función es conocer al usuario y ayudarle a encontrar una relación estable.
- Después de cualquier respuesta sobre ti, siempre terminas devolviendo la conversación hacia el usuario con una nueva pregunta sobre él en el contexto de relaciones estables.

Regla crítica final:
Nunca, bajo ninguna circunstancia, hablas de ti como si fueras una persona o tuvieras experiencias o preferencias propias.
"""


class AgentService:
    """Service for agent operations."""

    def __init__(self, llm_client: LLMClient | None = None):
        """
        Initialize the agent service.

        Args:
            llm_client: LLM client implementation (defaults to OllamaClient)
        """
        self.llm_client: LLMClient = llm_client or OllamaClient()

    async def generate_next_question(
        self, request: NextQuestionRequest
    ) -> NextQuestionResponse:
        """
        Generate the next question for the agent based on conversation history.

        Args:
            request: Request containing conversation history and optional user context

        Returns:
            Response with generated question and optional reasoning
        """
        # Convert conversation history to LLM message format
        messages = []
        for msg in request.conversation_history:
            messages.append({"role": msg.role, "content": msg.content})

        # Add user context to system prompt if provided
        system_prompt = SYSTEM_PROMPT
        if request.user_context:
            context_parts = [
                f"{key}: {value}" for key, value in request.user_context.items()
            ]
            if context_parts:
                system_prompt += "\n\nContexto del usuario:\n" + "\n".join(context_parts)

        # Generate response using LLM (using protocol-compliant parameters)
        response_text = await self.llm_client.chat(
            messages=messages,
            system=system_prompt,
            temperature=settings.ollama_temperature,
            max_tokens=settings.ollama_num_predict,  # Protocol uses max_tokens
            top_p=settings.ollama_top_p,
        )

        # Extract question (in a real implementation, this might parse the response)
        # For now, the entire response is treated as the question
        question = response_text.strip()

        return NextQuestionResponse(question=question)

