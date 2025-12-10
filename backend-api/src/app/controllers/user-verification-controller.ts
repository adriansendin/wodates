import { FastifyReply, FastifyRequest } from 'fastify';
import {
  DomainError,
  UnauthorizedError,
} from '../../domain/errors/DomainError';
import { UserVerificationService } from '../services/user-verification-service';

export class UserVerificationController {
  constructor(private readonly verificationService: UserVerificationService) {}

  async createRequest(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user;
      if (!authUser) {
        throw new UnauthorizedError('Missing authenticated user');
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          error: 'MISSING_FILE',
          message: 'No file provided. Please upload an image.',
        });
      }

      request.log.info(
        {
          userId: authUser.id,
          mimetype: data.mimetype,
          fieldname: data.fieldname,
          filename: data.filename,
          bytesRead: data.file?.bytesRead,
        },
        '[UserVerification] Received verification upload'
      );

      const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/heic',
        'image/heif',
      ];
      if (!allowedMimeTypes.includes(data.mimetype)) {
        return reply.status(400).send({
          error: 'INVALID_FILE_TYPE',
          message: 'Only JPEG, PNG or HEIC images are allowed.',
        });
      }

      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
      if (data.file.bytesRead > MAX_FILE_SIZE) {
        return reply.status(400).send({
          error: 'FILE_TOO_LARGE',
          message: 'File size must be less than 5MB.',
        });
      }

      const buffer = await data.toBuffer();
      const result = await this.verificationService.createRequest(
        authUser.id,
        buffer,
        data.mimetype
      );

      if (!result.success) {
        request.log.error(
          {
            userId: authUser.id,
            error: result.error,
            code: result.error.code,
            status: result.error.statusCode,
          },
          '[UserVerification] createRequest failed'
        );
        return reply.status(result.error.statusCode).send({
          error: result.error.code,
          message: result.error.message,
          details: result.error.details,
        });
      }

      request.log.info(
        {
          userId: authUser.id,
          requestId: result.data.request.id,
          verification_status: result.data.verification_status,
        },
        '[UserVerification] createRequest succeeded'
      );

      return reply.send({
        verification_status: result.data.verification_status,
        request_id: result.data.request.id,
        created_at: result.data.request.created_at,
      });
    } catch (error) {
      return this.handleError(reply, error);
    }
  }

  private handleError(reply: FastifyReply, error: unknown) {
    if (error instanceof DomainError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
        details: error.details,
      });
    }

    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Unexpected error processing request',
      details: error instanceof Error ? error.message : error,
    });
  }
}
