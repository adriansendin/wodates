import { z } from 'zod';

export const LOOKING_FOR_OPTIONS = ['male', 'female', 'both'] as const;

export const LookingForSchema = z.enum(LOOKING_FOR_OPTIONS);

export type LookingForOption = (typeof LOOKING_FOR_OPTIONS)[number];

