export type DeepOnboardingAnswerType = 'single' | 'multi' | 'text';

export type DeepOnboardingOption = {
  key: string;
  label: string;
};

export type DeepOnboardingQuestionPublic = {
  code: string;
  promptText: string;
  answerType: DeepOnboardingAnswerType;
  maxChars: number | null;
  maxSelections: number | null;
  options: DeepOnboardingOption[] | null;
};

export type DeepOnboardingBlockPublic = {
  blockIndex: number;
  introText: string;
  questions: DeepOnboardingQuestionPublic[];
};

export type DeepOnboardingFormPublic = {
  blocks: DeepOnboardingBlockPublic[];
};

export type SubmitDeepOnboardingAnswerInput = {
  questionCode: string;
  questionTextSnapshot: string;
  singleKey?: string;
  multiKeys?: string[];
  textAnswer?: string | null;
  otherDetails?: Record<string, string>;
};

export type SubmitDeepOnboardingInput = {
  clientSessionId: string;
  userId?: string | null;
  answers: SubmitDeepOnboardingAnswerInput[];
};
