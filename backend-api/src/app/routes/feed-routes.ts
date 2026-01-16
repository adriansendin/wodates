import { FastifyInstance } from 'fastify';
import { FeedController } from '../controllers/feed-controller';
import { SupabaseFeedService } from '../services/supabase-feed-service';

declare module 'fastify' {
  interface FastifyInstance {
    likeUser: any;
    passUser: any;
    authMiddleware: any;
  }
}

export async function feedRoutes(fastify: FastifyInstance) {
  const feedService = new SupabaseFeedService();
  const feedController = new FeedController(
    feedService,
    fastify.likeUser,
    fastify.passUser,
    fastify.log
  );

  fastify.get(
    '/feed',
    {
      schema: {
        description: 'Get feed users',
        tags: ['feed'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
            offset: { type: 'number', minimum: 0, default: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              users: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    gender: { type: 'string', nullable: true },
                    birthDate: {
                      type: 'string',
                      format: 'date-time',
                      nullable: true,
                    },
                    age: { type: 'number', nullable: true },
                    bio: { type: 'string', nullable: true },
                    photoUrl: { type: 'string', nullable: true },
                  },
                },
              },
              pagination: {
                type: 'object',
                properties: {
                  limit: { type: 'number' },
                  offset: { type: 'number' },
                  hasMore: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    feedController.getFeed.bind(feedController)
  );

  fastify.post(
    '/likes',
    {
      schema: {
        description: 'Like a user',
        tags: ['feed'],
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
              action: { type: 'string' },
              result: { type: 'object' },
              isMatch: { type: 'boolean' },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    feedController.likeUser.bind(feedController)
  );

  fastify.post(
    '/passes',
    {
      schema: {
        description: 'Pass on a user',
        tags: ['feed'],
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
              action: { type: 'string' },
              result: { type: 'object' },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    feedController.passUser.bind(feedController)
  );

  fastify.get(
    '/feed/affinity-sentences/:candidateId',
    {
      schema: {
        description: 'Get affinity sentences for a feed candidate',
        tags: ['feed'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['candidateId'],
          properties: {
            candidateId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              sentences: {
                type: 'array',
                items: { type: 'string' },
                minItems: 0,
                maxItems: 1,
              },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    feedController.getAffinitySentences.bind(feedController)
  );
}
