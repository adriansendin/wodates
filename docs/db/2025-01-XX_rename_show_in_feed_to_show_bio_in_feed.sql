-- Supabase migration: rename show_in_feed column to show_bio_in_feed
-- This column controls whether a user's bio is displayed when they appear in other users' feeds
BEGIN;

-- 1. Renombrar la columna
ALTER TABLE public.users
RENAME COLUMN show_in_feed TO show_bio_in_feed;

-- 2. Renombrar el índice
DROP INDEX IF EXISTS idx_users_show_in_feed;
CREATE INDEX IF NOT EXISTS idx_users_show_bio_in_feed ON public.users (show_bio_in_feed);

COMMIT;

