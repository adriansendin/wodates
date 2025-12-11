-- Supabase migration: add is_bot column to users table
-- This column identifies system users (bots) like Doc Love
BEGIN;

-- 1. Agregar columna is_bot
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT FALSE;

-- 2. Crear índice para queries rápidas
CREATE INDEX IF NOT EXISTS idx_users_is_bot ON public.users(is_bot) WHERE is_bot = TRUE;

-- 3. Marcar Doc Love como bot (si existe)
-- Nota: Este UPDATE requiere que Doc Love ya exista en la BD
-- El email 'doclove@wodates.com' debe coincidir con el usuario creado
UPDATE public.users
SET is_bot = TRUE
WHERE id IN (
  SELECT id 
  FROM auth.users 
  WHERE email = 'doclove@wodates.com'
);

-- 4. Asegurar que Doc Love tiene show_bio_in_feed = FALSE
UPDATE public.users
SET show_bio_in_feed = FALSE
WHERE id IN (
  SELECT id 
  FROM auth.users 
  WHERE email = 'doclove@wodates.com'
)
AND (show_bio_in_feed IS NULL OR show_bio_in_feed = TRUE);

COMMIT;

