import { FastifyInstance } from 'fastify';
import { MatchesController } from '../controllers/matches-controller';
import { MatchOverviewService } from '../services/match-overview-service';

declare module 'fastify' {
  interface FastifyInstance {
    matchOverviewService: MatchOverviewService;
    confirmMatch: any;
    authMiddleware: any;
  }
}

export async function matchRoutes(fastify: FastifyInstance) {
  const controller = new MatchesController(
    fastify.matchOverviewService,
    fastify.confirmMatch
  );

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
                            photoUrl: {
                              type: ['string', 'null'],
                              format: 'uri',
                            },
                            birthDate: {
                              type: ['string', 'null'],
                              format: 'date',
                            },
                            gender: { type: ['string', 'null'] },
                            isBot: { type: 'boolean' },
                            show_bio_in_feed: { type: ['boolean', 'null'] },
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
                          required: [
                            'id',
                            'matchId',
                            'senderId',
                            'content',
                            'createdAt',
                          ],
                        },
                        { type: 'null' },
                      ],
                    },
                    unreadCount: { type: 'number' },
                  },
                  required: [
                    'id',
                    'userId1',
                    'userId2',
                    'createdAt',
                    'unreadCount',
                  ],
                },
              },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    controller.list.bind(controller)
  );

  fastify.put(
    '/matches/:matchId/read',
    {
      schema: {
        description: 'Mark all messages in a match as read',
        tags: ['matches'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            matchId: { type: 'string', format: 'uuid' },
          },
          required: ['matchId'],
        },
        body: {
          type: 'object',
          properties: {
            readAt: { type: 'string', format: 'date-time' },
          },
          required: [],
        },
        response: {
          204: {
            description: 'Messages marked as read successfully',
            type: 'null',
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    controller.markAsRead.bind(controller)
  );

  fastify.post(
    '/matches/confirm',
    {
      schema: {
        description:
          'Confirm a potential match (create match from mutual likes)',
        tags: ['matches'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['targetUserId'],
          properties: {
            targetUserId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              match: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  userId1: { type: 'string', format: 'uuid' },
                  userId2: { type: 'string', format: 'uuid' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
                required: ['id', 'userId1', 'userId2', 'createdAt'],
              },
            },
            required: ['match'],
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    controller.confirm.bind(controller)
  );
}
