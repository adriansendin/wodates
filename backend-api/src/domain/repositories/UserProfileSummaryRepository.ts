import { Result } from '../Result';
import { DomainError } from '../errors/DomainError';
import {
  UserProfileSummary,
  CreateUserProfileSummary,
  UpdateUserProfileSummary,
} from '../entities/UserProfileSummary';

/**
 * Repository interface for user profile summaries
 */
export interface UserProfileSummaryRepository {
  /**
   * Creates a new profile summary for a user
   */
  create(
    summary: CreateUserProfileSummary,
  ): Promise<Result<UserProfileSummary, DomainError>>;

  /**
   * Finds a profile summary by user ID
   */
  findByUserId(userId: string): Promise<Result<UserProfileSummary | null, DomainError>>;

  /**
   * Updates an existing profile summary
   */
  update(
    userId: string,
    update: UpdateUserProfileSummary,
  ): Promise<Result<UserProfileSummary, DomainError>>;

  /**
   * Upserts (creates or updates) a profile summary
   */
  upsert(
    summary: CreateUserProfileSummary,
  ): Promise<Result<UserProfileSummary, DomainError>>;
}

