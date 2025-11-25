import { Message, CreateMessage } from '../entities/Message';
import { Result } from '../Result';
import { DomainError } from '../errors/DomainError';

export interface MessageRepository {
  create(message: CreateMessage): Promise<Result<Message, DomainError>>;
  findByMatchId(
    matchId: string,
    limit: number,
    before?: string
  ): Promise<Result<Message[], DomainError>>;
  findById(id: string): Promise<Result<Message, DomainError>>;
  /**
   * Finds unprocessed messages (where profile_processed_at is NULL) for a user
   */
  findUnprocessedBySenderId(
    senderId: string,
    limit?: number
  ): Promise<Result<Message[], DomainError>>;
  /**
   * Finds unprocessed messages (where profile_processed_at is NULL) for a specific match/chat
   * Returns all unprocessed messages ordered by created_at ascending (chronological order)
   */
  findUnprocessedByMatchId(
    matchId: string
  ): Promise<Result<Message[], DomainError>>;
  /**
   * Marks a message as processed by setting profile_processed_at
   */
  markAsProcessed(messageId: string): Promise<Result<void, DomainError>>;
  /**
   * Marks multiple messages as processed
   */
  markManyAsProcessed(messageIds: string[]): Promise<Result<void, DomainError>>;
}
