import { Message } from '../../entities/Message';
import { Result, success, failure } from '../../Result';
import { DomainError, NotFoundError, ForbiddenError } from '../../errors/DomainError';
import { MessageRepository } from '../../repositories/MessageRepository';
import { MatchRepository } from '../../repositories/MatchRepository';

export class SendMessage {
  constructor(
    private messageRepository: MessageRepository,
    private matchRepository: MatchRepository
  ) {}

  async execute(
    matchId: string,
    senderId: string,
    content: string
  ): Promise<Result<Message, DomainError>> {
    // Verify match exists and user is part of it
    const matchResult = await this.matchRepository.findById(matchId);
    if (isFailure(matchResult)) {
      return failure(new NotFoundError('Match not found'));
    }

    const match = matchResult.data;
    if (match.userId1 !== senderId && match.userId2 !== senderId) {
      return failure(new ForbiddenError('User is not part of this match'));
    }

    // Create message
    const messageResult = await this.messageRepository.create({
      matchId,
      senderId,
      content,
    });

    if (isFailure(messageResult)) {
      return messageResult;
    }

    return success(messageResult.data);
  }
}

function isFailure<T, E>(result: Result<T, E>): result is import('../../Result').Failure<E> {
  return !result.success;
}
