import { Result } from '../Result';
import { DomainError } from '../errors/DomainError';

/**
 * Domain interface for generating affinity sentences between two users
 * 
 * This interface belongs to the domain layer and defines the contract
 * for generating affinity sentences without depending on concrete implementations.
 */
export interface AffinitySentenceGenerator {
  /**
   * Generates a single affinity sentence for two users
   * 
   * @param userId1 - First user ID
   * @param userId2 - Second user ID
   * @returns Result containing the affinity sentence (or fallback if generation fails)
   */
  generateAffinitySentence(
    userId1: string,
    userId2: string
  ): Promise<Result<string, DomainError>>;
}
