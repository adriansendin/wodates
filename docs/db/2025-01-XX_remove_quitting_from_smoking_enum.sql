-- Supabase migration: remove 'quitting' from smoking_preference enum
-- This removes the "Estoy intentando dejarlo" option from smoking preferences
BEGIN;

-- 1. Update existing records that have 'quitting' to NULL
-- (Users who selected "Estoy intentando dejarlo" will need to reselect)
UPDATE public.users
SET smoking = NULL
WHERE smoking = 'quitting';

-- 2. Drop and recreate the enum without 'quitting'
-- Note: PostgreSQL doesn't support removing enum values directly, so we need to recreate it

-- Step 2a: Create new enum type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'smoking_preference_new' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.smoking_preference_new AS ENUM ('no', 'occasionally', 'regularly');
  END IF;
END$$;

-- Step 2b: Alter column to use new type (convert existing values)
ALTER TABLE public.users
  ALTER COLUMN smoking TYPE public.smoking_preference_new
  USING CASE
    WHEN smoking::text = 'no' THEN 'no'::public.smoking_preference_new
    WHEN smoking::text = 'occasionally' THEN 'occasionally'::public.smoking_preference_new
    WHEN smoking::text = 'regularly' THEN 'regularly'::public.smoking_preference_new
    ELSE NULL
  END;

-- Step 2c: Drop old enum type
DROP TYPE IF EXISTS public.smoking_preference;

-- Step 2d: Rename new enum to original name
ALTER TYPE public.smoking_preference_new RENAME TO smoking_preference;

-- Step 2e: Update column to use renamed type
ALTER TABLE public.users
  ALTER COLUMN smoking TYPE public.smoking_preference
  USING smoking::text::public.smoking_preference;

COMMIT;

