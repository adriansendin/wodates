import { Result } from '../Result';
import { DomainError } from '../errors/DomainError';
import {
  UserAIProfile,
  CreateUserAIProfile,
  UpdateUserAIProfile,
} from '../entities/UserAIProfile';

/**
 * Repository interface for user AI profiles
 *
 * Manages AI-generated personality summaries and embeddings for users.
 * 1:1 relationship with users table.
 */
export interface UserAIProfileRepository {
  /**
   * Creates a new AI profile for a user
   */
  create(
    profile: CreateUserAIProfile
  ): Promise<Result<UserAIProfile, DomainError>>;

  /**
   * Finds an AI profile by user ID
   */
  findByUserId(
    userId: string
  ): Promise<Result<UserAIProfile | null, DomainError>>;

  /**
   * Updates an existing AI profile
   */
  update(
    userId: string,
    update: UpdateUserAIProfile
  ): Promise<Result<UserAIProfile, DomainError>>;

  /**
   * Upserts (creates or updates) an AI profile
   */
  upsert(
    profile: CreateUserAIProfile
  ): Promise<Result<UserAIProfile, DomainError>>;
}
