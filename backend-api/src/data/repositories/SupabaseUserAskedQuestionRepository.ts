import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  UserAskedQuestion,
  CreateUserAskedQuestion,
} from '../../domain/entities/UserAskedQuestion';
import { Result, success, failure } from '../../domain/Result';
import {
  ConflictError,
  DomainError,
  InternalError,
} from '../../domain/errors/DomainError';
import { UserAskedQuestionRepository } from '../../domain/repositories/UserAskedQuestionRepository';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type UserAskedQuestionRow = {
  user_id: string;
  question_id: number;
  asked_at: string;
};

export class SupabaseUserAskedQuestionRepository
  implements UserAskedQuestionRepository
{
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

  async create(
    userAskedQuestionData: CreateUserAskedQuestion
  ): Promise<Result<UserAskedQuestion, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('user_asked_questions')
        .insert({
          user_id: userAskedQuestionData.userId,
          question_id: userAskedQuestionData.questionId,
        })
        .select('user_id, question_id, asked_at')
        .single();

      if (error) {
        if (this.isUniqueViolation(error)) {
          return failure(
            new ConflictError(
              'This question has already been asked to this user'
            )
          );
        }

        return failure(
          new InternalError(
            `Failed to record asked question: ${this.formatSupabaseError(error)}`
          )
        );
      }

      if (!data) {
        return failure(
          new InternalError(
            'Supabase did not return user_asked_questions row'
          )
        );
      }

      return success(this.mapUserAskedQuestion(data));
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError(
              'Unexpected error recording asked question',
              error
            )
      );
    }
  }

  async hasBeenAsked(
    userId: string,
    questionId: number
  ): Promise<Result<boolean, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('user_asked_questions')
        .select('user_id')
        .eq('user_id', userId)
        .eq('question_id', questionId)
        .maybeSingle();

      if (error) {
        return failure(
          new InternalError(
            `Failed to check if question was asked: ${this.formatSupabaseError(error)}`
          )
        );
      }

      return success(Boolean(data));
    } catch (error) {
      return failure(
        new InternalError('Unexpected error checking if question was asked', error)
      );
    }
  }

  async getAskedQuestionsByUser(
    userId: string
  ): Promise<Result<UserAskedQuestion[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from('user_asked_questions')
        .select('user_id, question_id, asked_at')
        .eq('user_id', userId)
        .order('asked_at', { ascending: false });

      if (error) {
        return failure(
          new InternalError(
            `Failed to get asked questions: ${this.formatSupabaseError(error)}`
          )
        );
      }

      return success((data ?? []).map((row) => this.mapUserAskedQuestion(row)));
    } catch (error) {
      return failure(
        new InternalError('Unexpected error fetching asked questions', error)
      );
    }
  }

  async getUsersAskedQuestion(
    questionId: number
  ): Promise<Result<UserAskedQuestion[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from('user_asked_questions')
        .select('user_id, question_id, asked_at')
        .eq('question_id', questionId)
        .order('asked_at', { ascending: false });

      if (error) {
        return failure(
          new InternalError(
            `Failed to get users asked question: ${this.formatSupabaseError(error)}`
          )
        );
      }

      return success((data ?? []).map((row) => this.mapUserAskedQuestion(row)));
    } catch (error) {
      return failure(
        new InternalError('Unexpected error fetching users asked question', error)
      );
    }
  }

  async getUnaskedQuestionIds(
    userId: string,
    questionIds?: number[]
  ): Promise<Result<number[], DomainError>> {
    try {
      // First, get all question IDs that have been asked to this user
      const { data: askedQuestions, error: askedError } = await this.client
        .from('user_asked_questions')
        .select('question_id')
        .eq('user_id', userId);

      if (askedError) {
        return failure(
          new InternalError(
            `Failed to get asked questions: ${this.formatSupabaseError(askedError)}`
          )
        );
      }

      const askedQuestionIds = new Set(
        (askedQuestions ?? []).map((q) => q.question_id)
      );

      // If questionIds filter is provided, return only those that haven't been asked
      if (questionIds) {
        const unasked = questionIds.filter((id) => !askedQuestionIds.has(id));
        return success(unasked);
      }

      // If no filter, we need to get all question IDs from question_bank
      // and return those that haven't been asked
      const { data: allQuestions, error: allQuestionsError } = await this.client
        .from('question_bank')
        .select('id')
        .eq('deprecated', false);

      if (allQuestionsError) {
        return failure(
          new InternalError(
            `Failed to get all questions: ${this.formatSupabaseError(allQuestionsError)}`
          )
        );
      }

      const allQuestionIds = (allQuestions ?? []).map((q) => q.id);
      const unasked = allQuestionIds.filter(
        (id) => !askedQuestionIds.has(id)
      );

      return success(unasked);
    } catch (error) {
      return failure(
        new InternalError('Unexpected error getting unasked question IDs', error)
      );
    }
  }

  private mapUserAskedQuestion(
    row: UserAskedQuestionRow
  ): UserAskedQuestion {
    return {
      userId: row.user_id,
      questionId: row.question_id,
      askedAt: row.asked_at,
    };
  }

  private resolveConfig(config?: Partial<SupabaseConfig>): SupabaseConfig {
    const url = config?.url ?? process.env.SUPABASE_URL;
    const serviceRoleKey =
      config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SupabaseUserAskedQuestionRepository requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
      );
    }

    return {
      url,
      serviceRoleKey,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    if (error && typeof error === 'object') {
      const code = (error as { code?: string }).code;
      return code === '23505';
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
