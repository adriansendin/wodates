import { Result } from '../../Result';
import { DomainError } from '../../errors/DomainError';
import type { DeepOnboardingFormPublic } from '../../entities/DeepOnboarding';
import type { DeepOnboardingRepository } from '../../repositories/DeepOnboardingRepository';

export class GetDeepOnboardingForm {
  constructor(private readonly repository: DeepOnboardingRepository) {}

  async execute(): Promise<Result<DeepOnboardingFormPublic, DomainError>> {
    return this.repository.getForm();
  }
}
