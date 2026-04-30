-- Deep onboarding questionnaire (Crear cuenta2): blocks, question catalog, sessions, answers.
-- Run in Supabase SQL Editor. Backend reads catalog via service role and persists submissions.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.deep_onboarding_blocks (
  block_index INTEGER PRIMARY KEY CHECK (block_index BETWEEN 1 AND 4),
  intro_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.deep_onboarding_questions (
  code TEXT PRIMARY KEY,
  block_index INTEGER NOT NULL REFERENCES public.deep_onboarding_blocks (block_index) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  prompt_text TEXT NOT NULL,
  answer_type TEXT NOT NULL CHECK (answer_type IN ('single', 'multi', 'text')),
  max_chars INTEGER,
  max_selections INTEGER,
  options JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_deep_q_block_sort
  ON public.deep_onboarding_questions (block_index, sort_order);

CREATE TABLE IF NOT EXISTS public.deep_onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_session_id UUID NOT NULL UNIQUE,
  user_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_deep_sess_client ON public.deep_onboarding_sessions (client_session_id);
CREATE INDEX IF NOT EXISTS idx_deep_sess_user ON public.deep_onboarding_sessions (user_id);

CREATE TABLE IF NOT EXISTS public.deep_onboarding_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_uuid UUID NOT NULL REFERENCES public.deep_onboarding_sessions (id) ON DELETE CASCADE,
  question_code TEXT NOT NULL REFERENCES public.deep_onboarding_questions (code) ON DELETE CASCADE,
  question_text_snapshot TEXT NOT NULL,
  single_key TEXT,
  multi_keys TEXT[],
  text_answer TEXT,
  other_details JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (session_uuid, question_code)
);

CREATE INDEX IF NOT EXISTS idx_deep_ans_session ON public.deep_onboarding_answers (session_uuid);

COMMENT ON TABLE public.deep_onboarding_blocks IS 'Intro copy per questionnaire block';
COMMENT ON TABLE public.deep_onboarding_questions IS 'Canonical questionnaire items for affinity onboarding';
COMMENT ON TABLE public.deep_onboarding_sessions IS 'Anonymous or logged-in submission sessions';
COMMENT ON TABLE public.deep_onboarding_answers IS 'Per-question answers with snapshot of prompt text';

-- Seed blocks (idempotent)
INSERT INTO public.deep_onboarding_blocks (block_index, intro_text, sort_order)
VALUES
  (1, 'Queremos entender cómo te mueves en el día a día: tu energía, tu forma de relacionarte y cómo afrontas planes, cambios y desacuerdos. No buscamos encasillarte, sino captar patrones que nos ayuden a proponerte conexiones con más afinidad real.', 1),
  (2, 'La atracción inicial importa, pero el encaje cotidiano también. En este bloque buscamos entender tu ritmo, tu ocio y cómo ocupas tu tiempo, porque muchas compatibilidades reales nacen del día a día compartido y no solo de la química inicial.', 2),
  (3, 'Aquí queremos entender intención, valores y visión de pareja. Las conexiones más prometedoras no solo dependen de llevarse bien, sino también de buscar algo compatible en el momento vital adecuado.', 3),
  (4, 'No todo se reduce a gustos; también importa cómo encajan dos personas en lo cotidiano. Este bloque nos ayuda a detectar compatibilidades prácticas: sociabilidad, descanso, prioridades, convivencia y no negociables.', 4)
ON CONFLICT (block_index) DO UPDATE SET
  intro_text = EXCLUDED.intro_text,
  sort_order = EXCLUDED.sort_order;

-- Seed questions (idempotent)
INSERT INTO public.deep_onboarding_questions (code, block_index, sort_order, prompt_text, answer_type, max_chars, max_selections, options)
VALUES
  ('deep_q01', 1, 1, 'Cuando tienes un fin de semana libre, ¿qué te atrae más?', 'single', NULL, NULL,
   '[{"key":"try_new","label":"Probar algo nuevo"},{"key":"repeat_plan","label":"Repetir un plan que sé que disfruto"},{"key":"depends_company","label":"Depende sobre todo de la compañía"},{"key":"rest_go_with_flow","label":"Descansar y dejarme llevar"}]'::jsonb),
  ('deep_q02', 1, 2, 'Después de varios días intensos, ¿qué te recarga más?', 'single', NULL, NULL,
   '[{"key":"see_people_plans","label":"Ver gente y hacer planes"},{"key":"small_plan_close","label":"Un plan pequeño con alguien cercano"},{"key":"alone_time","label":"Tiempo a solas"},{"key":"depends_moment","label":"Depende mucho del momento"}]'::jsonb),
  ('deep_q03', 1, 3, 'En tu día a día, ¿cómo prefieres organizarte?', 'single', NULL, NULL,
   '[{"key":"very_planned","label":"Muy planificado"},{"key":"organized_margin","label":"Bastante organizado, con margen"},{"key":"flexible_responsible","label":"Flexible pero responsable"},{"key":"improvise","label":"Improviso bastante"}]'::jsonb),
  ('deep_q04', 1, 4, 'Cuando hay un desacuerdo con alguien que te importa, ¿qué te sale más natural?', 'single', NULL, NULL,
   '[{"key":"talk_soon","label":"Hablarlo pronto y de frente"},{"key":"take_time_then_talk","label":"Tomarme un tiempo y luego hablarlo"},{"key":"soften_escalate","label":"Intentar suavizarlo para que no escale"},{"key":"hard_to_manage","label":"Me cuesta bastante gestionarlo"}]'::jsonb),
  ('deep_q05', 1, 5, '¿Qué tipo de planes hacen que sientas que has aprovechado bien el día?', 'text', 250, NULL, NULL),
  ('deep_q06', 2, 1, '¿Cuál describe mejor tu ritmo de vida actual?', 'single', NULL, NULL,
   '[{"key":"very_active_social","label":"Muy activo y social"},{"key":"balanced","label":"Equilibrado"},{"key":"calm_selective","label":"Tranquilo y selectivo"},{"key":"changing_phases","label":"Cambiante según etapas"}]'::jsonb),
  ('deep_q07', 2, 2, '¿Qué papel tiene el deporte o la actividad física en tu vida?', 'single', NULL, NULL,
   '[{"key":"sport_central","label":"Central"},{"key":"sport_important","label":"Importante"},{"key":"sport_occasional","label":"Ocasional"},{"key":"sport_low","label":"Poco relevante"}]'::jsonb),
  ('deep_q08', 2, 3, '¿Cómo prefieres normalmente tus vacaciones?', 'single', NULL, NULL,
   '[{"key":"holidays_planned","label":"Muy planificadas"},{"key":"holidays_base_margin","label":"Con una base organizada, pero con margen"},{"key":"holidays_improvise","label":"Improvisadas"},{"key":"holidays_depends","label":"Depende mucho del destino y la compañía"}]'::jsonb),
  ('deep_q09', 2, 4, '¿Qué hobbies o actividades forman parte real de tu rutina?', 'text', 250, NULL, NULL),
  ('deep_q10', 2, 5, E'¿Qué tipo de planes o entretenimiento disfrutas más en tu tiempo libre?\n\nPuedes mencionar, por ejemplo: cine, series, podcasts, restaurantes, naturaleza, conciertos, deporte, lectura u otros.', 'text', 250, NULL, NULL),
  ('deep_q11', 3, 1, '¿Qué estás buscando ahora mismo?', 'single', NULL, NULL,
   '[{"key":"serious_build","label":"Relación seria con intención de construir"},{"key":"stable_no_rush","label":"Relación estable sin prisas"},{"key":"compatible_see","label":"Conocer a alguien compatible y ver qué pasa"},{"key":"not_clear_yet","label":"No lo tengo del todo claro aún"}]'::jsonb),
  ('deep_q12', 3, 2, '¿Qué peso tiene para ti formar familia o tener hijos?', 'single', NULL, NULL,
   '[{"key":"family_important","label":"Es importante"},{"key":"family_would_like","label":"Me gustaría, pero no es imprescindible"},{"key":"family_unclear","label":"No lo tengo claro"},{"key":"family_not_seeking","label":"No lo busco"}]'::jsonb),
  ('deep_q13', 3, 3, '¿Qué valoras más en una pareja? Elige hasta 3 opciones.', 'multi', NULL, 3,
   '[{"key":"honesty","label":"Honestidad"},{"key":"emotional_stability","label":"Estabilidad emocional"},{"key":"ambition","label":"Ambición"},{"key":"humor","label":"Sentido del humor"},{"key":"tenderness","label":"Ternura/afecto"},{"key":"intelligence","label":"Inteligencia"},{"key":"flexibility","label":"Flexibilidad"},{"key":"commitment","label":"Compromiso"},{"key":"communication","label":"Buena comunicación"},{"key":"shared_values","label":"Valores compartidos"}]'::jsonb),
  ('deep_q14', 3, 4, '¿Qué hace que te apetezca volver a ver a alguien después de una primera cita?', 'single', NULL, NULL,
   '[{"key":"comfort_trust","label":"Sentirme cómodo y en confianza"},{"key":"conversation_curiosity","label":"Tener conversación y curiosidad mutua"},{"key":"intention_clarity","label":"Notar claridad de intención"},{"key":"attraction_energy","label":"Sentir atracción y energía compartida"}]'::jsonb),
  ('deep_q15', 3, 5, '¿Qué has aprendido de relaciones pasadas que hoy tienes más claro?', 'text', 300, NULL, NULL),
  ('deep_q16', 4, 1, '¿Qué tipo de vida social encaja mejor contigo?', 'single', NULL, NULL,
   '[{"key":"social_often_out","label":"Salgo y conozco gente con frecuencia"},{"key":"social_few_good","label":"Prefiero pocos planes pero buenos"},{"key":"social_mix","label":"Una mezcla de ambos"},{"key":"social_home","label":"Bastante vida en casa"}]'::jsonb),
  ('deep_q17', 4, 2, '¿Cómo te relacionas con el descanso y el trabajo?', 'single', NULL, NULL,
   '[{"key":"ambitious_on_the_go","label":"Soy muy ambicioso y me gusta estar siempre en marcha"},{"key":"seek_balance","label":"Busco equilibrio"},{"key":"peace_quality","label":"Prioritizo paz y calidad de vida"},{"key":"changing_stage","label":"Estoy en una etapa de mucho cambio"}]'::jsonb),
  ('deep_q18', 4, 3, '¿Cuáles son tus no negociables reales? Elige hasta 3 opciones.', 'multi', NULL, 3,
   '[{"key":"dishonesty","label":"Falta de honestidad"},{"key":"bad_communication","label":"Mala comunicación"},{"key":"lack_ambition","label":"Falta de ambición o propósito"},{"key":"substance_issues","label":"Consumo problemático de sustancias"},{"key":"different_future","label":"Querer cosas distintas a futuro"},{"key":"emotional_instability","label":"Falta de estabilidad emocional"},{"key":"disrespect","label":"Falta de respeto"},{"key":"lifestyle_clash","label":"Incompatibilidad de estilo de vida"},{"key":"other_nonnegot","label":"Otro"}]'::jsonb),
  ('deep_q19', 4, 4, '¿Qué aspectos del día a día deberían encajar sí o sí con una pareja? Elige hasta 3 opciones.', 'multi', NULL, 3,
   '[{"key":"order_org","label":"Orden y organización"},{"key":"schedules_rest","label":"Horarios y descanso"},{"key":"socialize_style","label":"Manera de socializar"},{"key":"holidays_leisure","label":"Estilo de vacaciones y ocio"},{"key":"health_care","label":"Cuidado de la salud"},{"key":"spending_saving","label":"Forma de gastar y ahorrar"},{"key":"personal_space","label":"Necesidad de espacio personal"},{"key":"other_daily_fit","label":"Otro"}]'::jsonb),
  ('deep_q20', 4, 5, '¿Cómo sería para ti un fin de semana ideal en pareja?', 'text', 300, NULL, NULL)
ON CONFLICT (code) DO UPDATE SET
  block_index = EXCLUDED.block_index,
  sort_order = EXCLUDED.sort_order,
  prompt_text = EXCLUDED.prompt_text,
  answer_type = EXCLUDED.answer_type,
  max_chars = EXCLUDED.max_chars,
  max_selections = EXCLUDED.max_selections,
  options = EXCLUDED.options;

COMMIT;
