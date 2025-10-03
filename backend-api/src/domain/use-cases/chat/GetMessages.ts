import { Message } from '../../entities/Message';
import { Result, success, failure } from '../../Result';
import { DomainError, NotFoundError, ForbiddenError } from '../../errors/DomainError';
import { MessageRepository } from '../../repositories/MessageRepository';
import { MatchRepository } from '../../repositories/MatchRepository';

export class GetMessages {
  constructor(
    private messageRepository: MessageRepository,
    private matchRepository: MatchRepository
  ) {}

  async execute(
    matchId: string,
    userId: string,
    limit: number = 50,
    before?: string
  ): Promise<Result<Message[], DomainError>> {
    // Verify match exists and user is part of it
    const matchResult = await this.matchRepository.findById(matchId);
    if (isFailure(matchResult)) {
      return failure(new NotFoundError('Match not found'));
    }

    const match = matchResult.data;
    if (match.userId1 !== userId && match.userId2 !== userId) {
      return failure(new ForbiddenError('User is not part of this match'));
    }

    // Get messages
    const messagesResult = await this.messageRepository.findByMatchId(matchId, limit, before);
    if (isFailure(messagesResult)) {
      return messagesResult;
    }

    return success(messagesResult.data);
  }
}

function isFailure<T, E>(result: Result<T, E>): result is import('../../Result').Failure<E> {
  return !result.success;
}
