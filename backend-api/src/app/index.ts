import 'dotenv/config';
import Fastify from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import os from 'os';
import multipart from '@fastify/multipart';
import { registerCors } from './plugins/cors';
import { registerRateLimit } from './plugins/rate-limit';
import { registerSwagger } from './plugins/swagger';
import { authMiddleware } from './middleware/auth';
import { authRoutes } from './routes/auth-routes';
import { feedRoutes } from './routes/feed-routes';
import { chatRoutes } from './routes/chat-routes';
import { userRoutes } from './routes/user-routes';
import { userPhotosRoutes } from './routes/user-photos-routes';
import { matchRoutes } from './routes/match-routes';
import { storageRoutes } from './routes/storage-routes';
import { userVerificationRoutes } from './routes/user-verification-routes';
import { adminVerificationRoutes } from './routes/admin-verification-routes';
import { questionBankRoutes } from './routes/question-bank-routes';
import { waitlistRoutes } from './routes/waitlist-routes';
import { SupabaseLikeRepository } from '../data/repositories/SupabaseLikeRepository';
import { SupabasePassRepository } from '../data/repositories/SupabasePassRepository';
import { SupabaseMatchRepository } from '../data/repositories/SupabaseMatchRepository';
import { SupabaseMessageRepository } from '../data/repositories/SupabaseMessageRepository';
import { SupabaseBlockedUserRepository } from '../data/repositories/SupabaseBlockedUserRepository';
import { SupabaseQuestionBankRepository } from '../data/repositories/SupabaseQuestionBankRepository';
import { LikeUser } from '../domain/use-cases/feed/LikeUser';
import { PassUser } from '../domain/use-cases/feed/PassUser';
import { ConfirmMatch } from '../domain/use-cases/feed/ConfirmMatch';
import { SendMessage } from '../domain/use-cases/chat/SendMessage';
import { GetMessages } from '../domain/use-cases/chat/GetMessages';
import { BlockUser } from '../domain/use-cases/chat/BlockUser';
import { MatchOverviewService } from './services/match-overview-service';
import { DocLoveHelper } from './services/doc-love-helper';
import { DocLoveChatService } from './ai/chat/DocLoveChatService';
import { ChatCloseMessageService } from './services/chat-close-message-service';
import { createChatModel } from './ai/core/config';
import { UserAIProfileEmbeddingService } from './ai/profile/UserAIProfileEmbeddingService';
import { SupabaseUserAIProfileRepository } from '../data/repositories/SupabaseUserAIProfileRepository';
import { SupabaseUserRepository } from '../data/repositories/SupabaseUserRepository';
import { GetAllUserChats } from '../domain/use-cases/chat/GetAllUserChats';
import { GetUnprocessedMessages } from '../domain/use-cases/chat/GetUnprocessedMessages';
import { GenerateUserProfileFromChats } from '../domain/use-cases/chat/GenerateUserProfileFromChats';
import { startJobScheduler } from './jobs/scheduler';
import { AffinitySentenceService } from './services/affinity-sentence-service';
import { AiServiceChatClient } from './ai/clients/AiServiceChatClient';

async function buildApp() {
  // Startup guard: AI_PROVIDER must be 'ai-service'
  const aiProvider = process.env.AI_PROVIDER;
  if (aiProvider !== 'ai-service') {
    throw new Error(
      `AI_PROVIDER must be 'ai-service'. Got: ${aiProvider || 'undefined'}. ` +
        'Direct LLM providers (ollama, openai) have been removed. ' +
        'All AI operations must go through ai-service HTTP API.'
    );
  }

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
    // Handle unsupported media type errors (415)
    if (
      error.statusCode === 415 ||
      (error as { code?: string }).code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE'
    ) {
      const contentType = request.headers['content-type'] || 'not provided';
      request.log.error(
        { err: error, contentType },
        'Unsupported media type error'
      );
      return reply.status(415).send({
        error: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Use Content-Type: application/json',
      });
    }
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
  const messageRepository = new SupabaseMessageRepository();
  const blockedUserRepository = new SupabaseBlockedUserRepository();
  const questionBankRepository = new SupabaseQuestionBankRepository();
  // const userAskedQuestionRepository = new SupabaseUserAskedQuestionRepository(); // Currently unused
  const matchRepository = new SupabaseMatchRepository();

  // Initialize AI services (for Doc Love chatbot and affinity sentences)
  let docLoveChatService: DocLoveChatService | undefined;
  let affinitySentenceService: AffinitySentenceService | undefined;

  try {
    // Create chat model (ChatModelHttp wrapper for ai-service)
    const chatModel = createChatModel(fastify.log);
    const docLoveHelper = new DocLoveHelper();

    // Initialize Doc Love chat service (for online chat)
    docLoveChatService = new DocLoveChatService(
      docLoveHelper,
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
      userAIProfileRepository,
      fastify.log
    );
    // Store reference for potential future use (e.g., admin endpoints, cron jobs, webhooks)
    // Currently not exposed, but available if needed
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void userAIProfileEmbeddingService;

    // Initialize Affinity Sentence Service for match creation
    const aiServiceChatClient = new AiServiceChatClient(
      undefined, // Use default from AIConfig
      60000, // 60 seconds timeout
      fastify.log
    );
    affinitySentenceService = new AffinitySentenceService(
      userAIProfileRepository,
      aiServiceChatClient,
      fastify.log
    );

    // Show active AI provider in console
    console.log(`🤖 AI Provider: AI-SERVICE | Model: ${chatModel.model}`);
    fastify.log.info(
      `AI services initialized: ChatModel=${chatModel.name} (${chatModel.model}), using ai-service for all operations`
    );
  } catch (error) {
    // Log error but don't fail startup - AI features will just not work
    fastify.log.warn(
      `Failed to initialize AI services (AI features will be disabled): ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Initialize chat close message service (for Doc Love close messages)
  let chatCloseMessageService: ChatCloseMessageService | undefined;
  try {
    const docLoveHelper = new DocLoveHelper();
    chatCloseMessageService = new ChatCloseMessageService(
      docLoveHelper,
      matchRepository,
      messageRepository,
      fastify.log
    );
  } catch (error) {
    fastify.log.warn(
      `Failed to initialize chat close message service: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Initialize use cases
  const likeUser = new LikeUser(likeRepository, matchRepository);
  const passUser = new PassUser(passRepository);
  const confirmMatch = new ConfirmMatch(
    likeRepository,
    matchRepository,
    affinitySentenceService // Pass affinity sentence generator for match creation
  );
  const sendMessage = new SendMessage(
    messageRepository,
    matchRepository,
    docLoveChatService, // Pass Doc Love chat service if available
    fastify.log // Pass logger to SendMessage
  );
  const getMessages = new GetMessages(messageRepository, matchRepository);
  const blockUser = new BlockUser(
    blockedUserRepository,
    matchRepository,
    chatCloseMessageService // Pass chat close message service if available
  );
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

      generateUserProfile = new GenerateUserProfileFromChats(
        getAllUserChats,
        userAIProfileRepository,
        userRepository,
        fastify.log
      );
    }
  } catch (error) {
    fastify.log.warn(
      `Failed to initialize GenerateUserProfileFromChats: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Decorate fastify with use cases and repositories
  fastify.decorate('likeUser', likeUser);
  fastify.decorate('passUser', passUser);
  fastify.decorate('confirmMatch', confirmMatch);
  fastify.decorate('sendMessage', sendMessage);
  fastify.decorate('getMessages', getMessages);
  fastify.decorate('blockUser', blockUser);
  fastify.decorate('matchOverviewService', matchOverviewService);
  fastify.decorate('generateUserProfile', generateUserProfile);
  fastify.decorate('matchRepository', matchRepository);
  fastify.decorate('messageRepository', messageRepository);
  fastify.decorate('affinitySentenceService', affinitySentenceService);

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  await fastify.register(feedRoutes, { prefix: '/api/v1' });
  await fastify.register(chatRoutes, { prefix: '/api/v1' });
  await fastify.register(matchRoutes, { prefix: '/api/v1' });
  await fastify.register(userRoutes, { prefix: '/api/v1' });
  await fastify.register(userPhotosRoutes, { prefix: '/api/v1' });
  await fastify.register(userVerificationRoutes, { prefix: '/api/v1' });
  await fastify.register(storageRoutes, { prefix: '/api/v1' });
  await fastify.register(adminVerificationRoutes, { prefix: '/admin' });
  await fastify.register(
    (fastify) => questionBankRoutes(fastify, questionBankRepository),
    { prefix: '/api/v1' }
  );
  await fastify.register(waitlistRoutes, { prefix: '/api/v1/waitlist' });

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

    // Try to detect and display the actual local IP
    const networkInterfaces = os.networkInterfaces();
    let localIP = 'YOUR_LOCAL_IP';
    for (const interfaceName of Object.keys(networkInterfaces)) {
      for (const iface of networkInterfaces[interfaceName] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIP = iface.address;
          break;
        }
      }
      if (localIP !== 'YOUR_LOCAL_IP') break;
    }
    console.log(
      `   - Network: http://${localIP}:${port} (use this on your iPhone)`
    );
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
start();
export { buildApp };
