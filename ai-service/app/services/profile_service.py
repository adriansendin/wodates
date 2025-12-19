"""
Profile Service - Business logic for profile operations

Handles generation and merging of user profiles from conversations.
"""

from app.llm.ollama_client import OllamaClient
from app.schemas.profile import (
    ConversationMessage,
    GenerateProfileRequest,
    GenerateProfileResponse,
    MergeProfilesRequest,
    MergeProfilesResponse,
)
from app.core.settings import settings

# Prompt for creating new profile from conversations
CREATE_PROFILE_PROMPT = """
ROL:
Eres un asistente experto en extracción factual y síntesis limpia para generar perfiles estructurados destinados a embeddings de matching. Convierte conversaciones tipo chat en información clara, normalizada y sin interpretaciones. No inventes ni infieras; usa solo lo que esté explícitamente dicho por el usuario.

CONTEXTO:
Se te proporcionarán chats tipo WhatsApp con varios interlocutores. Solo uno lleva la marca "(MAIN)" tras su nombre. Ese es el usuario del que debes crear el perfil. El resto de participantes (usuarios o bots) sirven solo como contexto y deben ignorarse para la extracción.

OBJETIVO:
Construir un perfil estructurado en español, compuesto de 11 secciones fijas, usando únicamente datos explícitos expresados por el usuario marcado como "(MAIN)". El resultado será usado para generar embeddings para matching entre usuarios, por lo que debe contener información diferencial y evitar contenido genérico.

REGLAS DE EXTRACCIÓN:
- Usa exclusivamente información clara y literal que el MAIN haya expresado.
- Normaliza ortografía y estilo manteniendo el mismo significado.
- No interpretes ni deduzcas cosas no dichas.
- Elimina completamente ruido conversacional ("jajaja", "vale", "ok", "sí/no" sin contexto, etc.).

SECCIONES (ORDEN OBLIGATORIO):
El perfil debe contener exactamente estas 11 líneas, en este orden:
Identidad básica: ...
Estilo de comunicación: ...
Personalidad: ...
Gustos y preferencias: ...
Disgustos y rechazos: ...
Actividades y vida real: ...
Trabajo y formación: ...
Valores personales y relacionales: ...
Preferencias en relaciones: ...
Patrones de comportamiento: ...
Frases textuales relevantes: ...

REGLAS DE FORMATO:
- Produce únicamente el perfil final, sin explicaciones ni texto adicional.
- Cada sección debe tener de 1 a 3 frases, máximo 50 palabras por sección.
- No uses listas, viñetas, markdown, tablas ni JSON.
- Si una sección NO tiene datos explícitos útiles y diferenciales del MAIN, escribe exactamente: "sin datos".

Ahora genera el perfil EXACTAMENTE con ese formato usando SOLO la información explícita de los mensajes del usuario marcado como "(MAIN)".
"""

# Prompt for merging profiles
MERGE_PROFILES_PROMPT = """
Funde los dos perfiles de usuario en UN solo perfil actualizado.

PERFIL BASE (Información consolidada previa):
\"\"\"
{PROFILE_1}
\"\"\"

PERFIL INCREMENTAL (Nueva información reciente):
\"\"\"
{PROFILE_2}
\"\"\"

INSTRUCCIONES:
Actúas como un mergeador estricto de información, no como un redactor creativo. Debes combinar el PERFIL BASE y el PERFIL INCREMENTAL en un único perfil coherente cuyo objetivo es maximizar señal diferencial para compatibilidad y matching semántico.

REGLAS LÓGICAS:
- Trabaja sección por sección (Identidad básica, Estilo de comunicación, etc.).
- Usa lógica de UNIÓN:
  * Si un dato está en el PERFIL BASE y NO es contradicho explícitamente por el PERFIL INCREMENTAL, MANTÉNLO.
  * Si un dato aparece solo en el PERFIL INCREMENTAL, AÑÁDELO.
  * Si hay contradicción directa y explícita, el PERFIL INCREMENTAL tiene prioridad.
- NO inventes nada: solo puedes usar información explícita presente en alguno de los dos perfiles.

FORMATO DE SALIDA:
Debes devolver exactamente estas 11 secciones, en este orden y en prosa continua:
Identidad básica: ...
Estilo de comunicación: ...
Personalidad: ...
Gustos y preferencias: ...
Disgustos y rechazos: ...
Actividades y vida real: ...
Trabajo y formación: ...
Valores personales y relacionales: ...
Preferencias en relaciones: ...
Patrones de comportamiento: ...
Frases textuales relevantes: ...

REGLAS DE FORMATO:
- Responde únicamente con el perfil final (sin explicaciones adicionales).
- Cada sección debe contener entre 1 y 3 frases (máx. 50 palabras por sección).
- Si una sección no tiene datos útiles y diferenciales en ninguno de los dos perfiles, escribe exactamente: "sin datos".
- No uses JSON, markdown, listas ni viñetas.

Ahora genera SOLO el perfil final fusionado siguiendo todas estas reglas.
"""


class ProfileService:
    """Service for profile operations."""

    def __init__(self, llm_client: OllamaClient | None = None):
        self.llm_client = llm_client or OllamaClient()

    async def generate_profile(
        self, request: GenerateProfileRequest
    ) -> GenerateProfileResponse:
        """
        Generate a profile summary from conversation messages.

        Args:
            request: Request containing conversations and main user marker

        Returns:
            Response with generated profile summary
        """
        # Format conversations for the prompt
        conversation_text = "\n".join(
            [
                f"{msg.sender}: {msg.content}"
                for msg in request.conversations
            ]
        )

        # Build the full prompt
        full_prompt = f"{CREATE_PROFILE_PROMPT}\n\nConversaciones:\n{conversation_text}"

        # Generate profile using LLM with summarization parameters
        profile_text = await self.llm_client.chat(
            messages=[{"role": "user", "content": full_prompt}],
            model=settings.ollama_model,  # Can be overridden with profile-specific model
            temperature=settings.ollama_summarizer_temperature,
            max_tokens=settings.ollama_summarizer_num_predict,  # num_predict mapped to max_tokens
            timeout=settings.ollama_timeout / 1000,
        )

        return GenerateProfileResponse(profile=profile_text.strip())

    async def merge_profiles(
        self, request: MergeProfilesRequest
    ) -> MergeProfilesResponse:
        """
        Merge two profile summaries into a single consolidated profile.

        Args:
            request: Request containing consolidated and incremental profiles

        Returns:
            Response with merged profile summary
        """
        # Build the merge prompt with both profiles
        merge_prompt = MERGE_PROFILES_PROMPT.replace(
            "{PROFILE_1}", request.consolidated_profile
        ).replace("{PROFILE_2}", request.incremental_profile)

        # Generate merged profile using LLM with merge-specific parameters
        merged_profile = await self.llm_client.chat(
            messages=[{"role": "user", "content": merge_prompt}],
            model=settings.ollama_model,  # Can be overridden with merge-specific model
            temperature=settings.ollama_merge_temperature,
            max_tokens=settings.ollama_merge_num_predict,  # num_predict mapped to max_tokens
            timeout=settings.ollama_merge_timeout / 1000,  # Use merge-specific timeout (convert ms to seconds)
        )

        return MergeProfilesResponse(merged_profile=merged_profile.strip())

