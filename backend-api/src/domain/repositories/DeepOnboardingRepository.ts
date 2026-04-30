import { Result } from '../Result';
import { DomainError } from '../errors/DomainError';
import type { DeepOnboardingFormPublic } from '../entities/DeepOnboarding';
import type {
  DeepOnboardingUserSessionHydration,
} from '../entities/DeepOnboardingHydration';

export type DeepOnboardingSessionRow = {
  id: string;
  clientSessionId: string;
  userId: string | null;
};

export interface DeepOnboardingRepository {
  getForm(): Promise<Result<DeepOnboardingFormPublic, DomainError>>;

  getOrCreateSession(
    clientSessionId: string,
    userId: string | null
  ): Promise<Result<DeepOnboardingSessionRow, DomainError>>;

  upsertAnswers(
    sessionUuid: string,
    answers: Array<{
      questionCode: string;
      questionTextSnapshot: string;
      singleKey: string | null;
      multiKeys: string[] | null;
      textAnswer: string | null;
      otherDetails: Record<string, string> | null;
    }>
  ): Promise<Result<void, DomainError>>;

  /** Associate anonymous questionnaire session with the authenticated user (best-effort). */
  linkSessionToUser(
    clientSessionId: string,
    userId: string
  ): Promise<Result<{ linked: boolean }, DomainError>>;

  /** Latest session with answers linked to this user (for hydrating the client). */
  getLatestSessionHydrationForUser(
    userId: string
  ): Promise<Result<DeepOnboardingUserSessionHydration, DomainError>>;
}
