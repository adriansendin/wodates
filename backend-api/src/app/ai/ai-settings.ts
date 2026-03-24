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
   * - Updating database schema if dimension changes (vector(1536) -> vector(NEW_DIM))
   * - Updating all code that references the dimension (1536)
   */
  EMBEDDING: {
    DEFAULT_MODEL: 'text-embedding-3-small',
    DIMENSION: 1536, // Fixed dimension for OpenAI text-embedding-3-small
  },
} as const;

/**
 * Supported UI/prompt locales. Used to serve content in the user's language.
 */
export type Locale = 'en' | 'es';

/**
 * Normalizes a locale string to Locale.
 * Forced to Spanish in this project (English code/prompt strings remain intact).
 */
const FORCE_AI_LOCALE: Locale | null = 'es';

export function normalizeLocale(locale?: string | null): Locale {
  // Forced Spanish mode:
  // - Keep English prompt strings/code intact
  // - But ensure all locale resolution uses Spanish
  if (FORCE_AI_LOCALE) return FORCE_AI_LOCALE;
  if (locale?.toLowerCase().startsWith('es')) return 'es';
  return 'en';
}

/**
 * AI Configuration - Single Source of Truth
 */
export const AIConfig = {
  /**
   * Global AI kill-switch
   * When false, all AI functionality is completely disabled
   * No LLM calls, embeddings, or AI jobs will be executed
   */
  enabled: process.env.AI_ENABLED !== 'false', // Default to true if not set

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
   * AI Service configuration
   * URL base for the external ai-service HTTP API
   */
  aiService: {
    baseUrl:
      process.env.AI_SERVICE_BASE_URL ||
      process.env.AI_SERVICE_URL ||
      'http://127.0.0.1:8010',
    timeout: process.env.AI_SERVICE_TIMEOUT
      ? parseInt(process.env.AI_SERVICE_TIMEOUT, 10)
      : 60000, // 60 seconds default (for chat operations)
    profileTimeout: process.env.AI_SERVICE_PROFILE_TIMEOUT
      ? parseInt(process.env.AI_SERVICE_PROFILE_TIMEOUT, 10)
      : 660000, // 11 minutes default (for profile generation/merging operations)
  },

  /**
   * Feature flag for affinity sentences generation
   * If false, affinity sentences feature is disabled and returns empty array
   */
  affinitySentencesEnabled: process.env.AFFINITY_ENABLED === 'true',

  /** Returns fallback sentence(s) for affinity when profiles are missing, in the given locale. */
  getAffinitySentencesFallback(locale: Locale = 'es'): string[] {
    return locale === 'es'
      ? ['La afinidad inicial es baja—la conversación afinará las recomendaciones.']
      : ['Initial affinity is low—conversation will refine the recommendations.'];
  },

  /**
   * Prompt configuration (shared across all providers).
   * Prompt getters accept an optional locale (default 'en').
   */
  prompt: {
    /**
     * Instructions for generating affinity sentences for feed candidates
     */
    affinitySentences: {
      _basePromptEs: `Escribe EXACTAMENTE 1 frase (máx. 30 palabras) explicando por qué podrían encajar.

REGLA #1: NO inventes nada. Usa SOLO información explícitamente respaldada por AMBOS perfiles.

PRIORIDAD CRÍTICA:
- Si existen hábitos, rutinas, actividades o patrones de estilo de vida CONCRETOS compartidos (p. ej., leer, caminar, ritmos diarios, intensidad social), DEBES priorizarlos frente a rasgos o valores abstractos.
- Usa valores abstractos (p. ej., madurez emocional, honestidad, seriedad) SOLO si no hay conductas compartidas concretas, o para complementarlas muy brevemente.

Otras reglas:
- NUNCA menciones ubicación compartida, ciudad, barrio o proximidad geográfica, incluso si ambos perfiles coinciden claramente.
- Un punto compartido puede ser el mismo tema expresado de forma distinta SOLO si está claramente respaldado por AMBOS.
- Evita resúmenes vagos como “son similares” o “comparten valores” sin especificar cómo.
- Evita nombres, empresas, lugares exactos o detalles sensibles.
- Si hay menos de 2 puntos claros en común, escribe EXACTAMENTE:
La afinidad inicial es baja—la conversación afinará las recomendaciones.
- Devuelve SOLO la frase. Sin texto extra. Sin explicación.
`,
      _basePromptEn: `Write EXACTLY 1 sentence (max 30 words) explaining why they might be a good match.

RULE #1: Do NOT make anything up. Use ONLY information explicitly supported by BOTH profiles.

CRITICAL PRIORITY:
- If there are concrete shared habits, routines, activities or lifestyle patterns (e.g. reading, walking, daily rhythms, social intensity), you MUST prioritise them over abstract traits or values.
- Use abstract values (e.g. emotional maturity, honesty, seriousness) ONLY when there are no concrete shared behaviours, or to briefly complement them.

Other rules:
- NEVER mention shared location, city, neighbourhood or geographic proximity, even if both profiles clearly match.
- A shared point can be the same topic expressed differently ONLY if clearly supported by BOTH.
- Avoid vague summaries like "they are similar" or "they share values" without specifying how.
- Avoid names, companies, exact places or sensitive details.
- If there are fewer than 2 clear points in common, write EXACTLY:
Initial affinity is low—conversation will refine the recommendations.
- Return ONLY the sentence. No extra text. No explanation.
`,
      basePrompt(locale: Locale = 'es'): string {
        return locale === 'es' ? this._basePromptEs : this._basePromptEn;
      },
      /** Builds the complete prompt with user profiles. Pass locale for prompt language and fallback text. */
      buildPrompt(
        currentUserProfile: string,
        candidateUserProfile: string,
        locale: Locale = 'es'
      ): string {
        const base = this.basePrompt(locale);
        if (locale === 'es') {
          return `${base}

PERFIL DEL USUARIO ACTUAL (quien está viendo el feed):
"""
${currentUserProfile}
"""

PERFIL DEL CANDIDATO (el mostrado en el feed):
"""
${candidateUserProfile}
"""

Ahora genera la frase basándote estrictamente en estos perfiles.`;
        }
        return `${base}

CURRENT USER PROFILE (viewing the feed):
"""
${currentUserProfile}
"""

CANDIDATE PROFILE (shown in the feed):
"""
${candidateUserProfile}
"""

Now generate the sentence strictly based on these profiles.`;
      },
    },

    /**
     * System instructions for Doc Love. Pass locale so Doc Love responds in the user's language.
     */
    systemInstructions(locale: Locale = 'es'): string {
      const seedTopicsEs = [
        // Culture & curiosity
        'libros, series, pelis, podcasts o contenido que te haya gustado últimamente',
        'lo último que te enganchó de verdad (tema, libro, serie, canal)',
        'un plan cultural que disfrutes de verdad (conciertos, museos, cine, espectáculos)',
        'un plan “diferente” que te gustaría hacer pronto, fuera de tu rutina',
        'un interés de nicho del que podrías hablar durante horas',
        'cuánta curiosidad tienes en el día a día: aprender vs comodidad',
        'tu relación con probar cosas nuevas vs quedarte con tus favoritos',

        // Current life context
        'en qué etapa de vida estás ahora (calma, intensidad, cambios)',
        'qué te ocupa más la cabeza últimamente (en el buen sentido)',
        'qué da sentido a tus días estos meses',
        'cómo es una semana normal para ti ahora mismo',
        'qué te gustaría que alguien entendiera sobre tu ritmo actual',
        'qué ritmo de relación encaja de forma realista con tu vida ahora',
        'qué quieres cambiar en tu día a día durante el próximo año',

        // Work & life direction
        'qué papel juega el trabajo en tu vida (medio vs principal)',
        'qué es lo que más disfrutas de tu trabajo o tareas diarias',
        'cómo equilibras ambición y vida personal',
        'si prefieres estabilidad o cambio en la vida',
        'qué es “progreso” para ti durante el próximo año',
        'cómo te imaginas tu vida en 2–3 años (ritmo, hogar, prioridades)',
        'cómo llevas épocas muy ocupadas vs más tranquilas',

        // Friends & real social life
        'tu plan típico con amigos (casa, bar, actividad, algo distinto)',
        'tu ritmo social (a menudo vs menos pero con significado)',
        'si tu círculo es más amplio o más profundo (íntimos vs muchos conocidos)',
        'qué valoras más en amistades (lealtad, humor, honestidad, apoyo)',
        'tu “rol” en grupos (organizador, te sumas, pegamento)',
        'cómo te sientes después de planes sociales (energía vs recargar)',

        // Family & close bonds
        'con quién te sientes más cercano en tu familia',
        'cómo son las comidas familiares (calmas, intensas, divertidas, silenciosas)',
        'cómo maneja tu familia la cercanía (hablarlo vs cada uno a lo suyo)',
        'una tradición familiar que te gustaría mantener a largo plazo',
        'cada cuánto te gusta ver a tu familia (a menudo vs a veces pero con calidad)',
        'qué aprendiste de tu familia sobre las relaciones',

        // Home & living together
        'tu ambiente ideal de hogar (refugio tranquilo vs vivo y social)',
        'tu nivel natural de orden (ordenado, caos organizado, depende)',
        'tus no-negociables en casa (silencio, limpieza, cocinar, música, rutinas)',
        'tu “rincón” en casa y cómo desconectas',
        'qué te iría molestando poco a poco al compartir espacio',
        'cómo te sientes con vivir juntos (emocionante vs gran paso)',
        'cómo te gusta compartir espacio (juntos pero independientes vs muy integrados)',

        // Everyday habits at home
        'tu rutina de noche (pantallas, lectura, hábitos de sueño)',
        'tu estándar mínimo de orden/limpieza para sentirte cómodo',
        'pequeños rituales diarios que te asientan',
        'cómo te gusta que se sientan mañanas y noches',
        'cómo recargas después de un día largo',
        'cómo llevas tareas y responsabilidades en el día a día',

        // Health & self-care
        'un hábito que te gustaría mejorar este año',
        'qué es el autocuidado para ti (realista, no ideal)',
        'cómo gestionas el estrés en la práctica (qué te funciona)',
        'tu estilo natural de energía (activo vs ritmo más lento)',
        'si eres más de madrugar o trasnochar',
        'qué te ayuda a sentirte centrado cuando la vida está caótica',
        'cómo te llevas con las rutinas de salud (fácil vs esfuerzo)',

        // Humour & how you enjoy life
        'qué te hace reír incluso cuando estás cansado',
        'tu estilo de humor (absurdo, sarcástico, negro, tonto, inteligente)',
        'si te sueltas rápido o tardas en bromear',
        'teasing juguetón: ¿te gusta o te molesta?',
        'un plan que siempre disfrutas, pase lo que pase',
        'cómo te gusta divertirte sin que se sienta forzado',

        // Communication
        'tu ritmo ideal de mensajes (a diario vs más espacio)',
        'qué te molesta en los chats (respuestas lentas, monosílabos, exceso)',
        'preferencia por texto vs notas de voz vs llamadas',
        'qué opinas de rituales como el “buenos días” por mensaje',
        'tu ritmo: quedar pronto vs chatear un tiempo antes',
        'cómo te gusta resolver malentendidos (rápido vs necesitas tiempo)',
        'qué es buena comunicación para ti en el día a día',

        // Conflict & repair
        'cómo prefieres manejar tensión (hablar ya vs enfriar antes)',
        'tus “no” en conflicto (gritos, silencio, sarcasmo, culpar)',
        'qué te hace sentir seguro durante un desacuerdo',
        'cómo reparas después de un mal momento (disculpa, espacio, acción)',
        'qué necesitas de alguien cuando estás estresado o mal',

        // Boundaries & deal-breakers
        'dos comportamientos que te parecen irrespetuosos en pareja',
        'qué necesitas día a día para estar a gusto (claridad, espacio, planes, mensajes)',
        'una dinámica que no quieres repetir del pasado',
        'qué te corta el interés rápido al conocer a alguien',
        'un hábito en otra persona que te costaría convivir',
        'tus límites personales sobre tiempo, espacio e independencia',

        // Commitment & long-term
        'qué significa para ti “ser serio” después de unos meses',
        'cómo imaginas construir una vida juntos (hogar compartido vs separado)',
        'tu comodidad con cercanía vs independencia a largo plazo',
        'qué es compromiso en la práctica para ti (tiempo, prioridades, constancia)',

        // Dates & first impressions
        'tu primera cita ideal (café, paseo, cena, algo divertido)',
        'vibe-check rápido vs primera cita larga: qué te va mejor',
        'si sueles ir profundo pronto o mantenerlo ligero al principio',
        'qué te gusta que pase después de una gran primera cita',
        'señales pequeñas que te hacen pensar “aquí hay algo”',

        // Nights out & downtime
        'tu plan relajado por defecto (tranquilo, aire libre, algo de beber, quedarse en casa)',
        'salir a bailar vs conversación tranquila: qué prefieres',
        'tu relación con el alcohol en tu vida social (mucho vs casi nada)',
        'cómo te gusta pasar el rato cuando tienes poca energía',
        'qué es un buen fin de semana para ti (recargar vs planes)',

        // Money & spending style
        'tu estilo de gasto (ahorrador, experiencias, equilibrado)',
        'cómo te gusta planificar gastos (estructurado vs espontáneo)',
        'planes sencillos vs caprichos frecuentes: qué te sale natural',
        'en qué gastas sin culpa',
        'qué harías con dinero extra mañana (ahorrar vs convertirlo en un plan)',

        // Pets & animals
        'mascotas en tu vida (tienes, quieres, no te encajan)',
        'más de perros, de gatos o ninguno',
        'cómo te sientes viviendo en una casa con mascotas (plus vs engorro)',
        'una historia graciosa o tierna con animales (si tienes)',
        'si que alguien sea muy de mascotas es un plus para ti',

        // Relationship logistics & pace
        'tu ritmo ideal de cercanía (cuántos días a la semana te gustaría ver a tu pareja)',
        'si vives la vida más “local” o te mueves por toda la ciudad',
        'planes entre semana vs reservar planes para el finde',
        'qué tiempo de desplazamiento te parece razonable para quedar',
        'cómo equilibras independencia y estar juntos',
      ];

      const seedTopicsEn = [
        'books, series, films, podcasts or content you’ve enjoyed lately',
        'something that really hooked you recently (topic, book, series, channel)',
        'a cultural plan you genuinely enjoy (concerts, museums, cinema, shows)',
        'a “different” plan you’d like to do soon, outside your routine',
        'a niche interest you could talk about for hours',
        'how curious you are day to day: learning vs comfort',
        'trying new things vs sticking with favourites',
        'what life stage you’re in now (calm, intensity, change)',
        'what’s on your mind lately (in a good way)',
        'what gives your days meaning these months',
        'what a normal week looks like for you right now',
        'what you’d want someone to understand about your current pace',
        'what relationship pace fits realistically with your life now',
        'what you want to change in your day-to-day over the next year',
        'what role work plays in your life (means vs main focus)',
        'what you enjoy most about your job or daily tasks',
        'how you balance ambition and personal life',
        'whether you prefer stability or change in life',
        'what “progress” means to you over the next year',
        'how you imagine your life in 2–3 years (pace, home, priorities)',
        'how you handle very busy vs quieter periods',
        'your typical plan with friends (home, bar, activity, something different)',
        'your social pace (often vs less but meaningful)',
        'whether your circle is wider or deeper (close vs many acquaintances)',
        'what you value most in friendships (loyalty, humour, honesty, support)',
        'your “role” in groups (organiser, joiner, glue)',
        'how you feel after social plans (energy vs recharge)',
        'who you feel closest to in your family',
        'what family meals are like (calm, intense, fun, quiet)',
        'how your family handles closeness (talking vs each to their own)',
        'a family tradition you’d like to keep long term',
        'how often you like seeing family (often vs sometimes but quality)',
        'what you learned from your family about relationships',
        'your ideal home vibe (quiet refuge vs lively and social)',
        'your natural level of order (tidy, organised chaos, depends)',
        'non-negotiables at home (quiet, cleanliness, cooking, music, routines)',
        'your “corner” at home and how you unwind',
        'what would bother you gradually when sharing space',
        'how you feel about living together (exciting vs big step)',
        'how you like sharing space (together but independent vs very integrated)',
        'your evening routine (screens, reading, sleep habits)',
        'your minimum standard of order/cleanliness to feel comfortable',
        'small daily rituals that ground you',
        'how you like mornings and evenings to feel',
        'how you recharge after a long day',
        'how you handle tasks and responsibilities day to day',
        'a habit you’d like to improve this year',
        'what self-care means to you (realistic, not ideal)',
        'how you manage stress in practice (what works for you)',
        'your natural energy style (active vs slower pace)',
        'whether you’re more a morning or night person',
        'what helps you feel centred when life is chaotic',
        'how you get on with health routines (easy vs effort)',
        'what makes you laugh even when you’re tired',
        'your humour style (absurd, sarcastic, dark, silly, witty)',
        'whether you loosen up quickly or take time to joke',
        'playful teasing: do you like it or find it annoying?',
        'a plan you always enjoy, no matter what',
        'how you like to have fun without it feeling forced',
        'your ideal message pace (daily vs more space)',
        'what bothers you in chats (slow replies, one-word answers, excess)',
        'preference for text vs voice notes vs calls',
        'your view on rituals like “good morning” by message',
        'your pace: meeting soon vs chatting a while first',
        'how you like to resolve misunderstandings (quick vs need time)',
        'what good communication means to you day to day',
        'how you prefer to handle tension (talk now vs cool off first)',
        'your “no”s in conflict (shouting, silence, sarcasm, blaming)',
        'what makes you feel safe during a disagreement',
        'how you repair after a bad moment (apology, space, action)',
        'what you need from someone when you’re stressed or low',
        'two behaviours you find disrespectful in a partner',
        'what you need day to day to feel good (clarity, space, plans, messages)',
        'a dynamic you don’t want to repeat from the past',
        'what kills your interest quickly when meeting someone',
        'a habit in someone else you’d find hard to live with',
        'your boundaries around time, space and independence',
        'what “being serious” means to you after a few months',
        'how you imagine building a life together (shared home vs separate)',
        'your comfort with closeness vs independence long term',
        'what commitment means in practice for you (time, priorities, consistency)',
        'your ideal first date (coffee, walk, dinner, something fun)',
        'quick vibe-check vs longer first date: what works better for you',
        'whether you go deep soon or keep it light at first',
        'what you like to happen after a great first date',
        'small signs that make you think “there’s something here”',
        'your default relaxed plan (chill, outdoors, a drink, staying in)',
        'going dancing vs quiet conversation: what you prefer',
        'your relationship with alcohol in social life (a lot vs almost none)',
        'how you like to spend time when you have low energy',
        'what a good weekend looks like for you (recharge vs plans)',
        'your spending style (saver, experiences, balanced)',
        'how you like to plan spending (structured vs spontaneous)',
        'simple plans vs frequent treats: what comes naturally',
        'what you spend on without guilt',
        'what you’d do with extra money tomorrow (save vs turn it into a plan)',
        'pets in your life (have them, want them, not for you)',
        'more of a dog person, cat person or neither',
        'how you feel about living in a home with pets (plus vs hassle)',
        'a funny or sweet animal story (if you have one)',
        'whether someone being very into pets is a plus for you',
        'your ideal closeness pace (how many days a week you’d like to see a partner)',
        'whether you live more “local” or move around the whole city',
        'weekday plans vs saving plans for the weekend',
        'what travel time to meet up feels reasonable to you',
        'how you balance independence and being together',
      ];

      const seedTopics = locale === 'es' ? seedTopicsEs : seedTopicsEn;
      const getDocLoveSeedTopic = (): string => {
        const randomIndex = Math.floor(Math.random() * seedTopics.length);
        return seedTopics[randomIndex]!;
      };
      const seedTopic = getDocLoveSeedTopic();

      if (locale === 'es') {
        return `Eres Doc Love, una herramienta que ayuda a entender al usuario para encontrar una relación compatible y seria a largo plazo.
No eres una persona y no tienes experiencias personales.

En este turno, si el mensaje del usuario contiene un tema claro, mantente en ese tema y haz una pregunta de seguimiento más profunda.
Si el mensaje del usuario es solo un saludo, muy corto, o pide cambiar la pregunta, inicia un tema nuevo inspirado por: ${seedTopic}.

Reglas:
- Responde en español.
- Mantén respuestas cortas: 1–3 frases.
- Haz exactamente UNA pregunta clara.
- NO te presentes salvo que te lo pidan explícitamente.
- Si al usuario no le gusta una pregunta, no la repitas; cambia de tema y haz otra pregunta distinta.
- Si el usuario se va de tema, responde en 1 frase y redirige con una pregunta sobre el usuario.

Nunca hables como si fueras una persona.
`;
      }
      return `You are Doc Love, a tool that helps understand the user to find a compatible, serious long-term relationship.
You are not a person and have no personal experiences.

This turn: if the user's message has a clear topic, stay on that topic and ask a deeper follow-up question.
If the user's message is just a greeting, very short, or asks to change the question, start a new topic inspired by: ${seedTopic}.

Rules:
- Respond in English.
- Keep answers short: 1–3 sentences.
- Ask exactly ONE clear question.
- Do NOT introduce yourself unless explicitly asked.
- If the user doesn't like a question, don't repeat it; change topic and ask a different question.
- If the user goes off-topic, reply in 1 sentence and redirect with a question about the user.

Never speak as if you were a person.
`;
    },

    /**
     * Instructions for generating user bio from structured profile summary
     * Used by backend to generate short bios for display in Discover feed
     */
    bioGeneration(locale: Locale = 'es'): string {
      if (locale !== 'es') {
        return `ROLE:
You are an assistant that writes a short bio for a Discover card (mobile).
Adult, natural and approachable tone. Do not sound like a report.

INPUT:
A structured profile in 11 lines (e.g. "Basic identity: …", "Preferences and interests: …").

TASK:
Generate ONE bio in prose (a single paragraph), based ONLY on explicit data from the profile.

RULES:
- Third person singular only (never "I / me / my").
- Use the pronouns given in the prompt (he, she).
- Maximum 340 characters (including spaces). 1–2 sentences. No lists. No line breaks.
- No emojis, quotes, titles or speaker labels.
- NEVER write "Doc Love:" or any prefix. Return only the bio text.
- Pick 2–3 most differentiating compatibility signals (concrete plans, lifestyle, explicit relationship preferences). Ignore "no data".
- Do not invent or infer. No causality or psychologising.
- Do not pad with repeated characters or empty text.
- If you hit the limit, end naturally.
- If there are boundaries or deal-breakers, express them as clear positive preferences (no ultimatums).

OUTPUT:
Return ONLY the bio text.`;
      }
      return `ROL:
Eres un asistente que escribe una bio corta para una tarjeta de Discover (móvil).
Tono adulto, natural y cercano. No suenes a informe.

ENTRADA:
Un perfil estructurado en 11 líneas (p. ej. “Basic identity: …”, “Preferences and interests: …”).

TAREA:
Genera UNA bio en prosa (un único párrafo), basada SOLO en datos explícitos del perfil.

REGLAS:
- Solo tercera persona del singular (nunca “yo / me / mi”).
- Usa los pronombres proporcionados en el prompt (él, ella).
- Máximo 340 caracteres (incluyendo espacios). 1–2 frases. Sin listas. Sin saltos de línea.
- Sin emojis, comillas, títulos ni etiquetas de hablante.
- NUNCA escribas “Doc Love:” ni ningún prefijo. Devuelve solo el texto de la bio.
- Elige 2–3 señales de compatibilidad más diferenciadoras (planes concretos, estilo de vida, preferencias relacionales explícitas). Ignora “no data”.
- No inventes ni infieras. Sin causalidad ni psicologizar.
- No rellenes con caracteres repetidos o texto vacío.
- Si llegas al límite, termina de forma natural.
- Si hay límites o rechazos, exprésalos como preferencias positivas claras (sin ultimátums).

SALIDA:
Devuelve SOLO el texto de la bio.`;
    },

    /**
     * Instructions for generating user personality summaries
     * Used by ai-service to create/update user AI profiles
     *
     * IMPORTANT: The result will be used as direct input for an embedding model.
     * Must be PLAIN TEXT in English, very clear, structured by fixed lines/sections
     * (one line per section) and without technical formatting.
     */
    summarizerInstructions: {
      /**
       * Base introduction for the summarizer
       * Note: Empty since createNew prompt is self-contained with its own ROL section
       */
      introduction: ``,

      /**
       * Instructions for creating a new summary (cuando no existe perfil previo)
       */
      createNew: `ROL:
Eres un asistente especializado en extracción factual y síntesis limpia para generar perfiles estructurados para matching por embeddings.
Conviertes conversaciones tipo chat en información clara y normalizada sin interpretación.
No inventes ni infieras; usa solo lo que el usuario indique explícitamente.

CONTEXTO:
Recibirás chats tipo WhatsApp con múltiples participantes.
Solo un participante está marcado con “(MAIN)” tras su nombre. Es el usuario cuyo perfil debes construir.
Todos los demás participantes (usuarios o bots) son solo contexto y deben ignorarse para la extracción.

OBJETIVO:
Construir un perfil estructurado en inglés compuesto por exactamente 11 secciones fijas,
usando solo datos explícitos expresados por el usuario marcado como “(MAIN)”.
El resultado se usará para generar embeddings para matching, por lo que debe contener información diferenciadora y evitar contenido genérico.

REGLA PRINCIPAL:
Extrae SOLO información de mensajes escritos por el usuario marcado como “(MAIN)”.
Ignora por completo cualquier cosa dicha por otros participantes o sobre el MAIN.

REGLA DE SEÑAL (CRÍTICA):
Incluye solo información útil para diferenciar compatibilidad (hechos y preferencias concretas).
Excluye afirmaciones universales o poco discriminativas, como:
“honest”, “respectful”, “good person”, “empathetic”, “has values”, “likes to connect”,
“looking for something serious”, “normal”, “friendly”, “likes to travel” sin detalles concretos.

REGLA DE CONTRASTE (CRÍTICA):
Cuando el MAIN exprese hábitos, preferencias o rasgos que impliquen incompatibilidad con otros estilos de vida
(ritmo, estructura, energía, necesidad de control, improvisación, estabilidad, intensidad emocional),
exprésalos explícitamente y de forma directa, sin suavizar ni equilibrar el lenguaje.
Prioriza el contraste sobre la neutralidad.

REGLA DE PRIORIDAD:
Si hay demasiada información posible en una sección, prioriza lo más específico,
observable y discriminativo (actividades concretas, preferencias, rechazos, trabajo/estudios, planes).
No repitas ideas similares.

REGLAS DE EXTRACCIÓN:
- Usa solo información clara y literal indicada por el MAIN.
- Normaliza ortografía y estilo preservando el significado exacto.
- No interpretes ni deduzcas información no indicada.
- No embellezcas, suavices, intensifiques o transformes preferencias.
- No fusiones frases para crear nuevos significados.
- Elimina por completo ruido conversacional (“haha”, “ok”, “sí/no” sin contexto, etc.).
- Si el MAIN habla de otras personas, incluye solo lo que revele sobre el MAIN (p. ej., “has children”, “goes out with friends”), nunca perfiles de otros.
- Distingue hechos actuales de deseos o planes: si el MAIN expresa una intención futura (“I want to go to Japan”, “I’d like to join X”), regístrala explícitamente como plan/deseo, no como hecho completado.

REGLAS POR SECCIÓN (para evitar contenido genérico):
- Basic identity: solo datos concretos (edad, ciudad, idiomas, hijos, mascotas, hábitos objetivos).
- Communication style: solo preferencias/aversiones observables (p. ej., “prefers calls”, “doesn’t like voice notes”, “replies late due to work”). Si no hay, escribe “no data”.
- Personality: incluye rasgos explícitos o claramente implícitos derivados de hábitos, rutinas o aversiones descritas por el MAIN, solo si afectan compatibilidad.
  Si no hay base explícita, escribe “no data”.
- Preferences and interests: hobbies, deportes, música, comida, ocio y planes concretos. Evita generalidades vagas.
- Dislikes and deal-breakers: límites o aversiones concretas (p. ej., “does not smoke”, “no clubs”, “no drugs”).
- Activities and real life: actividades reales y frecuencia/contexto si se menciona (p. ej., “gym three days a week”, “weekend hiking”).
- Work and education: profesión, sector, estudios concretos.
- Personal and relational values: solo no-negociables explícitos (p. ej., “monogamy”, “no infidelity”, religión X si se menciona). Valores universales → “no data”.
- Relationship preferences: metas y condiciones concretas (p. ej., relación a largo plazo, hijos sí/no, convivencia, ritmo, distancia).
- Behavioral patterns: hábitos repetidos que afecten compatibilidad (p. ej., madrugador, trasnochador, viajes por trabajo, necesidad de tiempo a solas). Si es genérico, escribe “no data”.
- Relevant verbatim quotes: 1 a 3 frases literales del MAIN que sean diferenciadoras (preferencias, actividades, rechazos, planes). Si no existen, escribe “no data”.

SECTIONS (MANDATORY ORDER):
The profile must contain exactly these 11 lines, in this exact order, with these exact headers:
Basic identity: ...
Communication style: ...
Personality: ...
Preferences and interests: ...
Dislikes and deal-breakers: ...
Activities and real life: ...
Work and education: ...
Personal and relational values: ...
Relationship preferences: ...
Behavioral patterns: ...
Relevant verbatim quotes: ...

REGLAS DE FORMATO:
- Devuelve SOLO el perfil final, sin explicaciones ni texto extra.
- Cada sección debe tener de 1 a 3 frases, máximo 50 palabras por sección.
- No uses listas, viñetas, markdown, tablas ni JSON.
- Si una sección NO tiene datos explícitos, útiles y diferenciadores del MAIN, escribe exactamente: “no data”.
- “Relevant verbatim quotes” debe contener de 1 a 3 frases literales del MAIN; si no existen, escribe “no data”.

INSTRUCCIONES DE TRABAJO:
1. Identifica todos los mensajes escritos por el usuario marcado como “(MAIN)”.
2. Extrae solo información factual, relevante, explícita y diferenciadora para matching.
3. Normaliza ortografía preservando el significado literal.
4. Elimina ruido.
5. Construye las 11 secciones con frases claras y sin interpretación: en las 10 primeras usa la información extraída; en la undécima (Relevant verbatim quotes), copia 1 a 3 frases literales del MAIN si aportan señal; si no, escribe "no data".

Ahora genera el perfil EXACTAMENTE en este formato usando SOLO la información explícita de mensajes escritos por el usuario marcado como “(MAIN)”.
`,

      /**
       * Instructions for merging two summaries (consolidated summary + incremental summary)
       * Used to merge existing consolidated summary with new incremental summary
       */
      mergeSummaries: `Fusiona los dos perfiles de usuario en UN único perfil actualizado.

PERFIL BASE (información previamente consolidada):
"""
{{PROFILE_1}}
"""

PERFIL INCREMENTAL (información reciente nueva):
"""
{{PROFILE_2}}
"""

INSTRUCCIONES:
Actúas como un fusionador estricto de información, no como un redactor creativo.
Debes combinar el PERFIL BASE y el PERFIL INCREMENTAL en un único perfil coherente cuyo objetivo es maximizar la señal diferenciadora para compatibilidad y matching semántico.

REGLAS LÓGICAS:
- Trabaja sección por sección (Basic identity, Communication style, etc.).
- Lógica UNION:
  * Si un dato existe en el PERFIL BASE y NO es contradicho explícitamente por el PERFIL INCREMENTAL, MANTÉNLO.
  * Si un dato aparece solo en el PERFIL INCREMENTAL, AÑÁDELO.
  * Si hay contradicción directa y explícita, el PERFIL INCREMENTAL tiene prioridad.
- No resumas eliminando detalles válidos y diferenciadores: preservar señal útil es preferible a perder información.
- NO inventes nada: solo puedes usar información explícita presente en cualquiera de los dos perfiles.
- No cambies el significado literal de los datos:
  * No reemplaces “Asian food” por “Chinese food” salvo que “Chinese” aparezca explícitamente.
  * No transformes “fear of clowns” en variantes distintas salvo que aparezcan literalmente.
- En “Relevant verbatim quotes”, solo puedes incluir frases que aparezcan literalmente en alguno de los perfiles (puedes eliminar duplicados).

REGLA DE CONTRASTE (CRÍTICA):
Cuando el PERFIL BASE o el PERFIL INCREMENTAL contengan hábitos, rutinas, preferencias, aversiones o patrones que impliquen incompatibilidad con otros estilos de vida
(ritmo diario, necesidad de estructura, improvisación, energía social, intensidad emocional, necesidad de control, estabilidad o caos),
debes expresarlos explícitamente y de forma directa.
No suavices, neutralices ni equilibres estos rasgos. Prioriza el contraste sobre la ambigüedad.

REGLA DE PERSONALIDAD (CRÍTICA):
En la sección “Personality”, incluye rasgos explícitos o claramente implícitos derivados de hábitos, rutinas, aversiones o estilos de vida descritos,
siempre que afecten a la compatibilidad (p. ej., necesidad de rutina, baja tolerancia al caos, alta intensidad emocional, necesidad de espacio personal, evitación del conflicto, preferencia por estabilidad).
Si no hay señal clara, escribe “no data”.

REGLA ANTI-GENÉRICA (CRÍTICA):
Elimina afirmaciones universales o poco discriminativas si no aportan señal real de compatibilidad
(p. ej., “honest”, “respectful”, “good person”, “empathetic”, “has values”, “likes to connect”, “looking for something serious” sin detalles concretos).
Si, tras eliminar contenido genérico, una sección queda sin señal útil, escribe “no data”.

REGLA DE PRIORIDAD:
Si una sección supera claramente el límite de 1–3 frases, conserva solo la información más específica, observable y discriminante.
Evita duplicados, reformulaciones o ideas suavizadas.

FORMATO DE SALIDA:
Debes devolver exactamente estas 11 secciones, en este orden, escritas en prosa continua:
Basic identity: ...
Communication style: ...
Personality: ...
Preferences and interests: ...
Dislikes and deal-breakers: ...
Activities and real life: ...
Work and education: ...
Personal and relational values: ...
Relationship preferences: ...
Behavioral patterns: ...
Relevant verbatim quotes: ...

REGLAS DE FORMATO:
- Responde SOLO con el perfil fusionado final (sin explicaciones adicionales).
- Cada sección debe contener de 1 a 3 frases (máx. 50 palabras por sección).
- Si una sección no tiene datos útiles y diferenciadores en alguno de los perfiles (o queda vacía tras eliminar lo genérico), escribe exactamente: “no data”.
- No uses JSON, markdown, listas ni viñetas.

Ahora genera SOLO el perfil fusionado final siguiendo todas estas reglas.
`,
    },
  },
} as const;

/**
 * Type-safe access to configuration
 */
export type AIConfigType = typeof AIConfig;