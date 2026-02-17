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
  city: z.string().nullable().optional(),
  show_bio_in_feed: z.boolean().nullable().optional(),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      city: z.string(),
      country: z.string(),
    })
    .nullable()
    .optional(),
});

export type FeedCandidate = z.infer<typeof FeedCandidateSchema>;
