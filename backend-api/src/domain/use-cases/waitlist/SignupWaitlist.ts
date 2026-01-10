import { CreateWaitlistSignup, WaitlistSignup } from '../../entities/WaitlistSignup';
import { Result, success, failure } from '../../Result';
import { DomainError } from '../../errors/DomainError';
import { WaitlistRepository } from '../../repositories/WaitlistRepository';

export class SignupWaitlist {
  constructor(private waitlistRepository: WaitlistRepository) {}

  async execute(
    signup: CreateWaitlistSignup
  ): Promise<Result<{ signup: WaitlistSignup; alreadyExisted: boolean }, DomainError>> {
    return this.waitlistRepository.createOrGet(signup);
  }
}
