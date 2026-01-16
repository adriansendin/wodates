import { FastifyRequest, FastifyReply } from 'fastify';
import { SendMessage } from '../../domain/use-cases/chat/SendMessage';
import { GetMessages } from '../../domain/use-cases/chat/GetMessages';
import { BlockUser } from '../../domain/use-cases/chat/BlockUser';
import { DomainError, NotFoundError, ForbiddenError, InternalError } from '../../domain/errors/DomainError';
import { MatchRepository } from '../../domain/repositories/MatchRepository';
import { MessageRepository } from '../../domain/repositories/MessageRepository';
import { AffinitySentenceService } from '../services/affinity-sentence-service';
import { z } from 'zod';

const SendMessageSchema = z.object({
  content: z.string().min(1).max(500),
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

const BlockUserSchema = z.object({
  blockedUserId: z.string().uuid(),
});

export class ChatController {
  constructor(
    private sendMessageUseCase: SendMessage,
    private getMessagesUseCase: GetMessages,
    private blockUserUseCase: BlockUser,
    private matchRepository: MatchRepository,
    private messageRepository: MessageRepository,
    private affinitySentenceService?: AffinitySentenceService
  ) {}

  async sendMessage(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      const { matchId } = request.params as { matchId: string };
      const { content } = SendMessageSchema.parse(request.body);

      request.log.info(
        { matchId, userId, contentLength: content.length },
        '1. Usuario escribe mensaje - Recibido en controller'
      );

      const result = await this.sendMessageUseCase.execute(
        matchId,
        userId,
        content
      );

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
      const { limit = 50, before } = GetMessagesQuerySchema.parse(
        request.query
      );

      const result = await this.getMessagesUseCase.execute(
        matchId,
        userId,
        limit,
        before
      );

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

  async blockUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      const { matchId } = request.params as { matchId: string };
      const { blockedUserId } = BlockUserSchema.parse(request.body);

      const result = await this.blockUserUseCase.execute(
        userId,
        blockedUserId,
        matchId
      );

      if (result.success) {
        return reply.status(201).send({
          blocked: true,
          blockedUser: result.data,
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

  async getAffinitySentence(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      const { matchId } = request.params as { matchId: string };

      // Verify match exists and user is part of it
      const matchResult = await this.matchRepository.findById(matchId);
      if (!matchResult.success || !matchResult.data) {
        return this.handleError(reply, new NotFoundError('Match not found'));
      }

      const match = matchResult.data;
      if (match.userId1 !== userId && match.userId2 !== userId) {
        return this.handleError(reply, new ForbiddenError('User is not part of this match'));
      }

      // Get affinity sentence from chat
      const affinityResult = await this.matchRepository.getAffinitySentence(matchId);
      if (!affinityResult.success) {
        return this.handleError(reply, affinityResult.error);
      }

      let sentence = affinityResult.data;

      // If null (legacy chat), generate on-demand and store
      if (!sentence && this.affinitySentenceService) {
        const generateResult = await this.affinitySentenceService.generateAffinitySentence(
          match.userId1,
          match.userId2
        );

        if (generateResult.success) {
          sentence = generateResult.data;
          // Store it for future requests
          await this.matchRepository.updateAffinitySentence(matchId, sentence);
        } else {
          // Use fallback if generation fails
          sentence = 'Initial affinity is low—conversation will sharpen recommendations.';
        }
      }

      // If still null (service not available), use fallback
      if (!sentence) {
        sentence = 'Initial affinity is low—conversation will sharpen recommendations.';
      }

      return reply.send({ sentence });
    } catch (error) {
      return this.handleValidationError(reply, error);
    }
  }

  async hasSentMessage(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      const { matchId } = request.params as { matchId: string };

      // Verify match exists and user is part of it
      const matchResult = await this.matchRepository.findById(matchId);
      if (!matchResult.success || !matchResult.data) {
        return this.handleError(reply, new NotFoundError('Match not found'));
      }

      const match = matchResult.data;
      if (match.userId1 !== userId && match.userId2 !== userId) {
        return this.handleError(reply, new ForbiddenError('User is not part of this match'));
      }

      // Check if user has sent any message in this chat
      const messagesResult = await this.messageRepository.findByMatchId(matchId, 1);
      if (!messagesResult.success) {
        return this.handleError(
          reply,
          new InternalError('Failed to check messages')
        );
      }

      // Check if any message was sent by this user
      const hasSent = messagesResult.data.some((msg) => msg.senderId === userId);

      return reply.send({ hasSent });
    } catch (error) {
      return this.handleValidationError(reply, error);
    }
  }

  private handleValidationError(reply: FastifyReply, error: unknown) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: error,
    });
  }
}
