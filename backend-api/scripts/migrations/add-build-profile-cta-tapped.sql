-- Add column to store when the user tapped "Build my profile" in Doc Love chat.
-- Once set, the CTA button is hidden forever for that user.
-- Run this on your Supabase project (SQL Editor or migration tool).

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS build_profile_cta_tapped_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.users.build_profile_cta_tapped_at IS
  'Set when user taps "Build my profile" in Doc Love chat; CTA is then hidden forever.';
