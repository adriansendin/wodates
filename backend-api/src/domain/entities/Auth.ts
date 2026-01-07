import { z } from 'zod';
import { GENDER_VALUES } from './User';
import { LOOKING_FOR_VALUES } from './LookingFor';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(100),
  birthDate: z.string().datetime(),
  gender: z.enum(GENDER_VALUES), // REQUERIDO - no puede ser opcional
  location: z.string().min(1), // REQUERIDO - no puede ser opcional ni vacío
  country: z.string().optional(),
  lookingFor: z.enum(LOOKING_FOR_VALUES), // REQUERIDO - no puede ser opcional
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});

export type LoginRequest = z.infer<typeof LoginSchema>;
export type RegisterRequest = z.infer<typeof RegisterSchema>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenSchema>;
export type AuthTokens = z.infer<typeof AuthTokensSchema>;
