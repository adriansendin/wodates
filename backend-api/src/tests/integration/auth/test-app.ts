import Fastify, { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { authRoutes } from '../../../app/routes/auth-routes';
import { authMiddleware } from '../../../app/middleware/auth';
import { InMemoryAuthService } from './in-memory-auth-service';
import { AuthService } from '../../../app/services/auth-service';

type CreateTestAppOptions<TService extends AuthService> = {
  authService?: TService;
};

type CreateTestAppResult<TService extends AuthService> = {
  app: FastifyInstance;
  authService: TService;
};

export async function createTestApp<
  TService extends AuthService = InMemoryAuthService,
>(
  options: CreateTestAppOptions<TService> = {},
): Promise<CreateTestAppResult<TService>> {
  const fastify = Fastify({
    logger: false,
  }).withTypeProvider<ZodTypeProvider>();

  fastify.decorate('authMiddleware', authMiddleware);

  const authService =
    options.authService ?? ((new InMemoryAuthService()) as TService);

  await fastify.register(authRoutes, {
    prefix: '/api/v1/auth',
    authService,
  });

  await fastify.ready();

  return {
    app: fastify,
    authService,
  };
}
