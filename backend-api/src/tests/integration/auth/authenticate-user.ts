import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LoginRequest, LoginSchema } from '../../../domain/entities/Auth';

export const AuthSuccessResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string().min(1),
  }),
  token: z
    .string()
    .refine(
      (token) => token.split('.').length === 3,
      'Token must be JWT-like format'
    ),
});

type AuthSuccessResponse = z.infer<typeof AuthSuccessResponseSchema>;

export async function authenticateUser(
  app: FastifyInstance,
  credentials: LoginRequest
): Promise<AuthSuccessResponse> {
  const parsedCredentials = LoginSchema.parse(credentials);

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: parsedCredentials,
  });

  if (response.statusCode !== 200) {
    throw new Error(
      `Failed to authenticate user. Expected status 200 but received ${response.statusCode}`
    );
  }

  const payload = AuthSuccessResponseSchema.parse(response.json());
  return payload;
}
