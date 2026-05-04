-- Optional signals from social profiles: codes the user enters at registration (affinity hint, not exclusive matching).
BEGIN;

CREATE TABLE IF NOT EXISTS public.user_social_profile_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_social_profile_interests_code_len CHECK (
    char_length(trim(code)) >= 2 AND char_length(trim(code)) <= 48
  ),
  CONSTRAINT user_social_profile_interests_code_format CHECK (
    trim(code) ~ '^[A-Za-z0-9_-]+$'
  )
);

CREATE INDEX IF NOT EXISTS idx_user_social_profile_interests_user_id
  ON public.user_social_profile_interests (user_id);

-- One row per normalized code per user (application normalizes casing; DB stores trimmed value).
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_social_profile_interests_user_code_lower
  ON public.user_social_profile_interests (user_id, lower(trim(code)));

COMMIT;
