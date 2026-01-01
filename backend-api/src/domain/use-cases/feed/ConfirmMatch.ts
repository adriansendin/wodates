import { Match } from '../../entities/Match';
import { Result, success, failure } from '../../Result';
import { DomainError, ConflictError, ForbiddenError } from '../../errors/DomainError';
import { LikeRepository } from '../../repositories/LikeRepository';
import { MatchRepository } from '../../repositories/MatchRepository';

export class ConfirmMatch {
  constructor(
    private likeRepository: LikeRepository,
    private matchRepository: MatchRepository
  ) {}

  async execute(
    userId: string,
    targetUserId: string
  ): Promise<Result<Match, DomainError>> {
    // Verify that both users have liked each other
    const userLikedTarget = await this.likeRepository.hasLiked(userId, targetUserId);
    if (isFailure(userLikedTarget) || !userLikedTarget.data) {
      return failure(
        new ForbiddenError('You must like the user before confirming a match')
      );
    }

    const targetLikedUser = await this.likeRepository.hasLiked(targetUserId, userId);
    if (isFailure(targetLikedUser) || !targetLikedUser.data) {
      return failure(
        new ForbiddenError('The other user must also like you to create a match')
      );
    }

    // Check if match already exists
    const existingMatchResult = await this.matchRepository.getMatchBetween(
      userId,
      targetUserId
    );
    if (isFailure(existingMatchResult)) {
      return failure(existingMatchResult.error);
    }
    if (existingMatchResult.data) {
      return success(existingMatchResult.data);
    }

    // Check if both users have no active chats before creating match
    const activeChatsCounts = await this.matchRepository.getActiveChatsCount([
      userId,
      targetUserId,
    ]);

    const userActiveChats = activeChatsCounts.get(userId) ?? 0;
    const targetUserActiveChats = activeChatsCounts.get(targetUserId) ?? 0;

    if (userActiveChats >= 1) {
      return failure(
        new ConflictError(
          'You have reached the maximum number of active chats (0)'
        )
      );
    }

    if (targetUserActiveChats >= 1) {
      return failure(
        new ConflictError(
          'This user has reached the maximum number of active chats (0)'
        )
      );
    }

    // Create match
    const matchResult = await this.matchRepository.create({
      userId1: userId,
      userId2: targetUserId,
    });

    if (isFailure(matchResult)) {
      return failure(matchResult.error);
    }

    return success(matchResult.data);
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

