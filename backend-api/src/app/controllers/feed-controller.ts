import { FastifyRequest, FastifyReply } from 'fastify';
import { LikeUser } from '../../domain/use-cases/feed/LikeUser';
import { PassUser } from '../../domain/use-cases/feed/PassUser';
import { DomainError } from '../../domain/errors/DomainError';
import { z } from 'zod';
import { SupabaseFeedService } from '../services/supabase-feed-service';

const LikeSchema = z.object({
  targetUserId: z.string().uuid(),
});

const PassSchema = z.object({
  targetUserId: z.string().uuid(),
});

const FeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export class FeedController {
  constructor(
    private readonly feedService: SupabaseFeedService,
    private likeUserUseCase: LikeUser,
    private passUserUseCase: PassUser
  ) {}

  async getFeed(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      const { limit = 10, offset = 0 } = FeedQuerySchema.parse(request.query);

      const candidates = await this.feedService.getFeedCandidates(
        userId,
        limit,
        offset
      );

      return reply.send({
        users: candidates,
        pagination: {
          limit,
          offset,
          hasMore: candidates.length === limit,
        },
      });
    } catch (error) {
      if (error instanceof DomainError) {
        return this.handleError(reply, error);
      }
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
