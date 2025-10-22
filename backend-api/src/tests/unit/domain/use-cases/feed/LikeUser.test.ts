import { beforeEach, describe, expect, it } from 'vitest';
import { LikeUser } from '../../../../../domain/use-cases/feed/LikeUser';
import {
  TestLikeRepository,
  TestMatchRepository,
} from '../../../helpers/fakeRepositories';
import { InternalError } from '../../../../../domain/errors/DomainError';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

describe('LikeUser use case', () => {
  let likeRepository: TestLikeRepository;
  let matchRepository: TestMatchRepository;
  let useCase: LikeUser;

  beforeEach(() => {
    likeRepository = new TestLikeRepository();
    matchRepository = new TestMatchRepository();
    useCase = new LikeUser(likeRepository, matchRepository);
  });

  it('returns the created like when user has not liked target', async () => {
    const result = await useCase.execute(USER_A, USER_B);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        userId: USER_A,
        targetUserId: USER_B,
      });
    }
  });

  it('fails with CONFLICT when the user already liked the target', async () => {
    await useCase.execute(USER_A, USER_B);

    const duplicate = await useCase.execute(USER_A, USER_B);

    expect(duplicate.success).toBe(false);
    if (!duplicate.success) {
      expect(duplicate.error.code).toBe('CONFLICT');
    }
  });

  it('creates a match when both users like each other', async () => {
    await useCase.execute(USER_A, USER_B);

    const mutual = await useCase.execute(USER_B, USER_A);

    expect(mutual.success).toBe(true);
    if (mutual.success) {
      expect('userId1' in mutual.data && 'userId2' in mutual.data).toBe(true);
      if ('userId1' in mutual.data && 'userId2' in mutual.data) {
        expect([mutual.data.userId1, mutual.data.userId2]).toEqual(
          expect.arrayContaining([USER_A, USER_B]),
        );
      }
    }
  });

  it('propagates repository errors when creating the like fails', async () => {
    likeRepository.setCreateError(new InternalError('unable to persist like'));

    const result = await useCase.execute(USER_A, USER_B);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INTERNAL_ERROR');
      expect(result.error.message).toBe('unable to persist like');
    }
  });

  it('propagates errors when match creation fails after mutual likes', async () => {
    await useCase.execute(USER_A, USER_B);
    matchRepository.setCreateError(new InternalError('match creation failed'));

    const result = await useCase.execute(USER_B, USER_A);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe('match creation failed');
    }
  });
});

