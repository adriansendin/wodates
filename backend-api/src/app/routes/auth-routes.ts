import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyPluginOptions,
} from 'fastify';
import { AuthController } from '../controllers/auth-controller';
import { SupabaseAuthService } from '../services/supabase-auth-service';
import { GENDER_VALUES } from '../../domain/entities/User';
import { AuthService } from '../services/auth-service';
import { SystemUserService } from '../services/system-user-service';
import { DocLoveHelper } from '../services/doc-love-helper';
import { SupabaseLikeRepository } from '../../data/repositories/SupabaseLikeRepository';
import { SupabaseMatchRepository } from '../../data/repositories/SupabaseMatchRepository';

declare module 'fastify' {
  interface FastifyInstance {
    authMiddleware: any;
  }
}

type AuthRoutesOptions = FastifyPluginOptions & {
  authService?: AuthService;
};

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  fastify: FastifyInstance,
  options: AuthRoutesOptions
) => {
  const authService = options?.authService ?? new SupabaseAuthService();

  // Initialize SystemUserService for welcome matches with Doc Love
  const docLoveHelper = new DocLoveHelper();
  const likeRepository = new SupabaseLikeRepository();
  const matchRepository = new SupabaseMatchRepository();
  const systemUserService = new SystemUserService(
    docLoveHelper,
    likeRepository,
    matchRepository
  );

  const authController = new AuthController(authService, systemUserService);

  fastify.post(
    '/register',
    {
      schema: {
        description: 'Register a new user',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['email', 'password', 'name', 'birthDate', 'gender'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
            name: { type: 'string', minLength: 1, maxLength: 100 },
            birthDate: { type: 'string', format: 'date-time' },
            gender: { type: 'string', enum: GENDER_VALUES },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                },
              },
              token: { type: 'string' },
            },
          },
        },
      },
    },
    authController.register.bind(authController)
  );

  fastify.post(
    '/login',
    {
      schema: {
        description: 'Login user',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                },
              },
              token: { type: 'string' },
            },
          },
        },
      },
    },
    authController.login.bind(authController)
  );

  fastify.post(
    '/refresh',
    {
      schema: {
        description: 'Refresh access token',
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              token: { type: 'string' },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    authController.refresh.bind(authController)
  );

  fastify.post(
    '/logout',
    {
      schema: {
        description: 'Logout user',
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    authController.logout.bind(authController)
  );
};
