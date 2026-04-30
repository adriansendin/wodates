import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Result, success, failure } from '../../domain/Result';
import { DomainError, InternalError } from '../../domain/errors/DomainError';
import {
  DeepOnboardingRepository,
  DeepOnboardingSessionRow,
} from '../../domain/repositories/DeepOnboardingRepository';
import type {
  DeepOnboardingBlockPublic,
  DeepOnboardingFormPublic,
  DeepOnboardingOption,
  DeepOnboardingQuestionPublic,
} from '../../domain/entities/DeepOnboarding';
import type { DeepOnboardingUserSessionHydration } from '../../domain/entities/DeepOnboardingHydration';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type BlockRow = {
  block_index: number;
  intro_text: string;
  sort_order: number;
};

type QuestionRow = {
  code: string;
  block_index: number;
  sort_order: number;
  prompt_text: string;
  answer_type: string;
  max_chars: number | null;
  max_selections: number | null;
  options: unknown;
};

export class SupabaseDeepOnboardingRepository implements DeepOnboardingRepository {
  private readonly client: SupabaseClient;

  constructor(config?: Partial<SupabaseConfig>) {
    const resolved = this.resolveConfig(config);
    this.client = createClient(resolved.url, resolved.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async getForm(): Promise<Result<DeepOnboardingFormPublic, DomainError>> {
    try {
      const { data: blockRows, error: blocksError } = await this.client
        .from('deep_onboarding_blocks')
        .select('block_index, intro_text, sort_order')
        .order('sort_order', { ascending: true });

      if (blocksError) {
        return failure(
          new InternalError(
            `Failed to load onboarding blocks: ${this.formatSupabaseError(blocksError)}`
          )
        );
      }

      const { data: questionRows, error: questionsError } = await this.client
        .from('deep_onboarding_questions')
        .select(
          'code, block_index, sort_order, prompt_text, answer_type, max_chars, max_selections, options'
        )
        .order('block_index', { ascending: true })
        .order('sort_order', { ascending: true });

      if (questionsError) {
        return failure(
          new InternalError(
            `Failed to load onboarding questions: ${this.formatSupabaseError(questionsError)}`
          )
        );
      }

      const blocks = this.mapBlocks(blockRows ?? [], questionRows ?? []);
      return success({ blocks });
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError('Unexpected error loading onboarding form', error)
      );
    }
  }

  async getOrCreateSession(
    clientSessionId: string,
    userId: string | null
  ): Promise<Result<DeepOnboardingSessionRow, DomainError>> {
    try {
      const { data: existing, error: selectError } = await this.client
        .from('deep_onboarding_sessions')
        .select('id, client_session_id, user_id')
        .eq('client_session_id', clientSessionId)
        .maybeSingle();

      if (selectError) {
        return failure(
          new InternalError(
            `Failed to resolve onboarding session: ${this.formatSupabaseError(selectError)}`
          )
        );
      }

      if (existing) {
        if (userId && existing.user_id !== userId) {
          const { error: updateError } = await this.client
            .from('deep_onboarding_sessions')
            .update({
              user_id: userId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) {
            return failure(
              new InternalError(
                `Failed to attach user to session: ${this.formatSupabaseError(updateError)}`
              )
            );
          }
        }

        return success({
          id: existing.id,
          clientSessionId: existing.client_session_id,
          userId: existing.user_id ?? null,
        });
      }

      const { data: inserted, error: insertError } = await this.client
        .from('deep_onboarding_sessions')
        .insert({
          client_session_id: clientSessionId,
          user_id: userId,
          updated_at: new Date().toISOString(),
        })
        .select('id, client_session_id, user_id')
        .single();

      if (insertError) {
        if (this.isUniqueViolation(insertError)) {
          return this.getOrCreateSession(clientSessionId, userId);
        }
        return failure(
          new InternalError(
            `Failed to create onboarding session: ${this.formatSupabaseError(insertError)}`
          )
        );
      }

      if (!inserted) {
        return failure(new InternalError('Supabase did not return session row'));
      }

      return success({
        id: inserted.id,
        clientSessionId: inserted.client_session_id,
        userId: inserted.user_id ?? null,
      });
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError('Unexpected error resolving onboarding session', error)
      );
    }
  }

  async upsertAnswers(
    sessionUuid: string,
    answers: Array<{
      questionCode: string;
      questionTextSnapshot: string;
      singleKey: string | null;
      multiKeys: string[] | null;
      textAnswer: string | null;
      otherDetails: Record<string, string> | null;
    }>
  ): Promise<Result<void, DomainError>> {
    if (answers.length === 0) {
      return success(undefined);
    }

    try {
      const payload = answers.map((r) => ({
        session_uuid: sessionUuid,
        question_code: r.questionCode,
        question_text_snapshot: r.questionTextSnapshot,
        single_key: r.singleKey,
        multi_keys: r.multiKeys,
        text_answer: r.textAnswer,
        other_details: r.otherDetails,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await this.client
        .from('deep_onboarding_answers')
        .upsert(payload, {
          onConflict: 'session_uuid,question_code',
        });

      if (error) {
        return failure(
          new InternalError(
            `Failed to save onboarding answers: ${this.formatSupabaseError(error)}`
          )
        );
      }

      const { error: touchError } = await this.client
        .from('deep_onboarding_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionUuid);

      if (touchError) {
        return failure(
          new InternalError(
            `Failed to update session timestamp: ${this.formatSupabaseError(touchError)}`
          )
        );
      }

      return success(undefined);
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError('Unexpected error saving onboarding answers', error)
      );
    }
  }

  async getLatestSessionHydrationForUser(
    userId: string
  ): Promise<Result<DeepOnboardingUserSessionHydration, DomainError>> {
    try {
      const { data: sessionRow, error: sessionError } = await this.client
        .from('deep_onboarding_sessions')
        .select('id, client_session_id')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionError) {
        return failure(
          new InternalError(
            `Failed to load onboarding session for user: ${this.formatSupabaseError(sessionError)}`
          )
        );
      }

      if (!sessionRow) {
        return success({ clientSessionId: null, answers: [] });
      }

      const { data: answerRows, error: answersError } = await this.client
        .from('deep_onboarding_answers')
        .select(
          'question_code, single_key, multi_keys, text_answer, other_details'
        )
        .eq('session_uuid', sessionRow.id);

      if (answersError) {
        return failure(
          new InternalError(
            `Failed to load onboarding answers: ${this.formatSupabaseError(answersError)}`
          )
        );
      }

      const answers =
        answerRows?.map((r) => ({
          questionCode: r.question_code as string,
          singleKey: (r.single_key as string | null) ?? null,
          multiKeys: (r.multi_keys as string[] | null) ?? null,
          textAnswer: (r.text_answer as string | null) ?? null,
          otherDetails: this.normalizeOtherDetails(r.other_details),
        })) ?? [];

      return success({
        clientSessionId: sessionRow.client_session_id as string,
        answers,
      });
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError('Unexpected error loading user onboarding hydration', error)
      );
    }
  }

  async linkSessionToUser(
    clientSessionId: string,
    userId: string
  ): Promise<Result<{ linked: boolean }, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('deep_onboarding_sessions')
        .update({
          user_id: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('client_session_id', clientSessionId)
        .select('id');

      if (error) {
        return failure(
          new InternalError(
            `Failed to link onboarding session: ${this.formatSupabaseError(error)}`
          )
        );
      }

      const linked = Array.isArray(data) && data.length > 0;
      return success({ linked });
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError('Unexpected error linking onboarding session', error)
      );
    }
  }

  private mapBlocks(
    blockRows: BlockRow[],
    questionRows: QuestionRow[]
  ): DeepOnboardingBlockPublic[] {
    const byBlock = new Map<number, DeepOnboardingQuestionPublic[]>();
    for (const row of questionRows) {
      const q = this.mapQuestion(row);
      const list = byBlock.get(row.block_index) ?? [];
      list.push(q);
      byBlock.set(row.block_index, list);
    }

    return blockRows.map((b) => ({
      blockIndex: b.block_index,
      introText: b.intro_text,
      questions: byBlock.get(b.block_index) ?? [],
    }));
  }

  private mapQuestion(row: QuestionRow): DeepOnboardingQuestionPublic {
    return {
      code: row.code,
      promptText: row.prompt_text,
      answerType: row.answer_type as DeepOnboardingQuestionPublic['answerType'],
      maxChars: row.max_chars,
      maxSelections: row.max_selections,
      options: this.parseOptions(row.options),
    };
  }

  private normalizeOtherDetails(raw: unknown): Record<string, string> | null {
    if (raw === null || raw === undefined) {
      return null;
    }
    if (typeof raw !== 'object') {
      return null;
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) {
        out[k] = v;
      }
    }
    return Object.keys(out).length ? out : null;
  }

  private parseOptions(raw: unknown): DeepOnboardingOption[] | null {
    if (raw === null || raw === undefined) {
      return null;
    }
    if (!Array.isArray(raw)) {
      return null;
    }
    const out: DeepOnboardingOption[] = [];
    for (const item of raw) {
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as { key?: unknown }).key === 'string' &&
        typeof (item as { label?: unknown }).label === 'string'
      ) {
        out.push({
          key: (item as { key: string }).key,
          label: (item as { label: string }).label,
        });
      }
    }
    return out.length ? out : null;
  }

  private resolveConfig(config?: Partial<SupabaseConfig>): SupabaseConfig {
    const url = config?.url ?? process.env.SUPABASE_URL;
    const serviceRoleKey =
      config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SupabaseDeepOnboardingRepository requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
      );
    }

    return { url, serviceRoleKey };
  }

  private isUniqueViolation(error: unknown): boolean {
    if (error && typeof error === 'object') {
      return (error as { code?: string }).code === '23505';
    }
    return false;
  }

  private formatSupabaseError(error: unknown): string {
    if (error && typeof error === 'object') {
      const message = (error as { message?: string }).message;
      const details = (error as { details?: string }).details;
      const hint = (error as { hint?: string }).hint;

      return [message, details, hint]
        .filter(
          (segment) => typeof segment === 'string' && segment.trim().length
        )
        .join(' | ');
    }

    return typeof error === 'string' ? error : 'Unknown Supabase error';
  }
}
