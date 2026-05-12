-- Fuerza likes hacia un usuario destino desde todos los chicos activos.
-- Replace placeholders demo-target@example.com / UUID before running.
-- Objetivo:
-- - Usuario destino (ejemplo): demo-target@example.com
-- - ID esperado en auth.users (ejemplo): 00000000-0000-4000-8000-00000000d3b0
-- - Origen de likes: usuarios con gender = 'male' y auth.users.deleted_at IS NULL (activos)
-- - Idempotente: la tabla tiene UNIQUE (from_user, to_user) — una sola fila por par;
--   si ya había "pass", se actualiza a "like" (ON CONFLICT DO UPDATE).

BEGIN;

DO $$
DECLARE
  v_target_id uuid;
  v_expected_id constant uuid := '00000000-0000-4000-8000-00000000d3b0';
  v_target_email constant text := 'demo-target@example.com';
BEGIN
  SELECT a.id
  INTO v_target_id
  FROM auth.users a
  WHERE lower(trim(a.email)) = lower(trim(v_target_email))
  LIMIT 1;

  IF v_target_id IS NULL THEN
    RAISE EXCEPTION
      'No se encontro usuario en auth.users para email %',
      v_target_email;
  END IF;

  IF v_target_id <> v_expected_id THEN
    RAISE EXCEPTION
      'El email % corresponde al id %, pero se esperaba %',
      v_target_email, v_target_id, v_expected_id;
  END IF;
END $$;

WITH target_user AS (
  SELECT a.id
  FROM auth.users a
  WHERE a.id = '00000000-0000-4000-8000-00000000d3b0'::uuid
    AND lower(trim(a.email)) = lower(trim('demo-target@example.com'))
),
eligible_males AS (
  SELECT u.id AS from_user_id
  FROM public.users u
  INNER JOIN auth.users au ON au.id = u.id
  INNER JOIN target_user t ON true
  WHERE u.id <> t.id
    AND u.gender = 'male'::public.user_gender
    AND au.deleted_at IS NULL
),
upserted AS (
  INSERT INTO public.interactions (from_user, to_user, action)
  SELECT
    em.from_user_id,
    t.id,
    'like'
  FROM eligible_males em
  CROSS JOIN target_user t
  ON CONFLICT (from_user, to_user)
  DO UPDATE SET
    action = 'like'
  RETURNING from_user, (xmax = 0) AS fue_insert
)
SELECT
  (SELECT count(*) FROM eligible_males) AS total_chicos_activos,
  (SELECT count(*) FROM upserted) AS filas_upsert,
  (SELECT count(*) FROM upserted WHERE fue_insert) AS inserts_nuevos,
  (SELECT count(*) FROM upserted WHERE NOT fue_insert) AS conflictos_actualizados_a_like,
  (
    SELECT count(*)
    FROM public.interactions i
    WHERE i.to_user = '00000000-0000-4000-8000-00000000d3b0'::uuid
      AND i.action = 'like'
  ) AS total_likes_hacia_objetivo;

COMMIT;
