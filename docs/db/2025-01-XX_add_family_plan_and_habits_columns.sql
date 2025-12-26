-- Supabase migration: add family plan and habits columns to users table
-- These columns use ENUM types to enforce fixed values (no custom options allowed)
BEGIN;

-- 1. Create ENUM types for family plan preferences
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'wants_children_preference' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.wants_children_preference AS ENUM ('yes', 'no', 'not_sure');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'cares_about_partner_children_preference' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.cares_about_partner_children_preference AS ENUM ('yes', 'no');
  END IF;
END$$;


-- 2. Create ENUM types for habits preferences
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'smoking_preference' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.smoking_preference AS ENUM ('no', 'occasionally', 'regularly');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'cares_about_partner_smoking_preference' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.cares_about_partner_smoking_preference AS ENUM ('yes', 'no');
  END IF;
END$$;

-- 3. Add family plan columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS has_children BOOLEAN,
  ADD COLUMN IF NOT EXISTS wants_children public.wants_children_preference,
  ADD COLUMN IF NOT EXISTS cares_about_partner_children public.cares_about_partner_children_preference;

-- 4. Add habits columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS smoking public.smoking_preference,
  ADD COLUMN IF NOT EXISTS cares_about_partner_smoking public.cares_about_partner_smoking_preference;

-- 5. Create indexes for filtering (optional, but recommended for performance)
CREATE INDEX IF NOT EXISTS idx_users_has_children ON public.users (has_children) WHERE has_children IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_wants_children ON public.users (wants_children) WHERE wants_children IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_smoking ON public.users (smoking) WHERE smoking IS NOT NULL;

COMMIT;

