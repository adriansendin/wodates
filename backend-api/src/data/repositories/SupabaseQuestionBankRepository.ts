import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  QuestionBank,
  CreateQuestionBank,
  UpdateQuestionBank,
} from '../../domain/entities/QuestionBank';
import { Result, success, failure } from '../../domain/Result';
import {
  DomainError,
  InternalError,
  NotFoundError,
} from '../../domain/errors/DomainError';
import { QuestionBankRepository } from '../../domain/repositories/QuestionBankRepository';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type QuestionBankRow = {
  id: number;
  category: string;
  question: string;
  created_at: string;
  deprecated: boolean;
};

export class SupabaseQuestionBankRepository implements QuestionBankRepository {
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

  async findAll(options?: {
    category?: string;
    deprecated?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Result<QuestionBank[], DomainError>> {
    try {
      let query = this.client
        .from('question_bank')
        .select('id, category, question, created_at, deprecated')
        .order('created_at', { ascending: false });

      if (options?.category) {
        query = query.eq('category', options.category);
      }

      if (options?.deprecated !== undefined) {
        query = query.eq('deprecated', options.deprecated);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
      }

      const { data, error } = await query;

      if (error) {
        return failure(
          new InternalError(
            `Failed to query questions: ${this.formatSupabaseError(error)}`
          )
        );
      }

      return success((data ?? []).map((row) => this.mapQuestionBank(row)));
    } catch (error) {
      return failure(
        new InternalError('Unexpected error fetching questions', error)
      );
    }
  }

  async findById(id: number): Promise<Result<QuestionBank, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('question_bank')
        .select('id, category, question, created_at, deprecated')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        return failure(
          new InternalError(
            `Failed to query question: ${this.formatSupabaseError(error)}`
          )
        );
      }

      if (!data) {
        return failure(new NotFoundError('Question not found'));
      }

      return success(this.mapQuestionBank(data));
    } catch (error) {
      return failure(
        new InternalError('Unexpected error fetching question', error)
      );
    }
  }

  async create(
    questionBank: CreateQuestionBank
  ): Promise<Result<QuestionBank, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('question_bank')
        .insert({
          category: questionBank.category,
          question: questionBank.question,
          deprecated: questionBank.deprecated ?? false,
        })
        .select('id, category, question, created_at, deprecated')
        .single();

      if (error) {
        return failure(
          new InternalError(
            `Failed to create question: ${this.formatSupabaseError(error)}`
          )
        );
      }

      if (!data) {
        return failure(new InternalError('Supabase did not return question row'));
      }

      return success(this.mapQuestionBank(data));
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError('Unexpected error creating question', error)
      );
    }
  }

  async update(
    id: number,
    questionBank: UpdateQuestionBank
  ): Promise<Result<QuestionBank, DomainError>> {
    try {
      const updateData: {
        category?: string;
        question?: string;
        deprecated?: boolean;
      } = {};

      if (questionBank.category !== undefined) {
        updateData.category = questionBank.category;
      }
      if (questionBank.question !== undefined) {
        updateData.question = questionBank.question;
      }
      if (questionBank.deprecated !== undefined) {
        updateData.deprecated = questionBank.deprecated;
      }

      const { data, error } = await this.client
        .from('question_bank')
        .update(updateData)
        .eq('id', id)
        .select('id, category, question, created_at, deprecated')
        .single();

      if (error) {
        return failure(
          new InternalError(
            `Failed to update question: ${this.formatSupabaseError(error)}`
          )
        );
      }

      if (!data) {
        return failure(new NotFoundError('Question not found'));
      }

      return success(this.mapQuestionBank(data));
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError('Unexpected error updating question', error)
      );
    }
  }

  async delete(id: number): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from('question_bank')
        .delete()
        .eq('id', id);

      if (error) {
        return failure(
          new InternalError(
            `Failed to delete question: ${this.formatSupabaseError(error)}`
          )
        );
      }

      return success(undefined);
    } catch (error) {
      return failure(
        new InternalError('Unexpected error deleting question', error)
      );
    }
  }

  private mapQuestionBank(row: QuestionBankRow): QuestionBank {
    return {
      id: row.id,
      category: row.category,
      question: row.question,
      createdAt: row.created_at,
      deprecated: row.deprecated,
    };
  }

  private resolveConfig(config?: Partial<SupabaseConfig>): SupabaseConfig {
    const url = config?.url ?? process.env.SUPABASE_URL;
    const serviceRoleKey =
      config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SupabaseQuestionBankRepository requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
      );
    }

    return {
      url,
      serviceRoleKey,
    };
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
