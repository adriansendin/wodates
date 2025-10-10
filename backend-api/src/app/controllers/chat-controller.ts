import { FastifyRequest, FastifyReply } from 'fastify';
import { SendMessage } from '../../domain/use-cases/chat/SendMessage';
import { GetMessages } from '../../domain/use-cases/chat/GetMessages';
import { DomainError } from '../../domain/errors/DomainError';
import { z } from 'zod';

const SendMessageSchema = z.object({
  content: z.string().min(1).max(1000),
});

const GetMessagesQuerySchema = z.object({
  limit: z
    .union([z.string(), z.number()])
    .transform((value, ctx) => {
      const parsed = Number(value);
      if (Number.isNaN(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid limit value',
        });
        return z.NEVER;
      }
      return parsed;
    })
    .optional(),
  before: z.string().optional(),
});

export class ChatController {
  constructor(
    private sendMessageUseCase: SendMessage,
    private getMessagesUseCase: GetMessages
  ) {}

  async sendMessage(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      const { matchId } = request.params as { matchId: string };
      const { content } = SendMessageSchema.parse(request.body);
      
      const result = await this.sendMessageUseCase.execute(matchId, userId, content);
      
      if (result.success) {
        return reply.status(201).send({
          message: result.data,
        });
      } else {
        return this.handleError(reply, result.error);
      }
    } catch (error) {
      return this.handleValidationError(reply, error);
    }
  }

  async getMessages(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      const { matchId } = request.params as { matchId: string };
      const { limit = 50, before } = GetMessagesQuerySchema.parse(request.query);
      
      const result = await this.getMessagesUseCase.execute(matchId, userId, limit, before);
      
      if (result.success) {
        return reply.send({
          messages: result.data,
          pagination: {
            limit,
            before,
            hasMore: result.data.length === limit,
          },
        });
      } else {
        return this.handleError(reply, result.error);
      }
    } catch (error) {
      return this.handleValidationError(reply, error);
    }
  }

  private handleError(reply: FastifyReply, error: DomainError) {
    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message,
      details: error.details,
    });
  }

  private handleValidationError(reply: FastifyReply, error: unknown) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: error,
    });
  }
}
