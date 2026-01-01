import { Match, CreateMatch } from '../entities/Match';
import { Result } from '../Result';
import { DomainError } from '../errors/DomainError';

export interface MatchRepository {
  create(match: CreateMatch): Promise<Result<Match, DomainError>>;
  findByUserId(userId: string): Promise<Result<Match[], DomainError>>;
  findById(id: string): Promise<Result<Match, DomainError>>;
  existsBetweenUsers(
    userId1: string,
    userId2: string
  ): Promise<Result<boolean, DomainError>>;
  getMatchBetween(
    userId1: string,
    userId2: string
  ): Promise<Result<Match | null, DomainError>>;
  delete(matchId: string): Promise<Result<void, DomainError>>;
  updateActiveChatsCountForUsers(userIds: string[]): Promise<void>;
  getActiveChatsCount(userIds: string[]): Promise<Map<string, number>>;
  /**
   * Updates the last_read_message_id for a user in a chat/match
   * @param chatId - The chat/match ID
   * @param userId - The user ID
   * @param messageId - The ID of the last read message (null to clear)
   */
  updateLastReadMessage(
    chatId: string,
    userId: string,
    messageId: string | null
  ): Promise<Result<void, DomainError>>;
  /**
   * Gets the last_read_message_id for a user in a chat/match
   * @param chatId - The chat/match ID
   * @param userId - The user ID
   */
  getLastReadMessageId(
    chatId: string,
    userId: string
  ): Promise<Result<string | null, DomainError>>;
}
