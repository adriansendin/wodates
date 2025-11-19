import { FastifyReply, FastifyRequest } from 'fastify';
import { MatchOverviewService } from '../services/match-overview-service';

export class MatchesController {
  constructor(private matchOverviewService: MatchOverviewService) {}

  async list(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user!.id;
    request.log.info({ userId }, 'GET /matches - Starting request');

    try {
      const result = await this.matchOverviewService.list(userId);
      
      if (!result.success) {
        request.log.error(
          { userId, error: result.error },
          'GET /matches - Service returned error',
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
        'GET /matches - Success',
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
      request.log.error(
        { userId, error },
        'GET /matches - Unexpected error',
      );
      return reply.status(500).send({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  }
}
