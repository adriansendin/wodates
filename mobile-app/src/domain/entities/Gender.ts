import { z } from 'zod';

export const GENDER_OPTIONS = [
  'male',
  'female',
  'non_binary',
  'other',
  'prefer_not_to_say',
] as const;

export const GenderSchema = z.enum(GENDER_OPTIONS);

export type GenderOption = (typeof GENDER_OPTIONS)[number];
