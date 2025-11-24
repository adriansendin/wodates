import { BlockedUser } from '../../entities/BlockedUser';
import { Result, success, failure } from '../../Result';
import {
  DomainError,
  ConflictError,
  ForbiddenError,
} from '../../errors/DomainError';
import { BlockedUserRepository } from '../../repositories/BlockedUserRepository';
import { MatchRepository } from '../../repositories/MatchRepository';

/**
 * BlockUser use case
 *
 * Blocks a user. The match remains in the database but is hidden from both users.
 * Once blocked, users cannot see each other in their matches list or communicate.
 * The match and all messages are preserved and can be restored if the block is removed.
 */
export class BlockUser {
  constructor(
    private blockedUserRepository: BlockedUserRepository,
    private matchRepository: MatchRepository
  ) {}

  async execute(
    blockerId: string,
    blockedId: string,
    matchId: string
  ): Promise<Result<BlockedUser, DomainError>> {
    // Prevent self-blocking
    if (blockerId === blockedId) {
      return failure(new ForbiddenError('Cannot block yourself'));
    }

    // Check if already blocked
    const hasBlockedResult = await this.blockedUserRepository.hasBlocked(
      blockerId,
      blockedId
    );
    if (isSuccess(hasBlockedResult) && hasBlockedResult.data) {
      return failure(new ConflictError('User already blocked'));
    }

    // Verify match exists and user is part of it
    const matchResult = await this.matchRepository.findById(matchId);
    if (isFailure(matchResult)) {
      return failure(new ForbiddenError('Match not found'));
    }

    const match = matchResult.data;
    if (match.userId1 !== blockerId && match.userId2 !== blockerId) {
      return failure(new ForbiddenError('User is not part of this match'));
    }

    if (match.userId1 !== blockedId && match.userId2 !== blockedId) {
      return failure(
        new ForbiddenError('Target user is not part of this match')
      );
    }

    // Create block
    const blockResult = await this.blockedUserRepository.create({
      blockerId,
      blockedId,
    });

    if (isFailure(blockResult)) {
      return blockResult;
    }

    // Update active_chats_count for both users (blocked chat no longer counts as active)
    await this.matchRepository.updateActiveChatsCountForUsers([
      blockerId,
      blockedId,
    ]);

    // The match is preserved in the database but will be filtered out
    // by the match-overview-service based on the blocked_users table

    return success(blockResult.data);
  }
}

function isSuccess<T, E>(
  result: Result<T, E>
): result is import('../../Result').Success<T> {
  return result.success;
}

function isFailure<T, E>(
  result: Result<T, E>
): result is import('../../Result').Failure<E> {
  return !result.success;
}
