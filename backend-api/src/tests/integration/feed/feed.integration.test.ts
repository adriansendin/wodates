import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../data/repositories/SupabaseUserAIProfileRepository', () => {
  return {
    SupabaseUserAIProfileRepository: class SupabaseUserAIProfileRepositoryMock {
      async findByUserId() {
        return { success: true, data: null };
      }
    },
  };
});

import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import {
  authenticateUser,
  AuthSuccessResponseSchema,
} from '../auth/authenticate-user';
import {
  UserFactory,
  type UserFactoryAttributes,
} from '../auth/factories/user-factory';
import {
  ProfileFactory,
  type ProfileFactoryAttributes,
} from '../auth/factories/profile-factory';
import { createFeedTestApp } from './test-app';
import type {
  InMemoryUserRepository,
  InMemoryPreferencesRepository,
} from './in-memory-repositories';
import type {
  TestLikeRepository,
  TestMatchRepository,
} from '../../unit/helpers/fakeRepositories';
import { PreferencesFactory } from './factories/preferences-factory';
import { FeedFactory } from './factories/feed-factory';
import type { User, Gender } from '../../../domain/entities/User';
import type { Preferences } from '../../../domain/entities/Preferences';
import type { LookingForValue } from '../../../domain/entities/LookingFor';
import { clearFeedServiceInstance } from './feed-service-singleton';

vi.mock('../../../app/services/supabase-feed-service', async () => {
  const { getFeedServiceInstance } = await import('./feed-service-singleton');

  return {
    SupabaseFeedService: class SupabaseFeedServiceMock {
      constructor() {
        return getFeedServiceInstance();
      }
    },
  };
});

const FeedResponseSchema = z.object({
  users: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      bio: z.string().nullable(),
      birthDate: z.string().nullable(),
      age: z.number().nullable(),
      gender: z.string().nullable(),
      photoUrl: z.string().nullable(),
    })
  ),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  }),
});

const LikeResponseSchema = z.object({
  action: z.literal('like'),
  result: z
    .object({
      id: z.string(),
      userId: z.string(),
      targetUserId: z.string(),
      createdAt: z.string(),
    })
    .or(
      z.object({
        id: z.string(),
        userId1: z.string(),
        userId2: z.string(),
        createdAt: z.string(),
      })
    ),
  isMatch: z.boolean(),
  isPotentialMatch: z.boolean().optional(),
});

const PassResponseSchema = z.object({
  action: z.literal('pass'),
  result: z.object({
    id: z.string(),
    userId: z.string(),
    targetUserId: z.string(),
    createdAt: z.string(),
  }),
});

type RegisteredUser = {
  id: string;
  email: string;
  password: string;
  token: string;
  profile: ProfileFactoryAttributes;
  domainUser: User;
};

type RegisterOptions = {
  userOverrides?: Partial<UserFactoryAttributes>;
  profileOverrides?: Partial<ProfileFactoryAttributes>;
  preferences?: Partial<
    Pick<Preferences, 'ageMin' | 'ageMax' | 'genderFilter' | 'maxDistance'>
  >;
  seedOverrides?: Partial<User>;
};

describe('Feed routes', () => {
  let app: FastifyInstance;
  let userRepository: InMemoryUserRepository;
  let preferencesRepository: InMemoryPreferencesRepository;
  let likeRepository: TestLikeRepository;
  let matchRepository: TestMatchRepository;

  beforeEach(async () => {
    FeedFactory.reset();
    const setup = await createFeedTestApp();
    app = setup.app;
    userRepository = setup.userRepository;
    preferencesRepository = setup.preferencesRepository;
    likeRepository = setup.likeRepository;
    matchRepository = setup.matchRepository;
  });

  afterEach(async () => {
    clearFeedServiceInstance();
    if (app) {
      await app.close();
    }
  });

  it('returns a filtered feed based on user preferences', async () => {
    const viewer = await registerUserAndSeed({
      preferences: {
        genderFilter: ['male'],
        ageMin: 27,
        ageMax: 32,
      },
    });

    const [matchCandidate, filteredByGender, filteredByAge] =
      FeedFactory.generateSampleFeed([
        { name: 'Alex', gender: 'male', age: 28 },
        { name: 'Bianca', gender: 'female', age: 29 },
        { name: 'Charles', gender: 'male', age: 40 },
      ]);

    seedUser(matchCandidate);
    seedUser(filteredByGender);
    seedUser(filteredByAge);

    const response = await getFeed(viewer.token);

    expect(response.statusCode).toBe(200);
    const payload = FeedResponseSchema.parse(response.json());
    expect(payload.users).toHaveLength(1);
    expect(payload.users[0].id).toBe(matchCandidate.id);
    expect(payload.pagination.limit).toBe(10);
    expect(payload.pagination.offset).toBe(0);
    expect(payload.pagination.hasMore).toBe(false);
  });

  it('creates a like and returns isMatch=false when there is no mutual like', async () => {
    const viewer = await registerUserAndSeed({
      preferences: { genderFilter: ['female'], ageMin: 20, ageMax: 40 },
    });
    const [candidate] = FeedFactory.generateSampleFeed([
      { name: 'Lucia', gender: 'female', age: 28 },
    ]);
    seedUser(candidate);

    const response = await likeUser(viewer.token, candidate.id);

    expect(response.statusCode).toBe(200);
    const payload = LikeResponseSchema.parse(response.json());
    expect(payload.isMatch).toBe(false);
    expect(payload.result).toMatchObject({
      userId: viewer.id,
      targetUserId: candidate.id,
    });

    const likeResult = await likeRepository.findByUserId(viewer.id);
    expect(likeResult.success).toBe(true);
    if (likeResult.success) {
      expect(likeResult.data).toHaveLength(1);
      expect(likeResult.data[0].targetUserId).toBe(candidate.id);
    }
  });

  it('excludes liked users from subsequent feed responses', async () => {
    const viewer = await registerUserAndSeed({
      preferences: { genderFilter: ['female'], ageMin: 20, ageMax: 40 },
    });
    const [candidate] = FeedFactory.generateSampleFeed([
      { name: 'Noa', gender: 'female', age: 29 },
    ]);
    seedUser(candidate);

    const initialFeed = await getFeed(viewer.token);
    expect(initialFeed.statusCode).toBe(200);
    const initialPayload = FeedResponseSchema.parse(initialFeed.json());
    expect(initialPayload.users.map((user) => user.id)).toContain(candidate.id);

    await likeUser(viewer.token, candidate.id);

    const updatedFeed = await getFeed(viewer.token);
    const updatedPayload = FeedResponseSchema.parse(updatedFeed.json());
    expect(updatedPayload.users.map((user) => user.id)).not.toContain(
      candidate.id
    );
  });

  it('returns isPotentialMatch when both users like each other', async () => {
    const viewer = await registerUserAndSeed({
      preferences: { genderFilter: ['female'] },
    });
    const target = await registerUserAndSeed({
      userOverrides: { email: 'second.user@example.com' },
      profileOverrides: { gender: 'female' },
      preferences: { genderFilter: ['male'] },
    });

    const firstLike = await likeUser(viewer.token, target.id);
    expect(LikeResponseSchema.parse(firstLike.json()).isMatch).toBe(false);

    const mutualLike = await likeUser(target.token, viewer.id);
    expect(mutualLike.statusCode).toBe(200);
    const payload = LikeResponseSchema.parse(mutualLike.json());
    // Mutual like should return isMatch=false but isPotentialMatch=true
    expect(payload.isMatch).toBe(false);
    // Verify it's a Like (not a Match) with isPotentialMatch flag
    expect('userId' in payload.result && 'targetUserId' in payload.result).toBe(
      true
    );
    // Check for isPotentialMatch in the response (controller adds this field)
    const fullPayload = mutualLike.json() as {
      action: string;
      result: unknown;
      isMatch: boolean;
      isPotentialMatch?: boolean;
    };
    expect(fullPayload.isPotentialMatch).toBe(true);

    // Match should NOT be created yet (only after explicit confirmation)
    const matches = await matchRepository.findByUserId(viewer.id);
    expect(matches.success).toBe(true);
    if (matches.success) {
      expect(matches.data).toHaveLength(0);
    }
  });

  it('creates a pass and removes the user from the feed', async () => {
    const viewer = await registerUserAndSeed({
      preferences: { genderFilter: ['female'], ageMin: 20, ageMax: 40 },
    });
    const [candidate] = FeedFactory.generateSampleFeed([
      { name: 'Sara', gender: 'female', age: 30 },
    ]);
    seedUser(candidate);

    const passResponse = await passUser(viewer.token, candidate.id);
    expect(passResponse.statusCode).toBe(200);
    const passPayload = PassResponseSchema.parse(passResponse.json());
    expect(passPayload.result).toMatchObject({
      userId: viewer.id,
      targetUserId: candidate.id,
    });

    const subsequentFeed = await getFeed(viewer.token);
    const payload = FeedResponseSchema.parse(subsequentFeed.json());
    expect(payload.users.map((user) => user.id)).not.toContain(candidate.id);
  });

  it('paginates feed responses with limit and offset', async () => {
    const viewer = await registerUserAndSeed({
      preferences: { genderFilter: ['female', 'male'], ageMin: 18, ageMax: 45 },
    });

    const candidates = FeedFactory.generateSampleFeed([
      { name: 'User 1', gender: 'female', age: 25 },
      { name: 'User 2', gender: 'female', age: 26 },
      { name: 'User 3', gender: 'male', age: 27 },
      { name: 'User 4', gender: 'female', age: 28 },
    ]);
    candidates.forEach(seedUser);

    const pageOne = await getFeed(viewer.token, { limit: 2, offset: 0 });
    const pageOnePayload = FeedResponseSchema.parse(pageOne.json());
    expect(pageOnePayload.users).toHaveLength(2);
    expect(pageOnePayload.pagination.hasMore).toBe(true);

    const pageTwo = await getFeed(viewer.token, { limit: 2, offset: 2 });
    const pageTwoPayload = FeedResponseSchema.parse(pageTwo.json());
    expect(pageTwoPayload.users).toHaveLength(2);
    expect(pageTwoPayload.users).not.toEqual(pageOnePayload.users);
  });

  function seedUser(user: User) {
    userRepository.seed(user);
  }

  async function registerUserAndSeed(
    options: RegisterOptions = {}
  ): Promise<RegisteredUser> {
    const userData = UserFactory.create(options.userOverrides);
    const profileData = ProfileFactory.create(options.profileOverrides);

    const registration = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        ...userData,
        ...profileData,
      },
    });

    expect(registration.statusCode).toBe(201);
    const authPayload = AuthSuccessResponseSchema.parse(registration.json());

    const seedUserData = FeedFactory.createUser({
      ...options.seedOverrides,
      id: authPayload.user.id,
      email: authPayload.user.email,
      name: authPayload.user.name,
      birthDate: options.seedOverrides?.birthDate ?? profileData.birthDate,
      gender: options.seedOverrides?.gender ?? profileData.gender ?? 'female',
    });
    userRepository.seed(seedUserData);

    const basePreferences = PreferencesFactory.create({
      userId: authPayload.user.id,
      ageMin: options.preferences?.ageMin ?? 24,
      ageMax: options.preferences?.ageMax ?? 36,
      genderFilter:
        options.preferences?.genderFilter ??
        resolveGenderFilter(profileData.lookingFor),
      maxDistance: options.preferences?.maxDistance ?? 50,
    });

    const seededPreferences: Preferences = {
      ...basePreferences,
      ...options.preferences,
      userId: authPayload.user.id,
    };
    preferencesRepository.seed(seededPreferences);

    const login = await authenticateUser(app, {
      email: userData.email,
      password: userData.password,
    });

    return {
      id: login.user.id,
      email: userData.email,
      password: userData.password,
      token: login.token,
      profile: profileData,
      domainUser: seedUserData,
    };
  }

  async function getFeed(
    token: string,
    query: { limit?: number; offset?: number } = {}
  ) {
    const params = new URLSearchParams();
    if (typeof query.limit === 'number') {
      params.set('limit', String(query.limit));
    }
    if (typeof query.offset === 'number') {
      params.set('offset', String(query.offset));
    }

    const queryString = params.toString();
    const url = queryString ? `/api/v1/feed?${queryString}` : '/api/v1/feed';

    return app.inject({
      method: 'GET',
      url,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
  }

  async function likeUser(token: string, targetUserId: string) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/likes',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        targetUserId,
      },
    });
  }

  async function passUser(token: string, targetUserId: string) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/passes',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        targetUserId,
      },
    });
  }

  function resolveGenderFilter(lookingFor?: LookingForValue | null): Gender[] {
    if (!lookingFor) {
      return ['male', 'female', 'non_binary'];
    }

    if (lookingFor === 'both') {
      return ['male', 'female', 'non_binary'];
    }

    return [lookingFor as Gender];
  }
});
