import { FastifyInstance } from 'fastify';
import { MatchesController } from '../controllers/matches-controller';
import { MatchOverviewService } from '../services/match-overview-service';

declare module 'fastify' {
  interface FastifyInstance {
    matchOverviewService: MatchOverviewService;
    authMiddleware: any;
  }
}

export async function matchRoutes(fastify: FastifyInstance) {
  const controller = new MatchesController(fastify.matchOverviewService);

  fastify.get(
    '/matches',
    {
      schema: {
        description: 'List matches for the authenticated user',
        tags: ['matches'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              matches: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    userId1: { type: 'string', format: 'uuid' },
                    userId2: { type: 'string', format: 'uuid' },
                    createdAt: { type: 'string', format: 'date-time' },
                    otherUser: {
                      anyOf: [
                        {
                          type: 'object',
                          properties: {
                            id: { type: 'string', format: 'uuid' },
                            name: { type: 'string' },
                            bio: { type: ['string', 'null'] },
                            photoUrl: { type: ['string', 'null'], format: 'uri' },
                            birthDate: { type: ['string', 'null'], format: 'date' },
                            gender: { type: ['string', 'null'] },
                          },
                          required: ['id', 'name'],
                        },
                        { type: 'null' },
                      ],
                    },
                    lastMessage: {
                      anyOf: [
                        {
                          type: 'object',
                          properties: {
                            id: { type: 'string', format: 'uuid' },
                            matchId: { type: 'string', format: 'uuid' },
                            senderId: { type: 'string', format: 'uuid' },
                            content: { type: 'string' },
                            createdAt: { type: 'string', format: 'date-time' },
                          },
                          required: ['id', 'matchId', 'senderId', 'content', 'createdAt'],
                        },
                        { type: 'null' },
                      ],
                    },
                    unreadCount: { type: 'number' },
                  },
                  required: ['id', 'userId1', 'userId2', 'createdAt', 'unreadCount'],
                },
              },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    controller.list.bind(controller),
  );
}
