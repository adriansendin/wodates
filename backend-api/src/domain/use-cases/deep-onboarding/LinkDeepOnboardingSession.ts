import { Result, failure } from '../../Result';
import { ValidationError, DomainError } from '../../errors/DomainError';
import type { DeepOnboardingRepository } from '../../repositories/DeepOnboardingRepository';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class LinkDeepOnboardingSession {
  constructor(private readonly repository: DeepOnboardingRepository) {}

  async execute(
    userId: string,
    clientSessionId: string
  ): Promise<Result<{ linked: boolean }, DomainError>> {
    if (!UUID_REGEX.test(userId)) {
      return failure(
        new ValidationError('Invalid user id', { userId: 'Invalid UUID' })
      );
    }
    if (!UUID_REGEX.test(clientSessionId)) {
      return failure(
        new ValidationError('Invalid clientSessionId', {
          clientSessionId: 'Invalid UUID',
        })
      );
    }

    return this.repository.linkSessionToUser(clientSessionId, userId);
  }
}
