import { FastifyRequest, FastifyReply } from 'fastify';
import { CreateWaitlistSignupSchema } from '../../domain/entities/WaitlistSignup';
import { DomainError } from '../../domain/errors/DomainError';
import { ZodError } from 'zod';
import { SignupWaitlist } from '../../domain/use-cases/waitlist/SignupWaitlist';

export class WaitlistController {
  constructor(private readonly signupWaitlist: SignupWaitlist) {}

  async signup(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Validate request body
      const signupData = CreateWaitlistSignupSchema.parse(request.body);

      // Execute use case
      const result = await this.signupWaitlist.execute(signupData);

      if (!result.success) {
        return this.handleError(reply, result.error);
      }

      const { signup, alreadyExisted } = result.data;

      // Return 201 for new signups, 200 for existing ones
      const statusCode = alreadyExisted ? 200 : 201;

      return reply.status(statusCode).send({
        ok: true,
        alreadyExisted,
        id: signup.id,
        createdAt: signup.createdAt,
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

  private handleUnexpectedError(reply: FastifyReply, error: unknown) {
    return reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected error while processing request',
    });
  }
}
