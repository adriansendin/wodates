import { FastifyInstance } from 'fastify';
import { ChatController } from '../controllers/chat-controller';

declare module 'fastify' {
  interface FastifyInstance {
    sendMessage: any;
    getMessages: any;
    blockUser: any;
    authMiddleware: any;
    matchRepository: any;
    messageRepository: any;
    affinitySentenceService: any; // AffinitySentenceService | undefined
    buildProfileCtaService: any; // BuildProfileCtaService | undefined
  }
}

export async function chatRoutes(fastify: FastifyInstance) {
  const chatController = new ChatController(
    fastify.sendMessage,
    fastify.getMessages,
    fastify.blockUser,
    fastify.matchRepository,
    fastify.messageRepository,
    fastify.affinitySentenceService,
    fastify.buildProfileCtaService
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

  fastify.get(
    '/chats/:matchId/affinity',
    {
      schema: {
        description: 'Get affinity sentence for a match',
        tags: ['chat'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            matchId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              sentence: { type: 'string' },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    chatController.getAffinitySentence.bind(chatController)
  );

  fastify.get(
    '/chats/:matchId/has-sent-message',
    {
      schema: {
        description: 'Check if user has sent a message in this chat',
        tags: ['chat'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            matchId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              hasSent: { type: 'boolean' },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    chatController.hasSentMessage.bind(chatController)
  );

  fastify.get(
    '/chats/:matchId/build-profile-cta',
    {
      schema: {
        description:
          'Whether to show the "Build my profile" button in this Doc Love chat',
        tags: ['chat'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            matchId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              showButton: { type: 'boolean' },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    chatController.getBuildProfileCta.bind(chatController)
  );

  fastify.post(
    '/chats/:matchId/build-profile-tapped',
    {
      schema: {
        description:
          'Mark that the user tapped "Build my profile" (hides the button forever)',
        tags: ['chat'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            matchId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          204: { type: 'null', description: 'Success' },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    chatController.markBuildProfileTapped.bind(chatController)
  );
}
