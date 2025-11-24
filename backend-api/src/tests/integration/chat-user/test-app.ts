import Fastify, { type FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { authRoutes } from '../../../app/routes/auth-routes';
import { chatRoutes } from '../../../app/routes/chat-routes';
import { userRoutes } from '../../../app/routes/user-routes';
import { authMiddleware } from '../../../app/middleware/auth';
import { SendMessage } from '../../../domain/use-cases/chat/SendMessage';
import { GetMessages } from '../../../domain/use-cases/chat/GetMessages';
import { BlockUser } from '../../../domain/use-cases/chat/BlockUser';
import { InMemoryAuthService } from '../auth/in-memory-auth-service';
import {
  TestMatchRepository,
  TestBlockedUserRepository,
} from '../../unit/helpers/fakeRepositories';
import { InMemoryMessageRepository } from './in-memory-message-repository';

export type CreateChatUserTestAppResult = {
  app: FastifyInstance;
  authService: InMemoryAuthService;
  matchRepository: TestMatchRepository;
  messageRepository: InMemoryMessageRepository;
  blockedUserRepository: TestBlockedUserRepository;
};

export async function createChatUserTestApp(): Promise<CreateChatUserTestAppResult> {
  const fastify = Fastify({
    logger: false,
  }).withTypeProvider<ZodTypeProvider>();

  fastify.addHook('preValidation', async (request) => {
    request.body = request.body ?? {};
  });

  fastify.setSerializerCompiler(() => {
    return (data) => JSON.stringify(data);
  });

  fastify.decorate('authMiddleware', authMiddleware);

  const authService = new InMemoryAuthService();
  const matchRepository = new TestMatchRepository();
  const messageRepository = new InMemoryMessageRepository();
  const blockedUserRepository = new TestBlockedUserRepository();

  const sendMessage = new SendMessage(messageRepository, matchRepository);
  const getMessages = new GetMessages(messageRepository, matchRepository);
  const blockUser = new BlockUser(blockedUserRepository, matchRepository);

  fastify.decorate('sendMessage', sendMessage);
  fastify.decorate('getMessages', getMessages);
  fastify.decorate('blockUser', blockUser);

  await fastify.register(authRoutes, {
    prefix: '/api/v1/auth',
    authService,
  });

  await fastify.register(chatRoutes, {
    prefix: '/api/v1',
  });

  await fastify.register(userRoutes, {
    prefix: '/api/v1',
  });

  await fastify.ready();

  return {
    app: fastify,
    authService,
    matchRepository,
    messageRepository,
    blockedUserRepository,
  };
}
