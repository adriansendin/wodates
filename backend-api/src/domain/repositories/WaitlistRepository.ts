import {
  WaitlistSignup,
  CreateWaitlistSignup,
} from '../entities/WaitlistSignup';
import { Result } from '../Result';
import { DomainError } from '../errors/DomainError';

export interface WaitlistRepository {
  /**
   * Creates a new waitlist signup or returns existing one if already exists.
   * @returns Result with signup data and a flag indicating if it already existed
   */
  createOrGet(
    signup: CreateWaitlistSignup
  ): Promise<
    Result<{ signup: WaitlistSignup; alreadyExisted: boolean }, DomainError>
  >;
}
