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
 * GetUnprocessedMessages - Gets chat messages from the first unprocessed message of a user
 *
 * This use case:
 * 1. Validates that the match exists and user is part of it
 * 2. Finds the first unprocessed message for the user in the match
 * 3. Returns all messages from that point forward (including messages from both users,
 *    processed or not) to provide full context for the LLM
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

    // Get all messages from the first unprocessed message of the user onwards
    // This includes messages from both users (processed or not) for full context
    const messagesResult =
      await this.messageRepository.findChatFromFirstUnprocessedMessage(
        matchId,
        userId
      );
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
