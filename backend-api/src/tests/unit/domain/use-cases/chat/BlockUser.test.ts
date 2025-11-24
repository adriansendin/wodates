import { beforeEach, describe, expect, it } from 'vitest';
import { BlockUser } from '../../../../../domain/use-cases/chat/BlockUser';
import {
  TestBlockedUserRepository,
  TestMatchRepository,
} from '../../../helpers/fakeRepositories';
import { InternalError } from '../../../../../domain/errors/DomainError';

const MATCH_USER_A = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const MATCH_USER_B = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const STRANGER = '99999999-9999-9999-9999-999999999999';

describe('BlockUser use case', () => {
  let blockedRepository: TestBlockedUserRepository;
  let matchRepository: TestMatchRepository;
  let useCase: BlockUser;

  beforeEach(() => {
    blockedRepository = new TestBlockedUserRepository();
    matchRepository = new TestMatchRepository();
    useCase = new BlockUser(blockedRepository, matchRepository);
  });

  it('forbids blocking yourself', async () => {
    const result = await useCase.execute(
      MATCH_USER_A,
      MATCH_USER_A,
      '11111111-1111-1111-1111-111111111111'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
      expect(result.error.message).toBe('Cannot block yourself');
    }
  });

  it('returns CONFLICT when the user is already blocked', async () => {
    const matchResult = await matchRepository.create({
      userId1: MATCH_USER_A,
      userId2: MATCH_USER_B,
    });
    expect(matchResult.success).toBe(true);
    if (!matchResult.success) {
      throw new Error('Expected match creation to succeed');
    }

    await useCase.execute(MATCH_USER_A, MATCH_USER_B, matchResult.data.id);
    const duplicate = await useCase.execute(
      MATCH_USER_A,
      MATCH_USER_B,
      matchResult.data.id
    );

    expect(duplicate.success).toBe(false);
    if (!duplicate.success) {
      expect(duplicate.error.code).toBe('CONFLICT');
    }
  });

  it('returns FORBIDDEN when the match does not exist', async () => {
    const result = await useCase.execute(
      MATCH_USER_A,
      MATCH_USER_B,
      '22222222-2222-2222-2222-222222222222'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
      expect(result.error.message).toBe('Match not found');
    }
  });

  it('returns FORBIDDEN when the blocker is not part of the match', async () => {
    const matchResult = await matchRepository.create({
      userId1: MATCH_USER_A,
      userId2: MATCH_USER_B,
    });
    expect(matchResult.success).toBe(true);
    if (!matchResult.success) {
      throw new Error('Expected match creation to succeed');
    }

    const result = await useCase.execute(
      STRANGER,
      MATCH_USER_B,
      matchResult.data.id
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
      expect(result.error.message).toBe('User is not part of this match');
    }
  });

  it('returns FORBIDDEN when the target user is not part of the match', async () => {
    const matchResult = await matchRepository.create({
      userId1: MATCH_USER_A,
      userId2: MATCH_USER_B,
    });
    expect(matchResult.success).toBe(true);
    if (!matchResult.success) {
      throw new Error('Expected match creation to succeed');
    }

    const result = await useCase.execute(
      MATCH_USER_A,
      STRANGER,
      matchResult.data.id
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
      expect(result.error.message).toBe(
        'Target user is not part of this match'
      );
    }
  });

  it('creates the block when validations pass', async () => {
    const matchResult = await matchRepository.create({
      userId1: MATCH_USER_A,
      userId2: MATCH_USER_B,
    });
    expect(matchResult.success).toBe(true);
    if (!matchResult.success) {
      throw new Error('Expected match creation to succeed');
    }

    const result = await useCase.execute(
      MATCH_USER_A,
      MATCH_USER_B,
      matchResult.data.id
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        blockerId: MATCH_USER_A,
        blockedId: MATCH_USER_B,
      });
    }
  });

  it('propagates repository errors when block creation fails', async () => {
    const matchResult = await matchRepository.create({
      userId1: MATCH_USER_A,
      userId2: MATCH_USER_B,
    });
    expect(matchResult.success).toBe(true);
    if (!matchResult.success) {
      throw new Error('Expected match creation to succeed');
    }

    blockedRepository.setCreateError(new InternalError('block failed'));

    const result = await useCase.execute(
      MATCH_USER_A,
      MATCH_USER_B,
      matchResult.data.id
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INTERNAL_ERROR');
      expect(result.error.message).toBe('block failed');
    }
  });
});
