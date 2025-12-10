import { FastifyReply, FastifyRequest } from 'fastify';
import { AdminVerificationService } from '../services/admin-verification-service';
import { DomainError } from '../../domain/errors/DomainError';
import { renderAdminVerificationPage } from '../views/admin-verification-page';

type VerificationParams = {
  id: string;
};

export class AdminVerificationController {
  constructor(private readonly verificationService: AdminVerificationService) {}

  async renderPage(_request: FastifyRequest, reply: FastifyReply) {
    return reply.type('text/html').send(renderAdminVerificationPage());
  }

  async getNext(_request: FastifyRequest, reply: FastifyReply) {
    const result = await this.verificationService.getNextPending();

    if (!result.success) {
      return this.handleError(reply, result.error);
    }

    if (!result.data) {
      return reply.send({ done: true });
    }

    return reply.send(result.data);
  }

  async approve(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as VerificationParams;
    const result = await this.verificationService.approveRequest(id);

    if (!result.success) {
      return this.handleError(reply, result.error);
    }

    return reply.send(result.data);
  }

  async reject(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as VerificationParams;
    const result = await this.verificationService.rejectRequest(id);

    if (!result.success) {
      return this.handleError(reply, result.error);
    }

    return reply.send(result.data);
  }

  private handleError(reply: FastifyReply, error: unknown) {
    if (error instanceof DomainError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
      });
    }

    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Unexpected error in admin verification controller',
    });
  }
}
