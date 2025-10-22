import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createTestApp } from './test-app';
import { InMemoryAuthService } from './in-memory-auth-service';
import { UserFactory } from './factories/user-factory';
import { ProfileFactory } from './factories/profile-factory';
import { authenticateUser, AuthSuccessResponseSchema } from './authenticate-user';

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  details: z.any().optional(),
});

describe('Auth routes', () => {
  let app: FastifyInstance;
  let authService: InMemoryAuthService;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    authService = setup.authService as InMemoryAuthService;
    authService.reset();
  });

  afterEach(async () => {
    await app.close();
  });

  it('registers a user and returns a JWT-like token', async () => {
    const user = UserFactory.create();
    const profile = ProfileFactory.create();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        ...user,
        ...profile,
      },
    });

    expect(response.statusCode).toBe(201);

    const payload = AuthSuccessResponseSchema.parse(response.json());
    expect(payload.user.email).toBe(user.email);
    expect(payload.user.name).toBe(user.name);
  });

  it('rejects invalid registration payloads with 400', async () => {
    const user = UserFactory.create();
    const profile = ProfileFactory.create();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        ...user,
        ...profile,
        lookingFor: 'friendship',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = ErrorResponseSchema.parse(response.json());
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('allows a registered user to login successfully', async () => {
    const user = UserFactory.create();
    const profile = ProfileFactory.create();

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        ...user,
        ...profile,
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: user.email,
        password: user.password,
      },
    });

    expect(loginResponse.statusCode).toBe(200);
    const payload = AuthSuccessResponseSchema.parse(loginResponse.json());
    expect(payload.user.email).toBe(user.email);
  });

  it('returns 401 when credentials are invalid', async () => {
    const user = UserFactory.create();
    const profile = ProfileFactory.create();

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        ...user,
        ...profile,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: user.email,
        password: 'WrongPass123!',
      },
    });

    expect(response.statusCode).toBe(401);
    const body = ErrorResponseSchema.parse(response.json());
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('enforces authentication middleware on protected routes', async () => {
    const user = UserFactory.create();
    const profile = ProfileFactory.create();

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        ...user,
        ...profile,
      },
    });

    const login = await authenticateUser(app, {
      email: user.email,
      password: user.password,
    });

    const unauthorizedResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
    });
    expect(unauthorizedResponse.statusCode).toBe(401);

    const refreshResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: {
        authorization: `Bearer ${login.token}`,
      },
    });

    expect(refreshResponse.statusCode).toBe(200);
    const refreshPayload = z
      .object({ token: z.string() })
      .parse(refreshResponse.json());
    expect(refreshPayload.token.split('.')).toHaveLength(3);
  });
});
