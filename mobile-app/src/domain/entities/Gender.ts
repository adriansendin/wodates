import { z } from 'zod';

export const GENDER_OPTIONS = [
  'male',
  'female',
  'non_binary',
] as const;

export const GenderSchema = z.enum(GENDER_OPTIONS);

export type GenderOption = (typeof GENDER_OPTIONS)[number];
