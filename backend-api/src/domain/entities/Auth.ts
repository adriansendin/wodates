import { z } from 'zod';
import { GENDER_VALUES } from './User';
import { LOOKING_FOR_VALUES } from './LookingFor';
import {
  USER_BIRTH_AGE_MAX,
  USER_BIRTH_AGE_MIN,
  ageFromIsoDateTime,
} from '../utils/birthDateAge';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const RegisterSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(1).max(100),
    birthDate: z.string().datetime(),
    gender: z.enum(GENDER_VALUES), // REQUERIDO - no puede ser opcional
    location: z.string(), // puede ir en blanco (ciudad por defecto en perfil)
    country: z.string().optional(),
    lookingFor: z.enum(LOOKING_FOR_VALUES), // REQUERIDO - no puede ser opcional
    locale: z.enum(['en', 'es']).optional(), // Language for Doc Love welcome messages
  })
  .refine(
    (data) => {
      const age = ageFromIsoDateTime(data.birthDate);
      return (
        age !== null &&
        age >= USER_BIRTH_AGE_MIN &&
        age <= USER_BIRTH_AGE_MAX
      );
    },
    {
      message: `Age must be between ${USER_BIRTH_AGE_MIN} and ${USER_BIRTH_AGE_MAX}`,
      path: ['birthDate'],
    }
  );

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
