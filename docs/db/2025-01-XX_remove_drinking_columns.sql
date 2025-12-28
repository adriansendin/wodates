-- Supabase migration: remove drinking-related columns
-- This removes both "¿Bebes alcohol?" and "¿Te importa si la otra persona bebe alcohol?" questions
BEGIN;

-- 1. Drop the columns if they exist
ALTER TABLE public.users
  DROP COLUMN IF EXISTS drinking,
  DROP COLUMN IF EXISTS cares_about_partner_drinking;

-- 2. Drop the ENUM types if they exist and are not used elsewhere
-- Note: Only drop if no other tables/columns use these types
DO $$
BEGIN
  -- Drop drinking_preference enum
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'drinking_preference' 
    AND n.nspname = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM pg_attribute a
      JOIN pg_class c ON a.attrelid = c.oid
      JOIN pg_type t2 ON a.atttypid = t2.oid
      WHERE t2.typname = 'drinking_preference'
    )
  ) THEN
    DROP TYPE public.drinking_preference;
  END IF;

  -- Drop cares_about_partner_drinking_preference enum
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'cares_about_partner_drinking_preference' 
    AND n.nspname = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM pg_attribute a
      JOIN pg_class c ON a.attrelid = c.oid
      JOIN pg_type t2 ON a.atttypid = t2.oid
      WHERE t2.typname = 'cares_about_partner_drinking_preference'
    )
  ) THEN
    DROP TYPE public.cares_about_partner_drinking_preference;
  END IF;
END$$;

COMMIT;


