import Fastify, { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { authRoutes } from '../../../app/routes/auth-routes';
import { feedRoutes } from '../../../app/routes/feed-routes';
import { authMiddleware } from '../../../app/middleware/auth';
import { InMemoryAuthService } from '../auth/in-memory-auth-service';
import {
  TestLikeRepository,
  TestMatchRepository,
  TestPassRepository,
} from '../../unit/helpers/fakeRepositories';
import { LikeUser } from '../../../domain/use-cases/feed/LikeUser';
import { PassUser } from '../../../domain/use-cases/feed/PassUser';
import { GetFeedUsers } from '../../../domain/use-cases/feed/GetFeedUsers';
import {
  InMemoryUserRepository,
  InMemoryPreferencesRepository,
} from './in-memory-repositories';
import { FakeFeedService } from './fake-feed-service';
import {
  setFeedServiceInstance,
  clearFeedServiceInstance,
} from './feed-service-singleton';

type CreateFeedTestAppResult = {
  app: FastifyInstance;
  authService: InMemoryAuthService;
  userRepository: InMemoryUserRepository;
  preferencesRepository: InMemoryPreferencesRepository;
  likeRepository: TestLikeRepository;
  passRepository: TestPassRepository;
  matchRepository: TestMatchRepository;
  feedService: FakeFeedService;
};

export async function createFeedTestApp(): Promise<CreateFeedTestAppResult> {
  const fastify = Fastify({
    logger: false,
  }).withTypeProvider<ZodTypeProvider>();

  fastify.addHook('preValidation', async (request) => {
    request.body = request.body ?? {};
  });

  fastify.setSerializerCompiler(() => {
    return (data) => JSON.stringify(data);
  });

  const authService = new InMemoryAuthService();
  const userRepository = new InMemoryUserRepository();
  const preferencesRepository = new InMemoryPreferencesRepository();
  const likeRepository = new TestLikeRepository();
  const passRepository = new TestPassRepository();
  const matchRepository = new TestMatchRepository();

  const getFeedUsers = new GetFeedUsers(
    userRepository,
    likeRepository,
    passRepository,
    preferencesRepository,
  );

  const feedService = new FakeFeedService(getFeedUsers);
  const likeUserUseCase = new LikeUser(likeRepository, matchRepository);
  const passUserUseCase = new PassUser(passRepository);

  fastify.decorate('authMiddleware', authMiddleware);
  fastify.decorate('likeUser', likeUserUseCase);
  fastify.decorate('passUser', passUserUseCase);

  setFeedServiceInstance(feedService);

  await fastify.register(authRoutes, {
    prefix: '/api/v1/auth',
    authService,
  });

  await fastify.register(feedRoutes, {
    prefix: '/api/v1',
  });

  fastify.addHook('onClose', async () => {
    clearFeedServiceInstance();
  });

  await fastify.ready();

  return {
    app: fastify,
    authService,
    userRepository,
    preferencesRepository,
    likeRepository,
    passRepository,
    matchRepository,
    feedService,
  };
}
