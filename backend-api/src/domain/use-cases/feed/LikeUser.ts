import { Like } from '../../entities/Like';
import { Match } from '../../entities/Match';
import { Result, success, failure } from '../../Result';
import { DomainError, ConflictError } from '../../errors/DomainError';
import { LikeRepository } from '../../repositories/LikeRepository';
import { MatchRepository } from '../../repositories/MatchRepository';

export class LikeUser {
  constructor(
    private likeRepository: LikeRepository,
    private matchRepository: MatchRepository
  ) {}

  async execute(userId: string, targetUserId: string): Promise<Result<Like | Match, DomainError>> {
    // Check if already liked
    const hasLikedResult = await this.likeRepository.hasLiked(userId, targetUserId);
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

    // Check if target user has also liked this user (mutual like = match)
    const mutualLikeResult = await this.likeRepository.hasLiked(targetUserId, userId);
    if (isSuccess(mutualLikeResult) && mutualLikeResult.data) {
      // Create match
      const matchResult = await this.matchRepository.create({
        userId1: userId,
        userId2: targetUserId,
      });

      if (isSuccess(matchResult)) {
        return success(matchResult.data);
      }

      if (isFailure(matchResult)) {
        return failure(matchResult.error);
      }
    }

    return success(like);
  }
}

function isSuccess<T, E>(result: Result<T, E>): result is import('../../Result').Success<T> {
  return result.success;
}

function isFailure<T, E>(result: Result<T, E>): result is import('../../Result').Failure<E> {
  return !result.success;
}
