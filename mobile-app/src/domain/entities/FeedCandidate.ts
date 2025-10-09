import { z } from 'zod';
import { GenderSchema } from './Gender';

export const FeedCandidateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  bio: z.string().nullable().optional(),
  birthDate: z.string().datetime().nullable().optional(),
  age: z.number().int().min(18).max(100).nullable().optional(),
  gender: GenderSchema.nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
});

export type FeedCandidate = z.infer<typeof FeedCandidateSchema>;

