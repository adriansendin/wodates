import { z } from 'zod';

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  birthDate: z.string().min(4).nullable(),
  gender: z.string().nullable(),
  looking_for: z.string().nullable(),
  min_age: z.number().int().nullable(),
  max_age: z.number().int().nullable(),
  bio: z.string().nullable(),
  city: z.string().nullable(),
});

export const UpdateUserProfileSchema = z.object({
  birthDate: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  looking_for: z.string().nullable().optional(),
  min_age: z.number().int().nullable().optional(),
  max_age: z.number().int().nullable().optional(),
  bio: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UpdateUserProfile = z.infer<typeof UpdateUserProfileSchema>;
