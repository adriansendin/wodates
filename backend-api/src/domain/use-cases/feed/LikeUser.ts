import { Like } from '../../entities/Like';
import { Match } from '../../entities/Match';
import { Result, success, failure } from '../../Result';
import { DomainError, ConflictError } from '../../errors/DomainError';
import { LikeRepository } from '../../repositories/LikeRepository';
import { MatchRepository } from '../../repositories/MatchRepository';

export type LikeResult =
  | Like
  | Match
  | (Like & { isPotentialMatch: true; targetUserId: string });

export class LikeUser {
  constructor(
    private likeRepository: LikeRepository,
    private matchRepository: MatchRepository
  ) {}

  async execute(
    userId: string,
    targetUserId: string
  ): Promise<Result<LikeResult, DomainError>> {
    // Check if already liked
    const hasLikedResult = await this.likeRepository.hasLiked(
      userId,
      targetUserId
    );
    if (isSuccess(hasLikedResult) && hasLikedResult.data) {
      return failure(new ConflictError('User already liked'));
    }

    // Create like
    const likeResult = await this.likeRepository.create({
      userId,
      targetUserId,
    });

    if (isFailure(likeResult)) {
      return likeResult;
    }

    const like = likeResult.data;

    // Check if target user has also liked this user (mutual like = potential match)
    // NOTE: We don't create the match automatically anymore. The user must confirm.
    // Return a special "potential match" indicator that the frontend can use to show confirmation modal.
    const mutualLikeResult = await this.likeRepository.hasLiked(
      targetUserId,
      userId
    );
    if (isSuccess(mutualLikeResult) && mutualLikeResult.data) {
      // Check if both users have no active chats before allowing match confirmation
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

      // Return a special indicator that there's a potential match
      // The frontend will show a confirmation modal, and only then will we create the match
      // We return the like but with a flag indicating potential match
      return success({
        ...like,
        isPotentialMatch: true as const,
        targetUserId: targetUserId,
      } as Like & { isPotentialMatch: true; targetUserId: string });
    }

    return success(like);
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
