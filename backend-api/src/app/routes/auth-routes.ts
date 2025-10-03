import { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/auth-controller';
import { RegisterSchema, LoginSchema } from '../../domain/entities/Auth';
import { ZodTypeProvider } from 'fastify-type-provider-zod';

declare module 'fastify' {
  interface FastifyInstance {
    registerUser: any;
    loginUser: any;
    authMiddleware: any;
  }
}

export async function authRoutes(fastify: FastifyInstance) {
  const authController = new AuthController(
    fastify.registerUser,
    fastify.loginUser
  );

  fastify.post('/register', {
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
          gender: { type: 'string', enum: ['male', 'female', 'non-binary', 'other'] }
        }
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
  }, authController.register.bind(authController));

  fastify.post('/login', {
    schema: {
      description: 'Login user',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 }
        }
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
  }, authController.login.bind(authController));

  fastify.post('/refresh', {
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
  }, authController.refresh.bind(authController));

  fastify.post('/logout', {
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
  }, authController.logout.bind(authController));
}
