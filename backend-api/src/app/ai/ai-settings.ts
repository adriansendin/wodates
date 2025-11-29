/**
 * Centralized AI Configuration
 *
 * This file is the single source of truth for all AI-related configuration.
 * It reads from environment variables and provides sensible defaults.
 *
 * Architecture:
 * - .env file: Contains environment-specific values (user configurable)
 * - ai-settings.ts: Reads .env + provides defaults + centralizes structure
 * - config.ts: Uses ai-settings.ts to create providers (factory pattern)
 */

/**
 * AI Model Constants - Technical specifications that rarely change
 *
 * These constants define model-specific technical parameters that affect data compatibility.
 * WARNING: Changing these values may require regenerating existing data (embeddings, summaries, etc.)
 *
 * Export these constants for use in validation, schemas, and other places that need to reference
 * the technical specifications without importing the full AIConfig.
 */
export const AIModelConstants = {
  /**
   * Embedding model specifications
   *
   * WARNING: Changing DEFAULT_MODEL or DIMENSION requires:
   * - Regenerating all existing embeddings in user_ai_profiles.summary_embedding
   * - Updating database schema if dimension changes (vector(768) -> vector(NEW_DIM))
   * - Updating all code that references the dimension (768)
   */
  // TODO: yxchia es un TRM, no un LLM. habría que cambiarlo por Alibaba GTE-multilingual-base
  EMBEDDING: {
    DEFAULT_MODEL: 'yxchia/multilingual-e5-base',
    DIMENSION: 768, // Fixed dimension for multilingual-e5-base
  },
} as const;

/**
 * AI Configuration - Single Source of Truth
 */
export const AIConfig = {
  /**
   * Default provider selection
   */
  defaultProvider: process.env.NODE_ENV === 'development' ? 'ollama' : 'openai',

  /**
   * Context configuration (used by DocLoveService)
   * Controls what context is included when generating AI responses
   */
  context: {
    /**
     * Maximum number of conversation history messages to include
     * Lower = faster responses, less context
     */
    conversationHistoryLimit: process.env.AI_CONTEXT_HISTORY_LIMIT
      ? parseInt(process.env.AI_CONTEXT_HISTORY_LIMIT, 10)
      : 2,

    /**
     * Whether to include user context (name, bio)
     * Disabled by default for speed optimization
     * Set AI_INCLUDE_USER_CONTEXT=true in .env to enable
     */
    includeUserContext:
      process.env.AI_INCLUDE_USER_CONTEXT === 'true' ? true : false,

    /**
     * Whether to include active matches context
     * Disabled by default for speed optimization
     * Set AI_INCLUDE_ACTIVE_MATCHES=true in .env to enable
     */
    includeActiveMatches:
      process.env.AI_INCLUDE_ACTIVE_MATCHES === 'true' ? true : false,
  },

  /**
   * Ollama provider configuration
   */
  ollama: {
    baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.AI_MODEL_DOC_LOVE || 'llama3.2:1b',
    timeout: process.env.OLLAMA_TIMEOUT
      ? parseInt(process.env.OLLAMA_TIMEOUT, 10)
      : 60000, // 60 seconds default

    /**
     * Summarization timeout configuration
     * Used for generating user profile summaries from chats and merging summaries
     * Can be overridden via OLLAMA_SUMMARIZATION_TIMEOUT env var (in milliseconds)
     * Default: 10 minutes (600000ms) for large prompts with 7B+ models
     */
    summarizationTimeout: process.env.OLLAMA_SUMMARIZATION_TIMEOUT
      ? parseInt(process.env.OLLAMA_SUMMARIZATION_TIMEOUT, 10)
      : 600000, // 10 minutes default

    /**
     * Ollama API parameters
     * Optimized for speed by default
     */
    parameters: {
      temperature: process.env.OLLAMA_TEMPERATURE
        ? parseFloat(process.env.OLLAMA_TEMPERATURE)
        : 0.1, // Very low for deterministic, fast responses
      num_predict: process.env.OLLAMA_NUM_PREDICT
        ? parseInt(process.env.OLLAMA_NUM_PREDICT, 10)
        : 500, // Response length limit
      top_p: process.env.OLLAMA_TOP_P
        ? parseFloat(process.env.OLLAMA_TOP_P)
        : 0.5, // Low for faster generation
      num_ctx: process.env.OLLAMA_NUM_CTX
        ? parseInt(process.env.OLLAMA_NUM_CTX, 10)
        : 512, // Context window size (reduced for speed)
    },

    /**
     * Summarizer-specific parameters
     * Used for generating user profile summaries from chats
     * Can be overridden via OLLAMA_SUMMARIZER_NUM_CTX, OLLAMA_SUMMARIZER_NUM_PREDICT, OLLAMA_SUMMARIZER_TEMPERATURE, OLLAMA_SUMMARIZER_SEED, OLLAMA_SUMMARIZER_TOP_P, OLLAMA_SUMMARIZER_TOP_K, and OLLAMA_SUMMARIZER_REPEAT_PENALTY
     */
    summarizerParameters: {
      num_ctx: process.env.OLLAMA_SUMMARIZER_NUM_CTX
        ? parseInt(process.env.OLLAMA_SUMMARIZER_NUM_CTX, 10)
        : 2048, // Context window for profile summarization
      num_predict: process.env.OLLAMA_SUMMARIZER_NUM_PREDICT
        ? parseInt(process.env.OLLAMA_SUMMARIZER_NUM_PREDICT, 10)
        : 1000, // Response length for summarization
      temperature: process.env.OLLAMA_SUMMARIZER_TEMPERATURE
        ? parseFloat(process.env.OLLAMA_SUMMARIZER_TEMPERATURE)
        : 0, // Temperature for summarization (lower = more deterministic)
      seed: process.env.OLLAMA_SUMMARIZER_SEED
        ? parseInt(process.env.OLLAMA_SUMMARIZER_SEED, 10)
        : 1234, // Seed for deterministic outputs (default: 1234)
      top_p: process.env.OLLAMA_SUMMARIZER_TOP_P
        ? parseFloat(process.env.OLLAMA_SUMMARIZER_TOP_P)
        : 1, // Top-p sampling for summarization (default: 1)
      top_k: process.env.OLLAMA_SUMMARIZER_TOP_K
        ? parseInt(process.env.OLLAMA_SUMMARIZER_TOP_K, 10)
        : 1, // Top-k sampling for summarization (default: 1)
      repeat_penalty: process.env.OLLAMA_SUMMARIZER_REPEAT_PENALTY
        ? parseFloat(process.env.OLLAMA_SUMMARIZER_REPEAT_PENALTY)
        : 1.1, // Repeat penalty for summarization (default: 1.1)
    },

    /**
     * Merge-specific parameters
     * Used when merging consolidated summary with incremental summary
     * Can be overridden via OLLAMA_MERGE_NUM_CTX, OLLAMA_MERGE_NUM_PREDICT, OLLAMA_MERGE_TEMPERATURE, OLLAMA_MERGE_SEED, OLLAMA_MERGE_TOP_P, OLLAMA_MERGE_TOP_K, and OLLAMA_MERGE_REPEAT_PENALTY
     * Note: top_k and repeat_penalty use OLLAMA_MERGE_* (specific to merge operations)
     */
    mergeParameters: {
      num_ctx: process.env.OLLAMA_MERGE_NUM_CTX
        ? parseInt(process.env.OLLAMA_MERGE_NUM_CTX, 10)
        : 4096, // Context window for merging summaries (needs more context for two profiles)
      num_predict: process.env.OLLAMA_MERGE_NUM_PREDICT
        ? parseInt(process.env.OLLAMA_MERGE_NUM_PREDICT, 10)
        : 1500, // Response length for merge operations
      temperature: process.env.OLLAMA_MERGE_TEMPERATURE
        ? parseFloat(process.env.OLLAMA_MERGE_TEMPERATURE)
        : 0, // Temperature for merge operations (0 = deterministic)
      seed: process.env.OLLAMA_MERGE_SEED
        ? parseInt(process.env.OLLAMA_MERGE_SEED, 10)
        : 1234, // Seed for deterministic outputs (default: 1234)
      top_p: process.env.OLLAMA_MERGE_TOP_P
        ? parseFloat(process.env.OLLAMA_MERGE_TOP_P)
        : 1, // Top-p sampling for merge operations (default: 1)
      top_k: process.env.OLLAMA_MERGE_TOP_K
        ? parseInt(process.env.OLLAMA_MERGE_TOP_K, 10)
        : 1, // Top-k sampling for merge operations (default: 1)
      repeat_penalty: process.env.OLLAMA_MERGE_REPEAT_PENALTY
        ? parseFloat(process.env.OLLAMA_MERGE_REPEAT_PENALTY)
        : 1.0, // Repeat penalty for merge operations (default: 1.0)
    },

    /**
     * Profile chats to resume model configuration
     * Model used for generating user profile summaries from chats
     *
     * To override, set AI_MODEL_PROFILE_CHATS_TO_RESUME in .env
     * Falls back to ollama.model (AI_MODEL_DOC_LOVE) if not specified
     */
    profileChatsToResumeModel:
      process.env.AI_MODEL_PROFILE_CHATS_TO_RESUME ||
      process.env.AI_MODEL_DOC_LOVE ||
      'gemma3:4b',

    /**
     * Profile merge resumes model configuration
     * Model used for merging consolidated summary with incremental summary
     *
     * To override, set AI_MODEL_PROFILE_MERGE_RESUMES in .env
     * Falls back to profileChatsToResumeModel, then to ollama.model (AI_MODEL_DOC_LOVE) if not specified
     */
    profileMergeResumesModel:
      process.env.AI_MODEL_PROFILE_MERGE_RESUMES ||
      process.env.AI_MODEL_PROFILE_CHATS_TO_RESUME ||
      process.env.AI_MODEL_DOC_LOVE ||
      'gemma3:4b',

    /**
     * Ollama embeddings configuration
     * Separate from chat model - uses multilingual-e5-base for embeddings
     *
     * To override the default model, set OLLAMA_EMBEDDING_MODEL in .env
     * WARNING: Changing the model may require regenerating all existing embeddings
     */
    embeddings: {
      model:
        process.env.OLLAMA_EMBEDDING_MODEL ||
        AIModelConstants.EMBEDDING.DEFAULT_MODEL,
      dimension: AIModelConstants.EMBEDDING.DIMENSION,
      timeout: process.env.OLLAMA_EMBEDDING_TIMEOUT
        ? parseInt(process.env.OLLAMA_EMBEDDING_TIMEOUT, 10)
        : 30000, // 30 seconds default (embeddings are usually faster than chat)
    },
  },

  /**
   * OpenAI provider configuration
   */
  openai: {
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: process.env.OPENAI_TEMPERATURE
      ? parseFloat(process.env.OPENAI_TEMPERATURE)
      : 0.1, // Very low for deterministic, fast responses
    maxTokens: process.env.OPENAI_MAX_TOKENS
      ? parseInt(process.env.OPENAI_MAX_TOKENS, 10)
      : 200, // Short responses for speed
  },

  /**
   * Prompt configuration (shared across all providers)
   */
  prompt: {
    /**
     * System instructions for Doc Love
     * This is the core personality and behavior definition
     */
    systemInstructions: `
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
    `,

    /**
     * Instructions for generating user personality summaries
     * Used by SummarizerModel to create/update user AI profiles
     *
     * IMPORTANTE: el resultado se usará como entrada directa de un modelo de embeddings.
     * Debe ser TEXTO PLANO en español, muy claro, estructurado por líneas/secciones fijas
     * (una línea por sección) y sin formato técnico.
     */
    summarizerInstructions: {
      /**
       * Base introduction for the summarizer
       */
      introduction: `Eres un analista de perfiles para matchmaking. Tu tarea es convertir conversaciones en un perfil descriptivo en texto natural, siguiendo un formato fijo. El perfil debe contener información concreta y útil para embeddings, sin ruido ni contenido adicional.`,

      /**
       * Instructions for creating a new summary (cuando no existe perfil previo)
       */
      createNew: `
      Analiza EXCLUSIVAMENTE el contenido literal de las conversaciones y genera un perfil en español siguiendo el formato fijo de 11 secciones. 

OBJETIVO:
Crear un perfil estrictamente descriptivo basado SOLO en hechos explícitos (frases, datos y acciones mencionadas). No debes hacer interpretaciones, suposiciones, diagnósticos, ni conclusiones psicológicas.

REGLAS DE EXTRACCIÓN (muy importantes):
- Usa únicamente información concreta que aparezca literalmente en los mensajes.
- Si un dato no aparece de forma clara y explícita, NO lo incluyas.
- Prohibido inferir estados emocionales, traumas, timidez, ansiedad o interpretación subjetiva.
- Prohibido embellecer, suavizar o dramatizar.
- Prohibido combinar o reinterpretar frases.
- Si el texto dice “miedo a los payasos”, no conviertas eso en “trío payaso”, “trauma familiar”, “preocupación”, ni variaciones.
- Si el texto dice “comida asiática”, no lo conviertas en “especialidad”, “cocina china”, ni ampliaciones.
- Si aparece una preferencia, menciónala tal cual sin añadir contexto adicional.
- Si una sección no tiene NINGÚN dato explícito, escribe exactamente: “sin datos”.

FORMATO (orden obligatorio, líneas individuales):
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
- Produce únicamente el perfil final, sin introducciones ni explicaciones.
- Cada sección: 1–3 frases, máximo 50 palabras.
- No uses listas, viñetas, markdown, JSON, tablas ni numeraciones.
- En “Frases textuales relevantes”: transcribe entre 1 y 3 frases literales del usuario; si no hay, escribe “sin datos”.

Ahora genera el perfil de usuario usando SOLO información explícita encontrada en las conversaciones.
`,

      /**
       * Instructions for merging two summaries (consolidated summary + incremental summary)
       * Used to merge existing consolidated summary with new incremental summary
       */
      mergeSummaries: `
      Funde los dos perfiles de usuario en UN solo perfil actualizado.

PERFIL BASE (Información consolidada previa):
"""
{{PROFILE_1}}
"""

PERFIL INCREMENTAL (Nueva información reciente):
"""
{{PROFILE_2}}
"""

INSTRUCCIONES:
Actúas como un “mergeador” estricto de información, no como un redactor creativo.
Debes combinar el PERFIL BASE y el PERFIL INCREMENTAL en un único perfil coherente siguiendo estas reglas:

REGLAS LÓGICAS:
- Trabaja sección por sección (Identidad básica, Estilo de comunicación, etc.).
- Usa lógica de UNIÓN:
  * Si un dato está en el PERFIL BASE y NO es contradicho por el INCREMENTAL, MANTÉNLO.
  * Si un dato aparece solo en el PERFIL INCREMENTAL, AÑÁDELO.
  * Si hay contradicción directa, el PERFIL INCREMENTAL tiene prioridad.
- No resumas eliminando detalles válidos: es mejor mantener más información que perder datos.
- NO inventes nada: solo puedes usar información explícita de alguno de los dos perfiles.
- No cambies el significado de los datos:
  * No sustituyas “comida asiática” por “cocina china” si “china” no aparece en ningún texto.
  * No conviertas “miedo a los payasos” en otras variantes si no están escritas.
- En “Frases textuales relevantes” solo uses frases que aparezcan literalmente en alguno de los perfiles (puedes eliminar duplicados).

FORMATO DE SALIDA:
Debes devolver exactamente estas 11 secciones en este orden, en prosa continua:

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
- Si una sección no tiene datos en ninguno de los dos perfiles, escribe exactamente: "sin datos".
- No uses JSON, markdown, listas ni viñetas.

Ahora genera SOLO el perfil final fusionado siguiendo todas estas reglas.
      `,
    },
  },
} as const;

/**
 * Type-safe access to configuration
 */
export type AIConfigType = typeof AIConfig;
