import { BlockedUser, CreateBlockedUser } from '../entities/BlockedUser';
import { Result } from '../Result';
import { DomainError } from '../errors/DomainError';

export interface BlockedUserRepository {
  /**
   * Creates a block relationship between two users
   */
  create(
    blockedUser: CreateBlockedUser
  ): Promise<Result<BlockedUser, DomainError>>;

  /**
   * Checks if user A has blocked user B
   */
  hasBlocked(
    blockerId: string,
    blockedId: string
  ): Promise<Result<boolean, DomainError>>;

  /**
   * Checks if there's any block between two users (bidirectional)
   */
  isBlocked(
    userId1: string,
    userId2: string
  ): Promise<Result<boolean, DomainError>>;

  /**
   * Gets all users blocked by a specific user
   */
  getBlockedByUser(userId: string): Promise<Result<BlockedUser[], DomainError>>;

  /**
   * Deletes a block (unblock functionality)
   */
  delete(
    blockerId: string,
    blockedId: string
  ): Promise<Result<void, DomainError>>;
}
