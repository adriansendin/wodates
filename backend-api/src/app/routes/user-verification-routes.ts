import { FastifyInstance } from 'fastify';
import { UserVerificationService } from '../services/user-verification-service';
import { UserVerificationController } from '../controllers/user-verification-controller';

export async function userVerificationRoutes(fastify: FastifyInstance) {
  const verificationService = new UserVerificationService();
  const controller = new UserVerificationController(verificationService);

  fastify.post(
    '/users/me/verification',
    {
      schema: {
        description: 'Create a selfie verification request',
        tags: ['user-verification'],
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
        response: {
          200: {
            type: 'object',
            properties: {
              verification_status: {
                type: 'string',
                enum: ['pending', 'verifying', 'verified', 'rejected'],
              },
              request_id: { type: 'string', format: 'uuid' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    controller.createRequest.bind(controller)
  );
}
