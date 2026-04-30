-- Asegura like mutuo + chat activo entre dos usuarios (mismo modelo que SupabaseMatchRepository.create).
--
-- Usuarios:
--   2c9ad9be-e118-4b45-a7ff-5afce71fb79a
--   8e4e976e-7dee-4880-8767-44269852df1c
--
-- - Upsert interactions (from_user, to_user) action = like en ambas direcciones (UNIQUE por par).
-- - Si ya existe un chat 1:1 entre ellos, no duplica chat ni participantes.
-- - Recalcula public.users.active_chats_count para ambos (chats con usuario real, sin bloqueos).

BEGIN;

DO $$
DECLARE
  v_a constant uuid := '2c9ad9be-e118-4b45-a7ff-5afce71fb79a';
  v_b constant uuid := '8e4e976e-7dee-4880-8767-44269852df1c';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_a) THEN
    RAISE EXCEPTION 'public.users no tiene fila para id %', v_a;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_b) THEN
    RAISE EXCEPTION 'public.users no tiene fila para id %', v_b;
  END IF;
END $$;

INSERT INTO public.interactions (from_user, to_user, action)
VALUES
  ('2c9ad9be-e118-4b45-a7ff-5afce71fb79a'::uuid, '8e4e976e-7dee-4880-8767-44269852df1c'::uuid, 'like'),
  ('8e4e976e-7dee-4880-8767-44269852df1c'::uuid, '2c9ad9be-e118-4b45-a7ff-5afce71fb79a'::uuid, 'like')
ON CONFLICT (from_user, to_user)
DO UPDATE SET action = 'like';

WITH existing AS (
  SELECT cp.chat_id
  FROM chat_participants cp
  INNER JOIN chat_participants cp2 ON cp.chat_id = cp2.chat_id
  WHERE cp.user_id = '2c9ad9be-e118-4b45-a7ff-5afce71fb79a'::uuid
    AND cp2.user_id = '8e4e976e-7dee-4880-8767-44269852df1c'::uuid
  LIMIT 1
),
new_chat AS (
  INSERT INTO public.chats (id)
  SELECT gen_random_uuid()
  WHERE NOT EXISTS (SELECT 1 FROM existing)
  RETURNING id
),
ins AS (
  INSERT INTO chat_participants (chat_id, user_id)
  SELECT nc.id, u.uid
  FROM new_chat nc
  CROSS JOIN (
    VALUES
      ('2c9ad9be-e118-4b45-a7ff-5afce71fb79a'::uuid),
      ('8e4e976e-7dee-4880-8767-44269852df1c'::uuid)
  ) AS u(uid)
  RETURNING chat_id
)
SELECT
  (SELECT chat_id FROM existing LIMIT 1) AS chat_id_previo,
  (SELECT id FROM new_chat LIMIT 1) AS chat_id_creado,
  (SELECT count(*) FROM ins) AS participantes_insertados;

UPDATE public.users u
SET active_chats_count = sub.cnt
FROM (
  SELECT
    uu.id,
    (
      SELECT COUNT(DISTINCT cp.chat_id)::integer
      FROM chat_participants cp
      INNER JOIN chat_participants cp2 ON cp.chat_id = cp2.chat_id AND cp.user_id <> cp2.user_id
      INNER JOIN public.users other ON other.id = cp2.user_id
      WHERE cp.user_id = uu.id
        AND (other.is_bot IS NOT TRUE)
        AND NOT EXISTS (
          SELECT 1
          FROM blocked_users bu
          WHERE (bu.blocker_id = cp.user_id AND bu.blocked_id = cp2.user_id)
             OR (bu.blocker_id = cp2.user_id AND bu.blocked_id = cp.user_id)
        )
    ) AS cnt
  FROM public.users uu
  WHERE uu.id IN (
    '2c9ad9be-e118-4b45-a7ff-5afce71fb79a'::uuid,
    '8e4e976e-7dee-4880-8767-44269852df1c'::uuid
  )
) AS sub
WHERE u.id = sub.id;

COMMIT;
