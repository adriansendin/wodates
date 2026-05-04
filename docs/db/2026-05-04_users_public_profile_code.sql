-- Public profile handle: slug from display name + 3-digit suffix (0–999), set at registration.
BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS public_profile_code text;

COMMENT ON COLUMN public.users.public_profile_code IS
  'Unique public code (name slug + 3-digit suffix). Assigned when the profile row is created.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_public_profile_code_lower
  ON public.users (lower(trim(public_profile_code)))
  WHERE public_profile_code IS NOT NULL AND btrim(public_profile_code) <> '';

COMMIT;
