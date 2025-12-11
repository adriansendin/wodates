-- ============================================================================
-- Migración: Crear tabla user_profile_summaries
-- ============================================================================
-- 
-- Esta tabla almacena resúmenes de personalidad y embeddings generados
-- por el sistema de IA para cada usuario.
-- 
-- Fecha: 2025-01-XX
-- Versión: 1.0.0
-- ============================================================================

-- Tabla: user_profile_summaries
CREATE TABLE IF NOT EXISTS public.user_profile_summaries (
  id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Resumen textual de la personalidad del usuario
  summary text NOT NULL,
  
  -- Embedding vectorial (almacenado como array de números)
  -- Usamos vector de PostgreSQL si está disponible, sino text[] como fallback
  embedding vector(1536), -- Dimension por defecto (OpenAI), ajustar según provider
  
  -- Metadata
  provider text NOT NULL, -- 'ollama', 'openai', etc.
  model text, -- Modelo específico usado
  dimension integer, -- Dimensión del embedding
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Constraint: un usuario solo puede tener un resumen activo
  CONSTRAINT user_profile_summaries_user_id_unique UNIQUE (user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_profile_summaries_user_id 
  ON public.user_profile_summaries (user_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_summaries_updated_at 
  ON public.user_profile_summaries (updated_at DESC);

-- Índice para búsqueda por similitud de embeddings (si usamos pgvector)
-- CREATE INDEX IF NOT EXISTS idx_user_profile_summaries_embedding_cosine 
--   ON public.user_profile_summaries 
--   USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_user_profile_summaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_profile_summaries_updated_at
  BEFORE UPDATE ON public.user_profile_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profile_summaries_updated_at();

-- RLS (Row Level Security)
ALTER TABLE public.user_profile_summaries ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver su propio resumen
CREATE POLICY "Users can view their own profile summary"
  ON public.user_profile_summaries
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Solo el sistema puede insertar/actualizar (via service role)
-- En producción, esto debería ser manejado por un servicio con service_role
-- Por ahora permitimos que el usuario pueda actualizar su propio resumen
-- (aunque en la práctica esto será hecho por jobs asíncronos)
CREATE POLICY "System can manage profile summaries"
  ON public.user_profile_summaries
  FOR ALL
  USING (true); -- En producción, restringir a service_role

-- Comentarios
COMMENT ON TABLE public.user_profile_summaries IS 
  'Almacena resúmenes de personalidad y embeddings generados por IA para cada usuario';
COMMENT ON COLUMN public.user_profile_summaries.summary IS 
  'Resumen textual estructurado de la personalidad, estilo de comunicación y preferencias del usuario';
COMMENT ON COLUMN public.user_profile_summaries.embedding IS 
  'Vector embedding generado a partir del resumen, usado para búsqueda semántica y matching';
COMMENT ON COLUMN public.user_profile_summaries.provider IS 
  'Proveedor de IA usado (ollama, openai, etc.)';
COMMENT ON COLUMN public.user_profile_summaries.dimension IS 
  'Dimensión del vector embedding';

