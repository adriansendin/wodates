import { FastifyInstance } from 'fastify';
import { AdminVerificationService } from '../services/admin-verification-service';
import { AdminVerificationController } from '../controllers/admin-verification-controller';
import { createAdminAuthMiddleware } from '../middleware/admin-auth';

export async function adminVerificationRoutes(fastify: FastifyInstance) {
  const adminAuth = createAdminAuthMiddleware();
  const verificationService = new AdminVerificationService();
  const controller = new AdminVerificationController(verificationService);

  fastify.get(
    '/verification',
    {
      preHandler: adminAuth,
      schema: {
        hide: true, // internal admin page
      },
    },
    controller.renderPage.bind(controller)
  );

  fastify.get(
    '/verification/next',
    {
      preHandler: adminAuth,
      schema: {
        description: 'Get next pending verification request',
        tags: ['admin'],
        response: {
          200: {
            anyOf: [
              { type: 'object', properties: { done: { type: 'boolean' } } },
              {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  user_id: { type: 'string', format: 'uuid' },
                  photo_storage_path: { type: 'string' },
                  created_at: { type: 'string', format: 'date-time' },
                  signed_url: { type: 'string' },
                },
              },
            ],
          },
        },
      },
    },
    controller.getNext.bind(controller)
  );

  fastify.post(
    '/verification/:id/approve',
    {
      preHandler: adminAuth,
      schema: {
        description: 'Approve a verification request',
        tags: ['admin'],
      },
    },
    controller.approve.bind(controller)
  );

  fastify.post(
    '/verification/:id/reject',
    {
      preHandler: adminAuth,
      schema: {
        description: 'Reject a verification request',
        tags: ['admin'],
      },
    },
    controller.reject.bind(controller)
  );
}
