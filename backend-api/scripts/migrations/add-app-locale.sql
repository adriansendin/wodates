-- Add column to store the user's preferred UI locale (en / es).
-- Defaults to 'en'. Used for generating bios and affinity sentences in the right language.
-- Run this on your Supabase project (SQL Editor or migration tool).

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS app_locale text NOT NULL DEFAULT 'en';

COMMENT ON COLUMN public.users.app_locale IS
  'Preferred UI locale of the user (en or es). Set during registration, used for bio and affinity generation.';
