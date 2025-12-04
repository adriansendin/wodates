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
   * Finds the first unprocessed message for a user in a match, then returns all messages
   * from that point forward (including messages from both users, processed or not).
   * This ensures the LLM has full context of the conversation from the user's first
   * unprocessed message onwards.
   *
   * @param matchId - The match/chat ID
   * @param userId - The user ID to find the first unprocessed message for
   * @returns All messages from the first unprocessed message of the user onwards, ordered chronologically
   */
  findChatFromFirstUnprocessedMessage(
    matchId: string,
    userId: string
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
