-- Vista que filtra usuarios soft-deleted y expone display_name desde auth.users.
-- Solo incluye usuarios activos (deleted_at IS NULL).
-- El campo display_name viene de raw_user_meta_data->>'display_name' en auth.users,
-- con fallback al email si no hay display_name.
--
-- Ejecutar en Supabase SQL Editor

CREATE OR REPLACE VIEW public.users_active AS
SELECT
  u.*,
  COALESCE(
    NULLIF(TRIM(a.raw_user_meta_data->>'display_name'), ''),
    a.email,
    'Usuario'
  ) AS display_name
FROM public.users u
INNER JOIN auth.users a ON u.id = a.id
WHERE a.deleted_at IS NULL;

COMMENT ON VIEW public.users_active IS 'Usuarios activos (no soft-deleted) con display_name extraído de auth.users';
