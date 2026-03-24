import { FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import { SendContactUsMessage } from '../../domain/use-cases/contact/SendContactUsMessage';
import { DomainError, UnauthorizedError } from '../../domain/errors/DomainError';

const SendContactUsMessageSchema = z.object({
  message: z
    .preprocess(
      (value) =>
        typeof value === 'string' ? value.trim() : value,
      z
        .string()
        .min(10, 'Message must be at least 10 characters')
        .max(300, 'Message must be at most 300 characters')
    ),
});

export class ContactUsController {
  constructor(
    private readonly sendContactUsMessage: SendContactUsMessage
  ) {}

  async submit(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user;
      if (!authUser) {
        return this.handleError(reply, new UnauthorizedError('Missing authenticated user'));
      }

      const body = SendContactUsMessageSchema.parse(request.body ?? {});
      const userId = authUser.id;

      const result = await this.sendContactUsMessage.execute({
        userId,
        content: body.message,
      });

      if (!result.success) {
        return this.handleError(reply, result.error);
      }

      return reply.status(201).send({
        ok: true,
        id: result.data.id,
        createdAt: result.data.createdAt,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return this.handleValidationError(reply, error);
      }

      return this.handleUnexpectedError(reply, error);
    }
  }

  private handleError(reply: FastifyReply, error: DomainError) {
    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message,
      details: error.details,
    });
  }

  private handleValidationError(reply: FastifyReply, error: ZodError) {
    const fieldErrors = error.errors.reduce(
      (acc, err) => {
        const path = err.path.join('.');
        acc[path] = err.message;
        return acc;
      },
      {} as Record<string, string>
    );

    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: fieldErrors,
    });
  }

  private handleUnexpectedError(reply: FastifyReply, _error: unknown) {
    return reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected error while processing request',
    });
  }
}

