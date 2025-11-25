import { Message } from '../../entities/Message';
import { Result, success, failure } from '../../Result';
import {
  DomainError,
  NotFoundError,
  ForbiddenError,
} from '../../errors/DomainError';
import { MessageRepository } from '../../repositories/MessageRepository';
import { MatchRepository } from '../../repositories/MatchRepository';

/**
 * GetUnprocessedMessages - Gets unprocessed messages for a match
 *
 * Reuses the validation logic from GetMessages but fetches only
 * messages where profile_processed_at IS NULL, ordered chronologically.
 */
export class GetUnprocessedMessages {
  constructor(
    private messageRepository: MessageRepository,
    private matchRepository: MatchRepository
  ) {}

  async execute(
    matchId: string,
    userId: string
  ): Promise<Result<Message[], DomainError>> {
    // Verify match exists and user is part of it (reused from GetMessages)
    const matchResult = await this.matchRepository.findById(matchId);
    if (isFailure(matchResult)) {
      return failure(new NotFoundError('Match not found'));
    }

    const match = matchResult.data;
    if (match.userId1 !== userId && match.userId2 !== userId) {
      return failure(new ForbiddenError('User is not part of this match'));
    }

    // Get unprocessed messages (ordered chronologically, no limit)
    const messagesResult =
      await this.messageRepository.findUnprocessedByMatchId(matchId);
    if (isFailure(messagesResult)) {
      return messagesResult;
    }

    return success(messagesResult.data);
  }
}

function isFailure<T, E>(
  result: Result<T, E>
): result is import('../../Result').Failure<E> {
  return !result.success;
}
