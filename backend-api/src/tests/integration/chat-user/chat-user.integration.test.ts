import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import {
  authenticateUser,
  AuthSuccessResponseSchema,
} from '../auth/authenticate-user';
import { UserFactory } from '../auth/factories/user-factory';
import {
  ProfileFactory,
  type ProfileFactoryAttributes,
} from '../auth/factories/profile-factory';
import { MatchFactory } from './factories/match-factory';
import { createChatUserTestApp } from './test-app';
import { InMemoryMessageRepository } from './in-memory-message-repository';
import type { TestMatchRepository } from '../../unit/helpers/fakeRepositories';
import type { InMemoryAuthService } from '../auth/in-memory-auth-service';
import { MessageSchema } from '../../../domain/entities/Message';
import { GENDER_VALUES, type Gender } from '../../../domain/entities/User';
import {
  LOOKING_FOR_VALUES,
  type LookingForValue,
} from '../../../domain/entities/LookingFor';

type UpdateUserProfileInput = {
  birthDate?: string | null;
  gender?: Gender | null;
  looking_for?: LookingForValue | null;
  min_age?: number | null;
  max_age?: number | null;
  bio?: string | null;
  city?: string | null;
  avatarUrl?: string | null;
  show_bio_in_feed?: boolean | null;
};

type FakeUserProfile = {
  id: string;
  name: string;
  email: string;
  birthDate: string | null;
  gender: Gender | null;
  looking_for: LookingForValue | null;
  min_age: number | null;
  max_age: number | null;
  bio: string | null;
  city: string | null;
  avatarUrl: string | null;
  show_bio_in_feed: boolean | null;
  public_profile_code?: string | null;
  social_profile_interests?: Array<{ code: string; created_at: string }>;
};

class FakeUserService {
  private profiles = new Map<string, FakeUserProfile>();

  reset(): void {
    this.profiles.clear();
  }

  seedProfile(profile: FakeUserProfile): void {
    this.profiles.set(profile.id, {
      ...profile,
      public_profile_code: profile.public_profile_code ?? null,
      social_profile_interests: profile.social_profile_interests ?? [],
    });
  }

  async getProfile(userId: string): Promise<FakeUserProfile> {
    const profile = this.ensureProfile(userId);
    return {
      ...profile,
      public_profile_code: profile.public_profile_code ?? null,
      social_profile_interests: profile.social_profile_interests ?? [],
    };
  }

  async updateProfile(
    userId: string,
    input: UpdateUserProfileInput
  ): Promise<FakeUserProfile> {
    const profile = { ...this.ensureProfile(userId) };

    if ('birthDate' in input) {
      profile.birthDate = input.birthDate ?? null;
    }
    if ('gender' in input) {
      profile.gender = input.gender ?? null;
    }
    if ('looking_for' in input) {
      profile.looking_for = input.looking_for ?? null;
    }
    if ('min_age' in input) {
      profile.min_age = input.min_age ?? null;
    }
    if ('max_age' in input) {
      profile.max_age = input.max_age ?? null;
    }
    if ('bio' in input) {
      profile.bio = input.bio ?? null;
    }
    if ('city' in input) {
      profile.city = input.city ?? null;
    }
    if ('avatarUrl' in input) {
      profile.avatarUrl = input.avatarUrl ?? null;
    }
    if ('show_bio_in_feed' in input) {
      profile.show_bio_in_feed = input.show_bio_in_feed ?? null;
    }

    this.profiles.set(userId, profile);
    return this.getProfile(userId);
  }

  async replaceSocialProfileInterests(
    userId: string,
    codes: string[]
  ): Promise<FakeUserProfile> {
    const profile = { ...this.ensureProfile(userId) };
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of codes) {
      const t = raw.trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t.slice(0, 48));
      if (out.length >= 3) break;
    }
    profile.social_profile_interests = out.map((code) => ({
      code,
      created_at: new Date().toISOString(),
    }));
    this.profiles.set(userId, profile);
    return this.getProfile(userId);
  }

  async uploadAvatar(userId: string): Promise<string> {
    const profile = { ...this.ensureProfile(userId) };
    const avatarUrl = `https://example.com/avatar/${userId}.png`;
    profile.avatarUrl = avatarUrl;
    this.profiles.set(userId, profile);
    return avatarUrl;
  }

  private ensureProfile(userId: string): FakeUserProfile {
    const profile = this.profiles.get(userId);
    if (!profile) {
      throw new Error(`Profile not seeded for user ${userId}`);
    }
    return profile;
  }
}

const userServiceState: { instance: FakeUserService | null } = {
  instance: null,
};

vi.mock('../../../app/services/supabase-user-service', () => {
  return {
    SupabaseUserService: class SupabaseUserServiceMock {
      constructor() {
        const service = new FakeUserService();
        userServiceState.instance = service;
        return service;
      }
    },
  };
});

const SendMessageResponseSchema = z.object({
  message: MessageSchema,
});

const MessagesListResponseSchema = z.object({
  messages: z.array(MessageSchema),
  pagination: z.object({
    limit: z.number(),
    before: z.string().nullable().optional(),
    hasMore: z.boolean(),
  }),
});

const UserProfileResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  birthDate: z.string().nullable(),
  gender: z.enum(GENDER_VALUES).nullable(),
  looking_for: z.enum(LOOKING_FOR_VALUES).nullable(),
  min_age: z.number().nullable(),
  max_age: z.number().nullable(),
  bio: z.string().nullable(),
  city: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  public_profile_code: z.string().nullable().optional(),
  show_bio_in_feed: z.boolean().nullable(),
  social_profile_interests: z
    .array(
      z.object({
        code: z.string(),
        created_at: z.string(),
      })
    )
    .optional(),
});

type RegisteredUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  token: string;
  profile: ProfileFactoryAttributes;
};

let app: FastifyInstance;
let authService: InMemoryAuthService;
let matchRepository: TestMatchRepository;
let messageRepository: InMemoryMessageRepository;
let userService: FakeUserService;

beforeEach(async () => {
  const setup = await createChatUserTestApp();
  app = setup.app;
  authService = setup.authService;
  matchRepository = setup.matchRepository;
  messageRepository = setup.messageRepository;

  authService.reset();
  messageRepository.reset();

  userService = getUserServiceInstance();
  userService.reset();
});

afterEach(async () => {
  await app.close();
});

describe('Chat routes', () => {
  it('creates a message and returns a valid payload', async () => {
    const sender = await registerUser();
    const recipient = await registerUser();
    const match = seedMatch(sender, recipient);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/chats/${match.id}/messages`,
      headers: {
        authorization: `Bearer ${sender.token}`,
      },
      payload: {
        content: 'Hola, que tal?',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = SendMessageResponseSchema.parse(response.json());
    expect(body.message.matchId).toBe(match.id);
    expect(body.message.senderId).toBe(sender.id);
    expect(body.message.content).toBe('Hola, que tal?');
  });

  it('returns chat messages ordered from newest to oldest', async () => {
    const user = await registerUser();
    const partner = await registerUser();
    const match = seedMatch(user, partner);

    const contents = ['Primer mensaje', 'Segundo mensaje', 'Tercer mensaje'];
    for (const content of contents) {
      const post = await app.inject({
        method: 'POST',
        url: `/api/v1/chats/${match.id}/messages`,
        headers: {
          authorization: `Bearer ${user.token}`,
        },
        payload: {
          content,
        },
      });

      expect(post.statusCode).toBe(201);
      await wait(2);
    }

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/chats/${match.id}/messages`,
      headers: {
        authorization: `Bearer ${user.token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = MessagesListResponseSchema.parse(response.json());
    expect(body.messages).toHaveLength(contents.length);
    expect(body.pagination.limit).toBe(50);
    expect(body.pagination.hasMore).toBe(false);
    expect(body.messages.map((message) => message.content)).toEqual(
      [...contents].reverse()
    );

    for (let index = 0; index < body.messages.length - 1; index += 1) {
      const current = body.messages[index];
      const next = body.messages[index + 1];
      expect(
        current.createdAt.localeCompare(next.createdAt)
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns 401 when authorization header is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/chats/${randomUUID()}/messages`,
      payload: {
        content: 'Mensaje sin token',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: 'UNAUTHORIZED',
    });
  });
});

describe('User routes', () => {
  it('returns the authenticated user profile', async () => {
    const user = await registerUser();
    seedProfile(user);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: {
        authorization: `Bearer ${user.token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const profile = UserProfileResponseSchema.parse(response.json());
    expect(profile.id).toBe(user.id);
    expect(profile.email).toBe(user.email);
    expect(profile.name).toBe(user.name);
  });

  it('updates the profile fields and returns the new data', async () => {
    const user = await registerUser();
    seedProfile(user);

    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/users/me',
      headers: {
        authorization: `Bearer ${user.token}`,
      },
      payload: {
        bio: 'Apasionado por la escalada y el cafe.',
        city: 'Lisboa',
        avatarUrl: 'https://static.example.com/avatars/profile.png',
      },
    });

    expect(response.statusCode).toBe(200);
    const profile = UserProfileResponseSchema.parse(response.json());
    expect(profile.bio).toBe('Apasionado por la escalada y el cafe.');
    expect(profile.city).toBe('Lisboa');
    expect(profile.avatarUrl).toBe(
      'https://static.example.com/avatars/profile.png'
    );
  });
});

function getUserServiceInstance(): FakeUserService {
  if (!userServiceState.instance) {
    throw new Error('FakeUserService was not initialised');
  }
  return userServiceState.instance;
}

async function registerUser(): Promise<RegisteredUser> {
  const userData = UserFactory.create();
  const profileData = ProfileFactory.create();

  const registration = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      ...userData,
      ...profileData,
    },
  });

  expect(registration.statusCode).toBe(201);
  const registrationPayload = AuthSuccessResponseSchema.parse(
    registration.json()
  );

  const login = await authenticateUser(app, {
    email: userData.email,
    password: userData.password,
  });

  return {
    id: registrationPayload.user.id,
    name: registrationPayload.user.name,
    email: registrationPayload.user.email,
    password: userData.password,
    token: login.token,
    profile: profileData,
  };
}

function seedMatch(userA: RegisteredUser, userB: RegisteredUser) {
  const domainMatch = MatchFactory.toDomain(
    MatchFactory.create({
      userId1: userA.id,
      userId2: userB.id,
    })
  );
  matchRepository.seedMatch(domainMatch);
  return domainMatch;
}

function seedProfile(
  user: RegisteredUser,
  overrides: Partial<FakeUserProfile> = {}
) {
  const profileData = user.profile;

  userService.seedProfile({
    id: user.id,
    name: user.name,
    email: user.email,
    birthDate: profileData.birthDate ?? null,
    gender: profileData.gender ?? null,
    looking_for: profileData.lookingFor ?? null,
    min_age: null,
    max_age: null,
    bio: null,
    city: profileData.location ?? null,
    avatarUrl: null,
    show_bio_in_feed: null,
    public_profile_code: 'testuser042',
    social_profile_interests: [],
    ...overrides,
  });
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
