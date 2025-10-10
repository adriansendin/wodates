import { describe, it, expect, beforeEach } from 'vitest';
import { SendMessage } from '../domain/use-cases/chat/SendMessage';
import {
  TestMatchRepository,
  TestMessageRepository,
} from './helpers/fakeRepositories';

describe('SendMessage', () => {
  let sendMessage: SendMessage;
  let messageRepository: TestMessageRepository;
  let matchRepository: TestMatchRepository;

  beforeEach(() => {
    messageRepository = new TestMessageRepository();
    matchRepository = new TestMatchRepository();
    sendMessage = new SendMessage(messageRepository, matchRepository);
  });

  it('should send a message successfully', async () => {
    // Create a match first
    const matchResult = await matchRepository.create({
      userId1: 'user-1',
      userId2: 'user-2',
    });
    
    expect(matchResult.success).toBe(true);
    if (!matchResult.success) return;

    const matchId = matchResult.data.id;
    const senderId = 'user-1';
    const content = 'Hello there!';

    const result = await sendMessage.execute(matchId, senderId, content);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('matchId', matchId);
      expect(result.data).toHaveProperty('senderId', senderId);
      expect(result.data).toHaveProperty('content', content);
    }
  });

  it('should fail when match does not exist', async () => {
    const matchId = 'non-existent-match';
    const senderId = 'user-1';
    const content = 'Hello there!';

    const result = await sendMessage.execute(matchId, senderId, content);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('should fail when user is not part of the match', async () => {
    // Create a match
    const matchResult = await matchRepository.create({
      userId1: 'user-1',
      userId2: 'user-2',
    });
    
    expect(matchResult.success).toBe(true);
    if (!matchResult.success) return;

    const matchId = matchResult.data.id;
    const senderId = 'user-3'; // Not part of the match
    const content = 'Hello there!';

    const result = await sendMessage.execute(matchId, senderId, content);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });
});
