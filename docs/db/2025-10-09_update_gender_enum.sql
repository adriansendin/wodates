-- Supabase migration: restrict users.gender to fixed enum values
BEGIN;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_gender_check;

DROP TYPE IF EXISTS public.user_gender;

CREATE TYPE public.user_gender AS ENUM (
  'male',
  'female',
  'non_binary',
  'other',
  'prefer_not_to_say'
);

UPDATE public.users
SET gender = CASE
  WHEN gender ILIKE 'male' THEN 'male'
  WHEN gender ILIKE 'female' THEN 'female'
  WHEN gender ILIKE 'non-binary' OR gender ILIKE 'non_binary' THEN 'non_binary'
  WHEN gender ILIKE 'other' THEN 'other'
  WHEN gender ILIKE 'prefer_not_to_say' OR gender ILIKE 'prefer not to say' THEN 'prefer_not_to_say'
  ELSE NULL
END
WHERE gender IS NOT NULL;

ALTER TABLE public.users
  ALTER COLUMN gender TYPE public.user_gender
  USING CASE
    WHEN gender IS NULL THEN NULL
    ELSE gender::public.user_gender
  END;

COMMIT;
