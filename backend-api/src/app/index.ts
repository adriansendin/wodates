import 'dotenv/config';
import Fastify from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import multipart from '@fastify/multipart';
import { registerCors } from './plugins/cors';
import { registerRateLimit } from './plugins/rate-limit';
import { registerSwagger } from './plugins/swagger';
import { authMiddleware } from './middleware/auth';
import { authRoutes } from './routes/auth-routes';
import { feedRoutes } from './routes/feed-routes';
import { chatRoutes } from './routes/chat-routes';
import { userRoutes } from './routes/user-routes';
import { matchRoutes } from './routes/match-routes';
import { storageRoutes } from './routes/storage-routes';
import { SupabaseLikeRepository } from '../data/repositories/SupabaseLikeRepository';
import { SupabasePassRepository } from '../data/repositories/SupabasePassRepository';
import { SupabaseMatchRepository } from '../data/repositories/SupabaseMatchRepository';
import { SupabaseMessageRepository } from '../data/repositories/SupabaseMessageRepository';
import { SupabaseBlockedUserRepository } from '../data/repositories/SupabaseBlockedUserRepository';
import { LikeUser } from '../domain/use-cases/feed/LikeUser';
import { PassUser } from '../domain/use-cases/feed/PassUser';
import { SendMessage } from '../domain/use-cases/chat/SendMessage';
import { GetMessages } from '../domain/use-cases/chat/GetMessages';
import { BlockUser } from '../domain/use-cases/chat/BlockUser';
import { MatchOverviewService } from './services/match-overview-service';
import { DocLoveHelper } from './services/doc-love-helper';
import { DocLoveChatService } from './ai/chat/DocLoveChatService';
import {
  createChatModel,
  createSummarizerModel,
  createEmbeddingModel,
} from './ai/core/config';
import { AIConfig } from './ai/ai-settings';
import { UserAIProfileEmbeddingService } from './ai/profile/UserAIProfileEmbeddingService';
import { SupabaseUserAIProfileRepository } from '../data/repositories/SupabaseUserAIProfileRepository';
import { SupabaseUserRepository } from '../data/repositories/SupabaseUserRepository';
import { GetAllUserChats } from '../domain/use-cases/chat/GetAllUserChats';
import { GetUnprocessedMessages } from '../domain/use-cases/chat/GetUnprocessedMessages';
import { GenerateUserProfileFromChats } from '../domain/use-cases/chat/GenerateUserProfileFromChats';
import { startJobScheduler } from './jobs/scheduler';

async function buildApp() {
  const logLevel =
    process.env.FASTIFY_LOG_LEVEL ??
    (process.env.NODE_ENV === 'development' ? 'warn' : 'info');

  const fastify = Fastify({
    logger:
      process.env.NODE_ENV === 'development'
        ? {
            level: logLevel,
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
              },
            },
          }
        : { level: logLevel },
    disableRequestLogging: logLevel !== 'info',
  }).withTypeProvider<ZodTypeProvider>();

  // Register plugins
  await registerCors(fastify);
  await registerRateLimit(fastify);
  await registerSwagger(fastify);
  await fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB max file size
    },
  });

  // Log all incoming requests for debugging
  fastify.addHook('onRequest', async (request) => {
    console.log(
      `[${new Date().toISOString()}] ${request.method} ${request.url} - Origin: ${request.headers.origin || 'none'}`
    );
  });

  // Configure schema validation
  fastify.addHook('preValidation', async (request) => {
    request.body = request.body || {};
  });

  // Configure serializer
  fastify.setSerializerCompiler(() => {
    return (data) => JSON.stringify(data);
  });

  // Error handler for validation errors
  fastify.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: error.message,
        details: error.validation,
      });
    }
    request.log.error(error);
    return reply.status(500).send({ error: 'INTERNAL_SERVER_ERROR' });
  });

  // Register middleware
  fastify.decorate('authMiddleware', authMiddleware);

  // Initialize repositories
  const likeRepository = new SupabaseLikeRepository();
  const passRepository = new SupabasePassRepository();
  const matchRepository = new SupabaseMatchRepository();
  const messageRepository = new SupabaseMessageRepository();
  const blockedUserRepository = new SupabaseBlockedUserRepository();

  // Initialize AI services (for Doc Love chatbot)
  let docLoveChatService: DocLoveChatService | undefined;

  try {
    // Create AI models
    const chatModel = createChatModel(fastify.log);
    const summarizerModel = createSummarizerModel(fastify.log);
    const embeddingModel = createEmbeddingModel(fastify.log);

    const docLoveHelper = new DocLoveHelper();

    // Initialize Doc Love chat service (for online chat)
    docLoveChatService = new DocLoveChatService(
      docLoveHelper,
      chatModel,
      messageRepository,
      matchRepository,
      // UserRepository is optional - pass undefined for now
      // Can be added later if needed for user context
      undefined,
      fastify.log
    );

    // Initialize User AI Profile Embedding Service
    // This service generates embeddings from summaries stored in user_ai_profiles table
    // Should be called asynchronously (via jobs/cron/webhooks) when summaries are updated
    const userAIProfileRepository = new SupabaseUserAIProfileRepository();
    const userAIProfileEmbeddingService = new UserAIProfileEmbeddingService(
      embeddingModel,
      userAIProfileRepository,
      fastify.log
    );
    // Store reference for potential future use (e.g., admin endpoints, cron jobs, webhooks)
    // Currently not exposed, but available if needed
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void userAIProfileEmbeddingService;

    // Show active LLM in console (similar to server startup messages)
    const providerName = process.env.AI_PROVIDER || AIConfig.defaultProvider;
    const activeModel = chatModel.model;
    console.log(
      `🤖 AI Provider: ${providerName.toUpperCase()} | Model: ${activeModel}`
    );
    fastify.log.info(
      `AI services initialized: ChatModel=${chatModel.name} (${chatModel.model}), SummarizerModel=${summarizerModel.name} (${summarizerModel.model}), EmbeddingModel=${embeddingModel.name} (${embeddingModel.model})`
    );
  } catch (error) {
    // Log error but don't fail startup - AI features will just not work
    fastify.log.warn(
      `Failed to initialize AI services (AI features will be disabled): ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Initialize use cases
  const likeUser = new LikeUser(likeRepository, matchRepository);
  const passUser = new PassUser(passRepository);
  const sendMessage = new SendMessage(
    messageRepository,
    matchRepository,
    docLoveChatService, // Pass Doc Love chat service if available
    fastify.log // Pass logger to SendMessage
  );
  const getMessages = new GetMessages(messageRepository, matchRepository);
  const blockUser = new BlockUser(blockedUserRepository, matchRepository);
  const matchOverviewService = new MatchOverviewService(
    matchRepository,
    messageRepository,
    blockedUserRepository
  );

  // Initialize AI profile generation use case (if AI services are available)
  let generateUserProfile: GenerateUserProfileFromChats | undefined;
  try {
    if (docLoveChatService) {
      const userRepository = new SupabaseUserRepository();
      const userAIProfileRepository = new SupabaseUserAIProfileRepository();
      const docLoveHelper = new DocLoveHelper();
      const getUnprocessedMessages = new GetUnprocessedMessages(
        messageRepository,
        matchRepository
      );
      const getAllUserChats = new GetAllUserChats(
        matchRepository,
        userRepository,
        getUnprocessedMessages,
        messageRepository,
        docLoveHelper,
        fastify.log
      );
      const summarizerModel = createSummarizerModel(fastify.log);

      generateUserProfile = new GenerateUserProfileFromChats(
        getAllUserChats,
        userAIProfileRepository,
        userRepository,
        summarizerModel,
        docLoveHelper,
        fastify.log
      );
    }
  } catch (error) {
    fastify.log.warn(
      `Failed to initialize GenerateUserProfileFromChats: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Decorate fastify with use cases
  fastify.decorate('likeUser', likeUser);
  fastify.decorate('passUser', passUser);
  fastify.decorate('sendMessage', sendMessage);
  fastify.decorate('getMessages', getMessages);
  fastify.decorate('blockUser', blockUser);
  fastify.decorate('matchOverviewService', matchOverviewService);
  fastify.decorate('generateUserProfile', generateUserProfile);

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  await fastify.register(feedRoutes, { prefix: '/api/v1' });
  await fastify.register(chatRoutes, { prefix: '/api/v1' });
  await fastify.register(matchRoutes, { prefix: '/api/v1' });
  await fastify.register(userRoutes, { prefix: '/api/v1' });
  await fastify.register(storageRoutes, { prefix: '/api/v1' });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Start job scheduler (only in non-test environments)
  if (process.env.NODE_ENV !== 'test') {
    startJobScheduler();
  }

  return fastify;
}

async function start() {
  try {
    const app = await buildApp();

    const port = parseInt(process.env.PORT || '3000');
    const host = '0.0.0.0';

    await app.listen({ port, host });
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📚 API Documentation: http://localhost:${port}/documentation`);
    console.log(`🔗 Health check: http://localhost:${port}/health`);
    console.log(`🌐 Listening on all interfaces (0.0.0.0:${port})`);
    console.log(`   - Local: http://localhost:${port}`);
    console.log(`   - Network: http://192.168.1.11:${port} (or your local IP)`);
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
start();
export { buildApp };
