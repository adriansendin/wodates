import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ContactUsController } from '../controllers/contact-us-controller';
import { SendContactUsMessage } from '../../domain/use-cases/contact/SendContactUsMessage';
import { SupabaseContactUsMessageRepository } from '../../data/repositories/SupabaseContactUsMessageRepository';

declare module 'fastify' {
  interface FastifyInstance {
    authMiddleware: any;
  }
}

export const contactUsRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  const repository = new SupabaseContactUsMessageRepository();
  const useCase = new SendContactUsMessage(repository);
  const controller = new ContactUsController(useCase);

  fastify.post(
    '/contact-us',
    {
      schema: {
        description: 'Send a contact-us message',
        tags: ['contact-us'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string', minLength: 10, maxLength: 300 },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              id: { type: 'string', format: 'uuid' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
          400: { type: 'object' },
          401: { type: 'object' },
          500: { type: 'object' },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    controller.submit.bind(controller)
  );
};

