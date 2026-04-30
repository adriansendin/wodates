import type { DeepOnboardingUserSessionHydration } from '../../entities/DeepOnboardingHydration';
import { Result } from '../../Result';
import { DomainError } from '../../errors/DomainError';
import type { DeepOnboardingRepository } from '../../repositories/DeepOnboardingRepository';

export class GetLatestDeepOnboardingSessionForUser {
  constructor(private readonly repository: DeepOnboardingRepository) {}

  async execute(
    userId: string
  ): Promise<Result<DeepOnboardingUserSessionHydration, DomainError>> {
    return this.repository.getLatestSessionHydrationForUser(userId);
  }
}
