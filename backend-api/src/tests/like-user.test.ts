import { describe, it, expect, beforeEach } from 'vitest';
import { LikeUser } from '../domain/use-cases/feed/LikeUser';
import { InMemoryLikeRepository } from '../data/repositories/InMemoryLikeRepository';
import { InMemoryMatchRepository } from '../data/repositories/InMemoryMatchRepository';

describe('LikeUser', () => {
  let likeUser: LikeUser;
  let likeRepository: InMemoryLikeRepository;
  let matchRepository: InMemoryMatchRepository;

  beforeEach(() => {
    likeRepository = new InMemoryLikeRepository();
    matchRepository = new InMemoryMatchRepository();
    likeUser = new LikeUser(likeRepository, matchRepository);
  });

  it('should create a like successfully', async () => {
    const userId = 'user-1';
    const targetUserId = 'user-2';

    const result = await likeUser.execute(userId, targetUserId);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('userId', userId);
      expect(result.data).toHaveProperty('targetUserId', targetUserId);
    }
  });

  it('should create a match when both users like each other', async () => {
    const userId1 = 'user-1';
    const userId2 = 'user-2';

    // First user likes second user
    const likeResult1 = await likeUser.execute(userId1, userId2);
    expect(likeResult1.success).toBe(true);

    // Second user likes first user (should create match)
    const likeResult2 = await likeUser.execute(userId2, userId1);
    expect(likeResult2.success).toBe(true);
    
    if (likeResult2.success) {
      // Should be a match, not just a like
      expect(likeResult2.data).toHaveProperty('userId1');
      expect(likeResult2.data).toHaveProperty('userId2');
    }
  });

  it('should not create duplicate likes', async () => {
    const userId = 'user-1';
    const targetUserId = 'user-2';

    // First like should succeed
    const result1 = await likeUser.execute(userId, targetUserId);
    expect(result1.success).toBe(true);

    // Second like should fail
    const result2 = await likeUser.execute(userId, targetUserId);
    expect(result2.success).toBe(false);
    if (!result2.success) {
      expect(result2.error.code).toBe('CONFLICT');
    }
  });
});
