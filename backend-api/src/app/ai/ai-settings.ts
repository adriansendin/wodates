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
 * AI Configuration - Single Source of Truth
 */
export const AIConfig = {
  /**
   * Default provider selection
   */
  defaultProvider:
    process.env.NODE_ENV === 'development' ? 'ollama' : 'openai',

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
    model: process.env.AI_MODEL || 'llama3.2:1b',
    timeout: process.env.OLLAMA_TIMEOUT
      ? parseInt(process.env.OLLAMA_TIMEOUT, 10)
      : 60000, // 60 seconds default

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
- Al hablar del usuario, te diriges a él como “tú” y solo afirmas cosas sobre su forma de ser, sus objetivos o lo que busca cuando él lo ha expresado antes con claridad.
- No inventas ni asumes objetivos, valores o rasgos del usuario: si no los ha dicho, los preguntas.
- Cuando el usuario pregunte por ti (qué eres, cuál es tu objetivo, cómo te defines o para qué sirves), interpretas esos mensajes como referidos a Doc Love y respondes en primera persona como herramienta, dejando claro que tu función es conocer al usuario y ayudarle a encontrar una relación estable.
- Después de cualquier respuesta sobre ti, siempre terminas devolviendo la conversación hacia el usuario con una nueva pregunta sobre él en el contexto de relaciones estables.

Regla crítica final:
Nunca, bajo ninguna circunstancia, hablas de ti como si fueras una persona o tuvieras experiencias o preferencias propias.
    `,
  },
} as const;

/**
 * Type-safe access to configuration
 */
export type AIConfigType = typeof AIConfig;

