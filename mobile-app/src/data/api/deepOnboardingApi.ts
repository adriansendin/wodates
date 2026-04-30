import { ApiClient } from './apiClient';
import { Result } from '../../domain/Result';
import { DomainError } from '../../domain/errors/DomainError';

export type DeepOnboardingOptionDto = {
  key: string;
  label: string;
};

export type DeepOnboardingQuestionDto = {
  code: string;
  promptText: string;
  answerType: 'single' | 'multi' | 'text';
  maxChars: number | null;
  maxSelections: number | null;
  options: DeepOnboardingOptionDto[] | null;
};

export type DeepOnboardingBlockDto = {
  blockIndex: number;
  introText: string;
  questions: DeepOnboardingQuestionDto[];
};

export type DeepOnboardingFormDto = {
  blocks: DeepOnboardingBlockDto[];
};

export type DeepOnboardingSubmitAnswerDto = {
  questionCode: string;
  questionTextSnapshot: string;
  singleKey?: string;
  multiKeys?: string[];
  textAnswer?: string | null;
  otherDetails?: Record<string, string>;
};

export type DeepOnboardingSubmitBodyDto = {
  clientSessionId: string;
  userId?: string | null;
  answers: DeepOnboardingSubmitAnswerDto[];
};

export type DeepOnboardingSessionMeDto = {
  clientSessionId: string | null;
  answers: Array<{
    questionCode: string;
    singleKey?: string | null;
    multiKeys?: string[] | null;
    textAnswer?: string | null;
    otherDetails?: Record<string, string> | null;
  }>;
};

export class DeepOnboardingApi {
  constructor(private readonly apiClient: ApiClient) {}

  async getForm(): Promise<Result<DeepOnboardingFormDto, DomainError>> {
    return this.apiClient.get<DeepOnboardingFormDto>('/deep-onboarding/form');
  }

  async submit(
    body: DeepOnboardingSubmitBodyDto
  ): Promise<Result<{ ok: boolean; savedCount: number }, DomainError>> {
    return this.apiClient.post('/deep-onboarding/submit', body);
  }

  async getMySession(
    token: string
  ): Promise<Result<DeepOnboardingSessionMeDto, DomainError>> {
    return this.apiClient.get<DeepOnboardingSessionMeDto>(
      '/deep-onboarding/me',
      token
    );
  }

  async linkSession(
    clientSessionId: string,
    token: string
  ): Promise<Result<{ ok: boolean; linked: boolean }, DomainError>> {
    return this.apiClient.post('/deep-onboarding/link-session', {
      clientSessionId,
    }, token);
  }
}
