import { z } from 'zod';
import { GenderSchema } from './Gender';
import { LookingForSchema } from './LookingFor';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(100), // Se almacena como display_name en auth.users.raw_user_meta_data
  birthDate: z.string().datetime(),
  gender: GenderSchema, // REQUERIDO - debe coincidir con el backend
  location: z.string().min(1), // REQUERIDO - debe coincidir con el backend
  country: z.string().optional(),
  lookingFor: LookingForSchema, // REQUERIDO - debe coincidir con el backend
});

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});

export type LoginRequest = z.infer<typeof LoginSchema>;
export type RegisterRequest = z.infer<typeof RegisterSchema>;
export type AuthTokens = z.infer<typeof AuthTokensSchema>;
