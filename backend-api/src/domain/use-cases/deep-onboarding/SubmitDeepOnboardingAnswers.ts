import { Result, success, failure } from '../../Result';
import { ValidationError, DomainError } from '../../errors/DomainError';
import type {
  DeepOnboardingQuestionPublic,
  SubmitDeepOnboardingAnswerInput,
  SubmitDeepOnboardingInput,
} from '../../entities/DeepOnboarding';
import type { DeepOnboardingRepository } from '../../repositories/DeepOnboardingRepository';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OTHER_DETAIL_MAX_LEN = 300;

type NormalizedAnswerRow = {
  questionCode: string;
  questionTextSnapshot: string;
  singleKey: string | null;
  multiKeys: string[] | null;
  textAnswer: string | null;
  otherDetails: Record<string, string> | null;
};

export class SubmitDeepOnboardingAnswers {
  constructor(private readonly repository: DeepOnboardingRepository) {}

  async execute(
    input: SubmitDeepOnboardingInput
  ): Promise<Result<{ savedCount: number }, DomainError>> {
    if (!UUID_REGEX.test(input.clientSessionId)) {
      return failure(
        new ValidationError('clientSessionId must be a valid UUID', {
          clientSessionId: 'Invalid UUID',
        })
      );
    }

    if (input.userId && !UUID_REGEX.test(input.userId)) {
      return failure(
        new ValidationError('userId must be a valid UUID when provided', {
          userId: 'Invalid UUID',
        })
      );
    }

    const formResult = await this.repository.getForm();
    if (!formResult.success) {
      return formResult;
    }

    const defs = this.buildQuestionMap(formResult.data);
    const normalized: NormalizedAnswerRow[] = [];

    for (const raw of input.answers) {
      const def = defs.get(raw.questionCode);
      if (!def) {
        return failure(
          new ValidationError(`Unknown question code: ${raw.questionCode}`, {
            questionCode: 'Not found',
          })
        );
      }

      const normalizedOne = this.normalizeAnswer(def, raw);
      if (!normalizedOne.success) {
        return normalizedOne;
      }
      normalized.push(normalizedOne.data);
    }

    const sessionResult = await this.repository.getOrCreateSession(
      input.clientSessionId,
      input.userId ?? null
    );
    if (!sessionResult.success) {
      return sessionResult;
    }

    const saveResult = await this.repository.upsertAnswers(
      sessionResult.data.id,
      normalized
    );
    if (!saveResult.success) {
      return saveResult;
    }

    return success({ savedCount: normalized.length });
  }

  private buildQuestionMap(
    form: { blocks: { questions: DeepOnboardingQuestionPublic[] }[] }
  ): Map<string, DeepOnboardingQuestionPublic> {
    const map = new Map<string, DeepOnboardingQuestionPublic>();
    for (const block of form.blocks) {
      for (const q of block.questions) {
        map.set(q.code, q);
      }
    }
    return map;
  }

  private normalizeAnswer(
    def: DeepOnboardingQuestionPublic,
    raw: SubmitDeepOnboardingAnswerInput
  ): Result<NormalizedAnswerRow, ValidationError> {
    const snapshot = raw.questionTextSnapshot.trim();
    if (snapshot !== def.promptText.trim()) {
      return failure(
        new ValidationError('Question text snapshot does not match server catalog', {
          questionCode: raw.questionCode,
        })
      );
    }

    if (def.answerType === 'single') {
      const key = raw.singleKey?.trim();
      if (!key) {
        return failure(
          new ValidationError('singleKey is required', {
            [raw.questionCode]: 'Missing selection',
          })
        );
      }
      if (raw.multiKeys?.length || raw.textAnswer?.trim()) {
        return failure(
          new ValidationError('Only singleKey is allowed for this question', {
            [raw.questionCode]: 'Invalid payload',
          })
        );
      }
      const allowed = def.options?.map((o) => o.key) ?? [];
      if (!allowed.includes(key)) {
        return failure(
          new ValidationError('Invalid option key', {
            [raw.questionCode]: key,
          })
        );
      }
      return success({
        questionCode: def.code,
        questionTextSnapshot: def.promptText,
        singleKey: key,
        multiKeys: null,
        textAnswer: null,
        otherDetails: null,
      });
    }

    if (def.answerType === 'multi') {
      const keys = raw.multiKeys ?? [];
      if (!keys.length) {
        return failure(
          new ValidationError('multiKeys is required', {
            [raw.questionCode]: 'Pick at least one option',
          })
        );
      }
      if (raw.singleKey || raw.textAnswer?.trim()) {
        return failure(
          new ValidationError('Only multiKeys is allowed for this question', {
            [raw.questionCode]: 'Invalid payload',
          })
        );
      }

      const maxSel = def.maxSelections ?? keys.length;
      const allowed = new Set(def.options?.map((o) => o.key) ?? []);
      const unique: string[] = [];
      const seen = new Set<string>();
      for (const k of keys) {
        const trimmed = k.trim();
        if (!trimmed) continue;
        if (!allowed.has(trimmed)) {
          return failure(
            new ValidationError('Invalid option key', {
              [raw.questionCode]: trimmed,
            })
          );
        }
        if (!seen.has(trimmed)) {
          seen.add(trimmed);
          unique.push(trimmed);
        }
      }

      if (unique.length === 0) {
        return failure(
          new ValidationError('multiKeys is required', {
            [raw.questionCode]: 'Pick at least one option',
          })
        );
      }

      if (unique.length > maxSel) {
        return failure(
          new ValidationError(`Select at most ${maxSel} options`, {
            [raw.questionCode]: 'Too many selections',
          })
        );
      }

      const otherDetails = this.validateOtherDetails(def, unique, raw.otherDetails);
      if (!otherDetails.success) {
        return otherDetails;
      }

      return success({
        questionCode: def.code,
        questionTextSnapshot: def.promptText,
        singleKey: null,
        multiKeys: unique,
        textAnswer: null,
        otherDetails: otherDetails.data,
      });
    }

    const text = (raw.textAnswer ?? '').trim();
    if (!text) {
      return failure(
        new ValidationError('textAnswer is required', {
          [raw.questionCode]: 'Empty answer',
        })
      );
    }
    if (raw.singleKey || (raw.multiKeys && raw.multiKeys.length > 0)) {
      return failure(
        new ValidationError('Only textAnswer is allowed for this question', {
          [raw.questionCode]: 'Invalid payload',
        })
      );
    }

    const maxChars = def.maxChars ?? 5000;
    if (text.length > maxChars) {
      return failure(
        new ValidationError(`Answer exceeds ${maxChars} characters`, {
          [raw.questionCode]: 'Too long',
        })
      );
    }

    return success({
      questionCode: def.code,
      questionTextSnapshot: def.promptText,
      singleKey: null,
      multiKeys: null,
      textAnswer: text,
      otherDetails: null,
    });
  }

  private validateOtherDetails(
    def: DeepOnboardingQuestionPublic,
    keys: string[],
    rawOther?: Record<string, string>
  ): Result<Record<string, string> | null, ValidationError> {
    const optionKeysNeedingDetail = keys.filter((k) => k.startsWith('other_'));
    if (optionKeysNeedingDetail.length === 0) {
      return success(null);
    }

    const out: Record<string, string> = {};
    for (const key of optionKeysNeedingDetail) {
      const detail = (rawOther?.[key] ?? '').trim();
      if (!detail) {
        return failure(
          new ValidationError(`Detail required for ${key}`, {
            [def.code]: `Missing text for ${key}`,
          })
        );
      }
      if (detail.length > OTHER_DETAIL_MAX_LEN) {
        return failure(
          new ValidationError(`Detail for ${key} is too long`, {
            [def.code]: `Max ${OTHER_DETAIL_MAX_LEN} characters`,
          })
        );
      }
      out[key] = detail;
    }

    return success(Object.keys(out).length ? out : null);
  }
}
