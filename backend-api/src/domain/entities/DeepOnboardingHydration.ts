/** Row shape returned when loading persisted answers for a user's latest session */
export type DeepOnboardingHydratedAnswer = {
  questionCode: string;
  singleKey: string | null;
  multiKeys: string[] | null;
  textAnswer: string | null;
  otherDetails: Record<string, string> | null;
};

export type DeepOnboardingUserSessionHydration = {
  clientSessionId: string | null;
  answers: DeepOnboardingHydratedAnswer[];
};
