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

// Import repositories
import { InMemoryUserRepository } from '../data/repositories/InMemoryUserRepository';
import { InMemoryPreferencesRepository } from '../data/repositories/InMemoryPreferencesRepository';
import { InMemoryLikeRepository } from '../data/repositories/InMemoryLikeRepository';
import { InMemoryPassRepository } from '../data/repositories/InMemoryPassRepository';
import { InMemoryMatchRepository } from '../data/repositories/InMemoryMatchRepository';
import { InMemoryMessageRepository } from '../data/repositories/InMemoryMessageRepository';

// Import use cases
import { RegisterUser } from '../domain/use-cases/auth/RegisterUser';
import { LoginUser } from '../domain/use-cases/auth/LoginUser';
import { GetFeedUsers } from '../domain/use-cases/feed/GetFeedUsers';
import { LikeUser } from '../domain/use-cases/feed/LikeUser';
import { PassUser } from '../domain/use-cases/feed/PassUser';
import { SendMessage } from '../domain/use-cases/chat/SendMessage';
import { GetMessages } from '../domain/use-cases/chat/GetMessages';

// Import seed data
import { demoUsers, demoPreferences } from '../data/seeds/demo-users';

async function buildApp() {
  const fastify = Fastify({
    logger: process.env.NODE_ENV === 'development' ? {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      },
    } : true,
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
  const userRepository = new InMemoryUserRepository();
  const preferencesRepository = new InMemoryPreferencesRepository();
  const likeRepository = new InMemoryLikeRepository();
  const passRepository = new InMemoryPassRepository();
  const matchRepository = new InMemoryMatchRepository();
  const messageRepository = new InMemoryMessageRepository();

  // Initialize use cases
  const registerUser = new RegisterUser(userRepository, preferencesRepository);
  const loginUser = new LoginUser(userRepository);
  const getFeedUsers = new GetFeedUsers(userRepository, likeRepository, passRepository, preferencesRepository);
  const likeUser = new LikeUser(likeRepository, matchRepository);
  const passUser = new PassUser(passRepository);
  const sendMessage = new SendMessage(messageRepository, matchRepository);
  const getMessages = new GetMessages(messageRepository, matchRepository);

  // Decorate fastify with use cases
  fastify.decorate('registerUser', registerUser);
  fastify.decorate('loginUser', loginUser);
  fastify.decorate('getFeedUsers', getFeedUsers);
  fastify.decorate('likeUser', likeUser);
  fastify.decorate('passUser', passUser);
  fastify.decorate('sendMessage', sendMessage);
  fastify.decorate('getMessages', getMessages);

  // Seed demo data
  await seedDemoData(userRepository, preferencesRepository);

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  await fastify.register(feedRoutes, { prefix: '/api/v1' });
  await fastify.register(chatRoutes, { prefix: '/api/v1' });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return fastify;
}

async function seedDemoData(
  userRepository: InMemoryUserRepository,
  preferencesRepository: InMemoryPreferencesRepository
) {
  console.log('Seeding demo data...');
  
  for (let i = 0; i < demoUsers.length; i++) {
    const userData = demoUsers[i];
    const preferencesData = demoPreferences[i];
    
    if (!userData || !preferencesData) {
      console.warn(`Skipping user at index ${i} - missing data`);
      continue;
    }
    
    // Create user
    const userResult = await userRepository.create(userData);
    if (userResult.success) {
      const user = userResult.data;
      
      // Create preferences
      const preferencesResult = await preferencesRepository.create({
        ...preferencesData,
        userId: user.id,
      });
      
      if (preferencesResult.success) {
        console.log(`Created user: ${user.name} (${user.email}) with preferences`);
      } else {
        console.error(`Failed to create preferences for user ${user.name}:`, preferencesResult.error);
      }
    } else {
      console.error(`Failed to create user at index ${i}:`, userResult.error);
    }
  }
  
  console.log('Demo data seeded successfully');
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
