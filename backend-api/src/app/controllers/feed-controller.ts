import { FastifyRequest, FastifyReply } from 'fastify';
import { GetFeedUsers } from '../../domain/use-cases/feed/GetFeedUsers';
import { LikeUser } from '../../domain/use-cases/feed/LikeUser';
import { PassUser } from '../../domain/use-cases/feed/PassUser';
import { DomainError } from '../../domain/errors/DomainError';
import { z } from 'zod';

const LikeSchema = z.object({
  targetUserId: z.string().uuid(),
});

const PassSchema = z.object({
  targetUserId: z.string().uuid(),
});

const FeedQuerySchema = z.object({
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

export class FeedController {
  constructor(
    private getFeedUsersUseCase: GetFeedUsers,
    private likeUserUseCase: LikeUser,
    private passUserUseCase: PassUser
  ) {}

  async getFeed(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      const { limit = 10, offset = 0 } = FeedQuerySchema.parse(request.query);
      
      const result = await this.getFeedUsersUseCase.execute(userId, limit, offset);
      
      if (result.success) {
        return reply.send({
          users: result.data,
          pagination: {
            limit,
            offset,
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

  async likeUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      const { targetUserId } = LikeSchema.parse(request.body);
      
      const result = await this.likeUserUseCase.execute(userId, targetUserId);
      
      if (result.success) {
        return reply.send({
          action: 'like',
          result: result.data,
          isMatch: 'userId1' in result.data, // Check if it's a Match entity
        });
      } else {
        return this.handleError(reply, result.error);
      }
    } catch (error) {
      return this.handleValidationError(reply, error);
    }
  }

  async passUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      const { targetUserId } = PassSchema.parse(request.body);
      
      const result = await this.passUserUseCase.execute(userId, targetUserId);
      
      if (result.success) {
        return reply.send({
          action: 'pass',
          result: result.data,
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
