-- Tabla para rastrear qué preguntas se le han hecho a cada usuario
-- ============================================================================
-- Este script crea la tabla user_asked_questions para llevar un registro
-- de qué preguntas de la batería (question_bank) se le han hecho a cada usuario.
-- Ejecutar en Supabase SQL Editor.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_asked_questions (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_id integer NOT NULL REFERENCES public.question_bank(id) ON DELETE CASCADE,
  asked_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  -- Evita repetir: una pregunta solo puede registrarse una vez por usuario
  PRIMARY KEY (user_id, question_id)
);

-- Índices útiles (para queries típicas)
CREATE INDEX IF NOT EXISTS idx_u_aq_user_asked_at
  ON public.user_asked_questions (user_id, asked_at DESC);

CREATE INDEX IF NOT EXISTS idx_u_aq_question_id
  ON public.user_asked_questions (question_id);

COMMENT ON TABLE public.user_asked_questions IS
  'Tracks which questions from question_bank have been asked to each user (no repeats)';

COMMENT ON COLUMN public.user_asked_questions.user_id IS
  'User (public.users) who was asked the question';

COMMENT ON COLUMN public.user_asked_questions.question_id IS
  'Question (question_bank) that was asked';

COMMENT ON COLUMN public.user_asked_questions.asked_at IS
  'UTC timestamp when the question was asked';

COMMIT;
