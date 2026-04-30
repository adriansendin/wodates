-- Borra todos los likes y passes (dislikes) que un usuario ha DADO (salientes).
-- Efecto: esas personas vuelven a poder salir en Discover para ese usuario
-- (SupabaseFeedService excluye to_user cuando from_user = yo y action like/pass).
--
-- NO borra interacciones entrantes (otros -> este usuario).
--
-- Usuario objetivo (mismo que en 2026-03-31_force_likes_for_laura.sql):
-- - Email: lauragomezromero27@gmail.com
-- - ID: 2c9ad9be-e118-4b45-a7ff-5afce71fb79a

BEGIN;

DO $$
DECLARE
  v_target_id uuid;
  v_expected_id constant uuid := '2c9ad9be-e118-4b45-a7ff-5afce71fb79a';
  v_target_email constant text := 'lauragomezromero27@gmail.com';
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

WITH deleted AS (
  DELETE FROM public.interactions i
  WHERE i.from_user = '2c9ad9be-e118-4b45-a7ff-5afce71fb79a'::uuid
    AND i.action IN ('like', 'pass')
  RETURNING i.id, i.action, i.to_user
)
SELECT
  (SELECT count(*) FROM deleted) AS filas_borradas,
  (SELECT count(*) FROM deleted WHERE action = 'like') AS borrados_like,
  (SELECT count(*) FROM deleted WHERE action = 'pass') AS borrados_pass;

COMMIT;
