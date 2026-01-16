import { FastifyReply, FastifyRequest } from 'fastify';
import { MatchOverviewService } from '../services/match-overview-service';
import { z } from 'zod';

const ConfirmMatchSchema = z.object({
  targetUserId: z.string().uuid(),
});

export class MatchesController {
  constructor(
    private matchOverviewService: MatchOverviewService,
    private confirmMatchUseCase: any
  ) {}

  async list(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user!.id;
    request.log.info({ userId }, 'GET /matches - Starting request');

    try {
      const result = await this.matchOverviewService.list(userId);

      if (!result.success) {
        request.log.error(
          { userId, error: result.error },
          'GET /matches - Service returned error'
        );
        const error = result.error;
        return reply.status(error.statusCode).send({
          error: error.code,
          message: error.message,
          details: error.details,
        });
      }

      request.log.info(
        {
          userId,
          matchesCount: result.data.matches.length,
          activeChatsCount: result.data.activeChatsCount,
        },
        'GET /matches - Success'
      );

      return reply.send({
        matches: result.data.matches.map((match) => ({
          id: match.id,
          userId1: match.userId1,
          userId2: match.userId2,
          createdAt: match.createdAt,
          otherUser: match.otherUser,
          lastMessage: match.lastMessage ?? null,
          unreadCount: match.unreadCount,
        })),
        activeChatsCount: result.data.activeChatsCount,
      });
    } catch (error) {
      request.log.error({ userId, error }, 'GET /matches - Unexpected error');
      return reply.status(500).send({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  }

  async markAsRead(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user!.id;
    const matchId = (request.params as { matchId: string }).matchId;
    const body = request.body as { readAt?: string } | undefined;
    const readAt = body?.readAt ? new Date(body.readAt) : undefined;

    request.log.info({ userId, matchId, readAt }, 'PUT /matches/:matchId/read - Starting request');

    try {
      const result = await this.matchOverviewService.markAsRead(matchId, userId, readAt);

      if (!result.success) {
        request.log.error(
          { userId, matchId, error: result.error },
          'PUT /matches/:matchId/read - Service returned error'
        );
        const error = result.error;
        return reply.status(error.statusCode).send({
          error: error.code,
          message: error.message,
          details: error.details,
        });
      }

      request.log.info(
        { userId, matchId },
        'PUT /matches/:matchId/read - Success'
      );

      return reply.status(204).send();
    } catch (error) {
      request.log.error(
        { userId, matchId, error },
        'PUT /matches/:matchId/read - Unexpected error'
      );
      return reply.status(500).send({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  }

  async confirm(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user!.id;
    request.log.info({ userId }, 'POST /matches/confirm - Starting request');

    try {
      const { targetUserId } = ConfirmMatchSchema.parse(request.body);

      const result = await this.confirmMatchUseCase.execute(userId, targetUserId);

      if (!result.success) {
        request.log.error(
          { userId, targetUserId, error: result.error },
          'POST /matches/confirm - Use case returned error'
        );
        const error = result.error;
        return reply.status(error.statusCode).send({
          error: error.code,
          message: error.message,
          details: error.details,
        });
      }

      request.log.info(
        { userId, targetUserId, matchId: result.data.id },
        'POST /matches/confirm - Success'
      );

      return reply.send({
        match: {
          id: result.data.id,
          userId1: result.data.userId1,
          userId2: result.data.userId2,
          createdAt: result.data.createdAt,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors,
        });
      }
      request.log.error({ userId, error }, 'POST /matches/confirm - Unexpected error');
      return reply.status(500).send({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  }
}
