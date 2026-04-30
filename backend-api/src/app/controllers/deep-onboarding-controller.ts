import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodError, z } from 'zod';
import { DomainError } from '../../domain/errors/DomainError';
import { GetDeepOnboardingForm } from '../../domain/use-cases/deep-onboarding/GetDeepOnboardingForm';
import { SubmitDeepOnboardingAnswers } from '../../domain/use-cases/deep-onboarding/SubmitDeepOnboardingAnswers';
import { LinkDeepOnboardingSession } from '../../domain/use-cases/deep-onboarding/LinkDeepOnboardingSession';
import { GetLatestDeepOnboardingSessionForUser } from '../../domain/use-cases/deep-onboarding/GetLatestDeepOnboardingSessionForUser';
import type { SubmitDeepOnboardingAnswerInput } from '../../domain/entities/DeepOnboarding';

const SubmitAnswerSchema = z.object({
  questionCode: z.string().min(1),
  questionTextSnapshot: z.string().min(1).max(8000),
  singleKey: z.string().optional(),
  multiKeys: z.array(z.string()).optional(),
  textAnswer: z.string().nullable().optional(),
  otherDetails: z.record(z.string()).optional(),
});

const SubmitBodySchema = z.object({
  clientSessionId: z.string().uuid(),
  userId: z.string().uuid().optional().nullable(),
  answers: z.array(SubmitAnswerSchema).min(1),
});

const LinkSessionBodySchema = z.object({
  clientSessionId: z.string().uuid(),
});

function toAnswerInputs(
  parsed: z.infer<typeof SubmitBodySchema>['answers']
): SubmitDeepOnboardingAnswerInput[] {
  return parsed.map((a): SubmitDeepOnboardingAnswerInput => {
    const row: SubmitDeepOnboardingAnswerInput = {
      questionCode: a.questionCode,
      questionTextSnapshot: a.questionTextSnapshot,
    };
    if (a.singleKey !== undefined) {
      row.singleKey = a.singleKey;
    }
    if (a.multiKeys !== undefined) {
      row.multiKeys = a.multiKeys;
    }
    if (a.textAnswer !== undefined) {
      row.textAnswer = a.textAnswer;
    }
    if (a.otherDetails !== undefined) {
      row.otherDetails = a.otherDetails;
    }
    return row;
  });
}

export class DeepOnboardingController {
  constructor(
    private readonly getDeepOnboardingForm: GetDeepOnboardingForm,
    private readonly submitDeepOnboardingAnswers: SubmitDeepOnboardingAnswers,
    private readonly linkDeepOnboardingSession: LinkDeepOnboardingSession,
    private readonly getLatestDeepOnboardingSessionForUser: GetLatestDeepOnboardingSessionForUser
  ) {}

  async getMySession(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({
          error: 'UNAUTHORIZED',
          message: 'Authenticated user required',
        });
      }

      const result =
        await this.getLatestDeepOnboardingSessionForUser.execute(userId);
      if (!result.success) {
        return this.handleError(reply, result.error);
      }

      return reply.status(200).send(result.data);
    } catch (error) {
      return this.handleUnexpectedError(reply, error);
    }
  }

  async getForm(_request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await this.getDeepOnboardingForm.execute();
      if (!result.success) {
        return this.handleError(reply, result.error);
      }
      return reply.status(200).send(result.data);
    } catch (error) {
      return this.handleUnexpectedError(reply, error);
    }
  }

  async submit(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = SubmitBodySchema.parse(request.body);
      const result = await this.submitDeepOnboardingAnswers.execute({
        clientSessionId: body.clientSessionId,
        userId: body.userId ?? null,
        answers: toAnswerInputs(body.answers),
      });

      if (!result.success) {
        return this.handleError(reply, result.error);
      }

      return reply.status(200).send({
        ok: true,
        savedCount: result.data.savedCount,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return this.handleValidationError(reply, error);
      }
      return this.handleUnexpectedError(reply, error);
    }
  }

  async linkSession(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({
          error: 'UNAUTHORIZED',
          message: 'Authenticated user required',
        });
      }

      const body = LinkSessionBodySchema.parse(request.body);
      const result = await this.linkDeepOnboardingSession.execute(
        userId,
        body.clientSessionId
      );

      if (!result.success) {
        return this.handleError(reply, result.error);
      }

      return reply.status(200).send({
        ok: true,
        linked: result.data.linked,
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
