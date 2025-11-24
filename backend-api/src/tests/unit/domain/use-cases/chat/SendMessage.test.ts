import { beforeEach, describe, expect, it } from 'vitest';
import { SendMessage } from '../../../../../domain/use-cases/chat/SendMessage';
import {
  TestMatchRepository,
  TestMessageRepository,
} from '../../../helpers/fakeRepositories';
import { InternalError } from '../../../../../domain/errors/DomainError';

const MATCH_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_A = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const USER_B = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const STRANGER = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

describe('SendMessage use case', () => {
  let matchRepository: TestMatchRepository;
  let messageRepository: TestMessageRepository;
  let useCase: SendMessage;

  beforeEach(() => {
    matchRepository = new TestMatchRepository();
    messageRepository = new TestMessageRepository();
    useCase = new SendMessage(messageRepository, matchRepository);
  });

  it('persists the message when the sender belongs to the match', async () => {
    const matchResult = await matchRepository.create({
      userId1: USER_A,
      userId2: USER_B,
    });
    expect(matchResult.success).toBe(true);
    if (!matchResult.success) {
      throw new Error('Expected match creation to succeed');
    }

    const result = await useCase.execute(
      matchResult.data.id,
      USER_A,
      'Hey there!'
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        matchId: matchResult.data.id,
        senderId: USER_A,
        content: 'Hey there!',
      });
    }
  });

  it('returns NOT_FOUND when the match does not exist', async () => {
    const result = await useCase.execute(MATCH_ID, USER_A, 'Is anyone there?');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.message).toBe('Match not found');
    }
  });

  it('returns FORBIDDEN when the sender is not part of the match', async () => {
    const matchResult = await matchRepository.create({
      userId1: USER_A,
      userId2: USER_B,
    });
    expect(matchResult.success).toBe(true);
    if (!matchResult.success) {
      throw new Error('Expected match creation to succeed');
    }

    const result = await useCase.execute(
      matchResult.data.id,
      STRANGER,
      'I should not be here'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('propagates repository errors when message creation fails', async () => {
    const matchResult = await matchRepository.create({
      userId1: USER_A,
      userId2: USER_B,
    });
    expect(matchResult.success).toBe(true);
    if (!matchResult.success) {
      throw new Error('Expected match creation to succeed');
    }

    messageRepository.setCreateError(new InternalError('write failed'));

    const result = await useCase.execute(
      matchResult.data.id,
      USER_B,
      'This will fail'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INTERNAL_ERROR');
      expect(result.error.message).toBe('write failed');
    }
  });
});
