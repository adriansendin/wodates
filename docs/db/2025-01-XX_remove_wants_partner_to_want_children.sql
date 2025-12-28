-- Supabase migration: remove wants_partner_to_want_children column
-- This column was removed because the preference can be inferred from wants_children
BEGIN;

-- 1. Drop the column if it exists
ALTER TABLE public.users
  DROP COLUMN IF EXISTS wants_partner_to_want_children;

-- 2. Drop the ENUM type if it exists and is not used elsewhere
-- Note: Only drop if no other tables/columns use this type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'wants_partner_to_want_children_preference' 
    AND n.nspname = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM pg_attribute a
      JOIN pg_class c ON a.attrelid = c.oid
      JOIN pg_type t2 ON a.atttypid = t2.oid
      WHERE t2.typname = 'wants_partner_to_want_children_preference'
    )
  ) THEN
    DROP TYPE public.wants_partner_to_want_children_preference;
  END IF;
END$$;

COMMIT;


