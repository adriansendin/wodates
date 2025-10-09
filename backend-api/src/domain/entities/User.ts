import { z } from 'zod';

export const GENDER_VALUES = [
  'male',
  'female',
  'non_binary',
  'other',
  'prefer_not_to_say',
] as const;

export const GenderSchema = z.enum(GENDER_VALUES);

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  birthDate: z.string().datetime(),
  gender: GenderSchema,
  bio: z.string().max(500).optional(),
  photoUrl: z.string().url().optional(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    city: z.string(),
    country: z.string(),
  }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateUserSchema = UserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateUserSchema = CreateUserSchema.partial();

export type Gender = z.infer<typeof GenderSchema>;
export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
