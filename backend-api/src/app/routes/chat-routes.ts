import { FastifyInstance } from 'fastify';
import { ChatController } from '../controllers/chat-controller';

declare module 'fastify' {
  interface FastifyInstance {
    sendMessage: any;
    getMessages: any;
    blockUser: any;
    authMiddleware: any;
  }
}

export async function chatRoutes(fastify: FastifyInstance) {
  const chatController = new ChatController(
    fastify.sendMessage,
    fastify.getMessages,
    fastify.blockUser
  );

  fastify.get(
    '/chats/:matchId/messages',
    {
      schema: {
        description: 'Get messages for a match',
        tags: ['chat'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            matchId: { type: 'string', format: 'uuid' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
            before: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              messages: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    matchId: { type: 'string' },
                    senderId: { type: 'string' },
                    content: { type: 'string' },
                    createdAt: { type: 'string' },
                  },
                },
              },
              pagination: {
                type: 'object',
                properties: {
                  limit: { type: 'number' },
                  before: { type: 'string' },
                  hasMore: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    chatController.getMessages.bind(chatController)
  );

  fastify.post(
    '/chats/:matchId/messages',
    {
      schema: {
        description: 'Send a message',
        tags: ['chat'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            matchId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['content'],
          properties: {
            content: { type: 'string', minLength: 1, maxLength: 1000 },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              message: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  matchId: { type: 'string' },
                  senderId: { type: 'string' },
                  content: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    chatController.sendMessage.bind(chatController)
  );

  fastify.post(
    '/chats/:matchId/block',
    {
      schema: {
        description: 'Block a user and remove the match',
        tags: ['chat'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            matchId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['blockedUserId'],
          properties: {
            blockedUserId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              blocked: { type: 'boolean' },
              blockedUser: {
                type: 'object',
                properties: {
                  blockerId: { type: 'string' },
                  blockedId: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    chatController.blockUser.bind(chatController)
  );
}
