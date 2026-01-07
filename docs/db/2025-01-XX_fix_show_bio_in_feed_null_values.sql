-- Supabase migration: fix NULL values in show_bio_in_feed column
-- This migration corrects any existing users that have NULL in show_bio_in_feed
-- The default value should be TRUE (users should show bio in feed by default)
-- Only users who explicitly set it to FALSE should have it as false
BEGIN;

-- Update all users with NULL show_bio_in_feed to TRUE (default value)
-- Exclude bots (is_bot = TRUE) as they should have show_bio_in_feed = FALSE
UPDATE public.users
SET show_bio_in_feed = TRUE
WHERE show_bio_in_feed IS NULL
  AND (is_bot IS NULL OR is_bot = FALSE);

-- Ensure bots have show_bio_in_feed = FALSE (even if they have NULL)
UPDATE public.users
SET show_bio_in_feed = FALSE
WHERE is_bot = TRUE
  AND (show_bio_in_feed IS NULL OR show_bio_in_feed = TRUE);

COMMIT;

