import 'dotenv/config';
import Fastify from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { registerCors } from './plugins/cors';
import { registerRateLimit } from './plugins/rate-limit';
import { registerSwagger } from './plugins/swagger';
import { authMiddleware } from './middleware/auth';
import { authRoutes } from './routes/auth-routes';
import { feedRoutes } from './routes/feed-routes';
import { chatRoutes } from './routes/chat-routes';
import { userRoutes } from './routes/user-routes';
import { matchRoutes } from './routes/match-routes';
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

async function buildApp() {
  const logLevel = process.env.FASTIFY_LOG_LEVEL ?? (process.env.NODE_ENV === 'development' ? 'warn' : 'info');

  const fastify = Fastify({
    logger: process.env.NODE_ENV === 'development'
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

  // Configure schema validation
  fastify.addHook('preValidation', async (request) => {
    request.body = request.body || {};
  });

  // Configure serializer
  fastify.setSerializerCompiler(() => {
    return data => JSON.stringify(data);
  });

  // Error handler for validation errors
  fastify.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: error.message,
        details: error.validation
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

  // Initialize use cases
  const likeUser = new LikeUser(likeRepository, matchRepository);
  const passUser = new PassUser(passRepository);
  const sendMessage = new SendMessage(messageRepository, matchRepository);
  const getMessages = new GetMessages(messageRepository, matchRepository);
  const blockUser = new BlockUser(blockedUserRepository, matchRepository);
  const matchOverviewService = new MatchOverviewService(
    matchRepository,
    messageRepository,
    blockedUserRepository,
  );

  // Decorate fastify with use cases
  fastify.decorate('likeUser', likeUser);
  fastify.decorate('passUser', passUser);
  fastify.decorate('sendMessage', sendMessage);
  fastify.decorate('getMessages', getMessages);
  fastify.decorate('blockUser', blockUser);
  fastify.decorate('matchOverviewService', matchOverviewService);

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  await fastify.register(feedRoutes, { prefix: '/api/v1' });
  await fastify.register(chatRoutes, { prefix: '/api/v1' });
  await fastify.register(matchRoutes, { prefix: '/api/v1' });
  await fastify.register(userRoutes, { prefix: '/api/v1' });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return fastify;
}

async function start() {
  try {
    const app = await buildApp();
    
    const port = parseInt(process.env.PORT || '3000');
    const host = '0.0.0.0';
    
    await app.listen({ port, host });
    console.log(`🚀 Server running at http://localhost:${port}`);
    console.log(`📚 API Documentation: http://localhost:${port}/documentation`);
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
start();
export { buildApp };
