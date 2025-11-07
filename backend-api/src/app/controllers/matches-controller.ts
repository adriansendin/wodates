import { FastifyReply, FastifyRequest } from 'fastify';
import { MatchOverviewService } from '../services/match-overview-service';

export class MatchesController {
  constructor(private matchOverviewService: MatchOverviewService) {}

  async list(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user!.id;

    const result = await this.matchOverviewService.list(userId);
    if (!result.success) {
      const error = result.error;
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
        details: error.details,
      });
    }

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
  }
}
