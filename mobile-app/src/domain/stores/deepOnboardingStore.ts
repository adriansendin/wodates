import { create } from 'zustand';

import { ApiClient } from '../../data/api/apiClient';
import { DeepOnboardingApi } from '../../data/api/deepOnboardingApi';
import type {
  DeepOnboardingBlockDto,
  DeepOnboardingFormDto,
  DeepOnboardingQuestionDto,
  DeepOnboardingSubmitAnswerDto,
} from '../../data/api/deepOnboardingApi';
import { getApiUrl } from '../../utils/apiConfig';
import {
  getOrCreateDeepOnboardingSessionId,
  setStoredDeepOnboardingSessionId,
} from '../../utils/deepOnboardingSession';

export type DeepHydratedAnswer = {
  questionCode: string;
  singleKey?: string | null;
  multiKeys?: string[] | null;
  textAnswer?: string | null;
  otherDetails?: Record<string, string> | null;
};

type DeepOnboardingState = {
  clientSessionId: string | null;
  form: DeepOnboardingFormDto | null;
  formLoading: boolean;
  formError: string | null;
  /** Single-choice selection per question code */
  singleByCode: Record<string, string>;
  /** Multi-choice keys per question code */
  multiByCode: Record<string, string[]>;
  /** Free-text for multi options whose key starts with `other_`, keyed by question code then option key */
  multiOtherNested: Record<string, Record<string, string>>;
  /** Open-text answers */
  textByCode: Record<string, string>;
};

type DeepOnboardingActions = {
  bootstrap: () => Promise<void>;
  setSingle: (code: string, key: string) => void;
  toggleMulti: (code: string, key: string, maxSelections: number) => void;
  setMultiOther: (code: string, optionKey: string, value: string) => void;
  setText: (code: string, value: string) => void;
  getBlock: (blockIndex: number) => DeepOnboardingBlockDto | undefined;
  validateBlock: (blockIndex: number) => 'ok' | 'incomplete' | 'multi_other' | 'text_too_long';
  buildAnswersForBlock: (blockIndex: number) => DeepOnboardingSubmitAnswerDto[];
  /** Merge saved answers after GET /deep-onboarding/me */
  hydrateFromServerAnswers: (answers: DeepHydratedAnswer[]) => void;
  /** Persist client_session_id returned by API so submit targets the linked session */
  syncClientSessionIdFromServer: (clientSessionId: string | null) => Promise<void>;
};

const initialState: DeepOnboardingState = {
  clientSessionId: null,
  form: null,
  formLoading: false,
  formError: null,
  singleByCode: {},
  multiByCode: {},
  multiOtherNested: {},
  textByCode: {},
};

export const useDeepOnboardingStore = create<DeepOnboardingState & DeepOnboardingActions>(
  (set, get) => ({
    ...initialState,

    bootstrap: async () => {
      const { form } = get();
      if (form) {
        if (!get().clientSessionId) {
          const clientSessionId = await getOrCreateDeepOnboardingSessionId();
          set({ clientSessionId });
        }
        return;
      }
      set({ formLoading: true, formError: null });
      try {
        const clientSessionId = await getOrCreateDeepOnboardingSessionId();
        set({ clientSessionId });
        const api = new DeepOnboardingApi(new ApiClient(getApiUrl()));
        const result = await api.getForm();
        if (!result.success) {
          set({
            formLoading: false,
            formError: result.error.message ?? 'Error',
          });
          return;
        }
        set({ form: result.data, formLoading: false, formError: null });
      } catch (e) {
        set({
          formLoading: false,
          formError: e instanceof Error ? e.message : 'Error',
        });
      }
    },

    setSingle: (code, key) =>
      set((s) => ({
        singleByCode: { ...s.singleByCode, [code]: key },
      })),

    toggleMulti: (code, key, maxSelections) =>
      set((s) => {
        const current = s.multiByCode[code] ?? [];
        const has = current.includes(key);
        let next: string[];
        if (has) {
          next = current.filter((k) => k !== key);
        } else if (current.length >= maxSelections) {
          return s;
        } else {
          next = [...current, key];
        }
        return {
          multiByCode: { ...s.multiByCode, [code]: next },
        };
      }),

    setMultiOther: (code, optionKey, value) =>
      set((s) => {
        const prev = s.multiOtherNested[code] ?? {};
        return {
          multiOtherNested: {
            ...s.multiOtherNested,
            [code]: { ...prev, [optionKey]: value },
          },
        };
      }),

    setText: (code, value) =>
      set((s) => ({
        textByCode: { ...s.textByCode, [code]: value },
      })),

    getBlock: (blockIndex) =>
      get().form?.blocks.find((b) => b.blockIndex === blockIndex),

    validateBlock: (blockIndex) => {
      const block = get().getBlock(blockIndex);
      if (!block) return 'incomplete';

      for (const q of block.questions) {
        const r = validateQuestion(get(), q);
        if (r !== 'ok') return r;
      }
      return 'ok';
    },

    buildAnswersForBlock: (blockIndex) => {
      const block = get().getBlock(blockIndex);
      if (!block) return [];

      return block.questions.map((q) => buildAnswerPayload(get(), q));
    },

    hydrateFromServerAnswers: (answers) => {
      set((s) => {
        const singleByCode = { ...s.singleByCode };
        const multiByCode = { ...s.multiByCode };
        const textByCode = { ...s.textByCode };
        const multiOtherNested = { ...s.multiOtherNested };
        for (const a of answers) {
          if (a.singleKey?.trim()) {
            singleByCode[a.questionCode] = a.singleKey.trim();
          }
          if (a.multiKeys?.length) {
            multiByCode[a.questionCode] = [...a.multiKeys];
          }
          const text = (a.textAnswer ?? '').trim();
          if (text) {
            textByCode[a.questionCode] = text;
          }
          const od = a.otherDetails;
          if (od && Object.keys(od).length) {
            multiOtherNested[a.questionCode] = {
              ...(multiOtherNested[a.questionCode] ?? {}),
              ...od,
            };
          }
        }
        return {
          ...s,
          singleByCode,
          multiByCode,
          textByCode,
          multiOtherNested,
        };
      });
    },

    syncClientSessionIdFromServer: async (clientSessionId) => {
      if (!clientSessionId?.trim()) {
        return;
      }
      const id = clientSessionId.trim();
      await setStoredDeepOnboardingSessionId(id);
      set({ clientSessionId: id });
    },
  })
);

function validateQuestion(
  state: DeepOnboardingState,
  q: DeepOnboardingQuestionDto
): 'ok' | 'incomplete' | 'multi_other' | 'text_too_long' {
  if (q.answerType === 'single') {
    const key = state.singleByCode[q.code]?.trim();
    return key ? 'ok' : 'incomplete';
  }

  if (q.answerType === 'multi') {
    const keys = state.multiByCode[q.code] ?? [];
    if (!keys.length) return 'incomplete';

    for (const k of keys) {
      if (!k.startsWith('other_')) continue;
      const detail = (state.multiOtherNested[q.code]?.[k] ?? '').trim();
      if (!detail) return 'multi_other';
    }
    return 'ok';
  }

  const text = (state.textByCode[q.code] ?? '').trim();
  if (!text) return 'incomplete';
  const max = q.maxChars ?? 5000;
  if (text.length > max) return 'text_too_long';
  return 'ok';
}

function buildAnswerPayload(
  state: DeepOnboardingState,
  q: DeepOnboardingQuestionDto
): DeepOnboardingSubmitAnswerDto {
  if (q.answerType === 'single') {
    return {
      questionCode: q.code,
      questionTextSnapshot: q.promptText,
      singleKey: state.singleByCode[q.code],
    };
  }

  if (q.answerType === 'multi') {
    const keys = state.multiByCode[q.code] ?? [];
    const others = state.multiOtherNested[q.code] ?? {};
    const otherDetails: Record<string, string> = {};
    for (const k of keys) {
      if (k.startsWith('other_')) {
        const trimmed = (others[k] ?? '').trim();
        if (trimmed) otherDetails[k] = trimmed;
      }
    }
    const payload: DeepOnboardingSubmitAnswerDto = {
      questionCode: q.code,
      questionTextSnapshot: q.promptText,
      multiKeys: keys,
    };
    if (Object.keys(otherDetails).length) {
      payload.otherDetails = otherDetails;
    }
    return payload;
  }

  return {
    questionCode: q.code,
    questionTextSnapshot: q.promptText,
    textAnswer: (state.textByCode[q.code] ?? '').trim(),
  };
}
