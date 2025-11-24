import { z } from 'zod';
import { GenderSchema } from './Gender';

export const UserSchema = z.object({
  id: z.string().uuid(),
  // MIGRACIÓN COMPLETADA: email y name vienen de auth.users, no de public.users
  email: z.string().email(), // Viene de auth.users.email
  name: z.string().min(1).max(100), // Viene de auth.users.raw_user_meta_data.display_name
  birthDate: z.string().datetime(),
  gender: GenderSchema,
  bio: z.string().max(500).optional(),
  photoUrl: z.string().url().optional(),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      city: z.string(),
      country: z.string(),
    })
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateUserSchema = UserSchema.omit({
  id: true,
  email: true, // email is managed by auth.users
  name: true, // name is managed by auth.users (raw_user_meta_data.display_name)
  createdAt: true,
  updatedAt: true,
});

export const UpdateUserSchema = CreateUserSchema.partial();

export type Gender = z.infer<typeof GenderSchema>;
export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
