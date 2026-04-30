import { z } from 'zod';
import { GenderSchema } from './Gender';

export const FeedCandidateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  bio: z.string().nullable().optional(),
  // Backend may send ISO from toISOString(); avoid rejecting the whole feed on format edge cases
  birthDate: z.string().nullable().optional(),
  // Discover preferences use 29–65 in the UI; API ages can still fall outside—do not drop the whole feed
  age: z.number().int().min(18).max(120).nullable().optional(),
  gender: GenderSchema.nullable().optional(),
  photoUrl: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
    z.union([z.string().url(), z.null()]).optional()
  ),
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
