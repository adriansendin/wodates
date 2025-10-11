import { z } from 'zod';
import { GenderSchema } from './Gender';
import { LookingForSchema } from './LookingFor';

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  birthDate: z.string().min(4).nullable(),
  gender: GenderSchema.nullable(),
  looking_for: LookingForSchema.nullable(),
  min_age: z.number().int().nullable(),
  max_age: z.number().int().nullable(),
  bio: z.string().nullable(),
  city: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
});

export const UpdateUserProfileSchema = z.object({
  birthDate: z.string().nullable().optional(),
  gender: GenderSchema.nullable().optional(),
  looking_for: LookingForSchema.nullable().optional(),
  min_age: z.number().int().nullable().optional(),
  max_age: z.number().int().nullable().optional(),
  bio: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UpdateUserProfile = z.infer<typeof UpdateUserProfileSchema>;
