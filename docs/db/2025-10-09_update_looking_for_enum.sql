-- Supabase migration: enforce enum values for users.looking_for
BEGIN;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_looking_for_check;

DROP TYPE IF EXISTS public.looking_for_preference;

CREATE TYPE public.looking_for_preference AS ENUM ('male', 'female', 'both');

UPDATE public.users
SET looking_for = 'both'
WHERE looking_for IN ('any', 'non-binary');

ALTER TABLE public.users
  ALTER COLUMN looking_for TYPE public.looking_for_preference
  USING CASE
    WHEN looking_for IS NULL THEN NULL
    ELSE looking_for::public.looking_for_preference
  END;

COMMIT;
