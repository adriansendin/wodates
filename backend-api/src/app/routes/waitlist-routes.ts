import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { WaitlistController } from '../controllers/waitlist-controller';
import { SignupWaitlist } from '../../domain/use-cases/waitlist/SignupWaitlist';
import { SupabaseWaitlistRepository } from '../../data/repositories/SupabaseWaitlistRepository';

export const waitlistRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Initialize repository
  const waitlistRepository = new SupabaseWaitlistRepository();

  // Initialize use case
  const signupWaitlist = new SignupWaitlist(waitlistRepository);

  // Initialize controller
  const controller = new WaitlistController(signupWaitlist);

  // Register routes
  fastify.post(
    '/signup',
    {
      schema: {
        description: 'Sign up for waitlist',
        tags: ['waitlist'],
        body: {
          type: 'object',
          required: ['city', 'email'],
          properties: {
            city: {
              type: 'string',
              minLength: 1,
              maxLength: 80,
              description:
                'City name (e.g., "Paris (Central)", "NYC (Manhattan)", or custom city)',
            },
            email: {
              type: 'string',
              format: 'email',
              maxLength: 254,
              description: 'User email address',
            },
          },
        },
        response: {
          200: {
            description: 'Signup already existed',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              alreadyExisted: { type: 'boolean' },
              id: { type: 'string', format: 'uuid' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
          201: {
            description: 'New signup created',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              alreadyExisted: { type: 'boolean' },
              id: { type: 'string', format: 'uuid' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              details: {
                type: 'object',
                additionalProperties: { type: 'string' },
              },
            },
          },
          500: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    controller.signup.bind(controller)
  );
};
