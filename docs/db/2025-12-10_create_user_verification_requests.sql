-- Tabla y estado de verificación de usuario (selfie)
-- ============================================================================
-- Este script crea la tabla user_verification_requests y añade el campo
-- verification_status en public.users. Sigue el patrón usado para fotos/avatares.
-- Ejecutar en Supabase SQL Editor.
-- ============================================================================

-- Enums implícitos mediante CHECK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'verification_status'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN verification_status text NOT NULL DEFAULT 'pending'
      CHECK (verification_status IN ('pending', 'verified', 'rejected'));
  END IF;
END$$;

-- Tabla de solicitudes de verificación
CREATE TABLE IF NOT EXISTS public.user_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  photo_storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_user_verification_requests_user_id_created_at
  ON public.user_verification_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_verification_requests_status_created_at
  ON public.user_verification_requests (status, created_at ASC);

-- Nota sobre Storage:
--  - Usa el bucket privado 'verified_photo' ya creado.
--  - Las rutas recomendadas siguen el patrón: verified_photo/{userId}/{userId}_{timestamp}.ext
--  - El bucket debe permanecer privado; solo el backend (service role) sube/lee.

