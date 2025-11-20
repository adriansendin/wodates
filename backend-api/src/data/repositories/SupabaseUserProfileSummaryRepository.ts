import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  UserProfileSummary,
  CreateUserProfileSummary,
  UpdateUserProfileSummary,
} from '../../domain/entities/UserProfileSummary';
import { Result, success, failure } from '../../domain/Result';
import {
  DomainError,
  InternalError,
  NotFoundError,
} from '../../domain/errors/DomainError';
import { UserProfileSummaryRepository } from '../../domain/repositories/UserProfileSummaryRepository';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type UserProfileSummaryRow = {
  id: string;
  user_id: string;
  summary: string;
  embedding: number[] | string; // Can be vector or array
  provider: string;
  model: string | null;
  dimension: number | null;
  created_at: string;
  updated_at: string;
};

export class SupabaseUserProfileSummaryRepository
  implements UserProfileSummaryRepository
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
    summary: CreateUserProfileSummary,
  ): Promise<Result<UserProfileSummary, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('user_profile_summaries')
        .insert({
          user_id: summary.userId,
          summary: summary.summary,
          embedding: JSON.stringify(summary.embedding), // Store as JSON string if vector type not available
          provider: summary.provider,
          model: summary.model || null,
          dimension: summary.dimension,
        })
        .select('id, user_id, summary, embedding, provider, model, dimension, created_at, updated_at')
        .single<UserProfileSummaryRow>();

      if (error) {
        return failure(
          new InternalError(
            `Failed to insert profile summary: ${this.formatSupabaseError(error)}`,
          ),
        );
      }

      if (!data) {
        return failure(new InternalError('Supabase did not return profile summary row'));
      }

      return success(this.mapRowToSummary(data));
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError('Unexpected error creating profile summary', error),
      );
    }
  }

  async findByUserId(
    userId: string,
  ): Promise<Result<UserProfileSummary | null, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('user_profile_summaries')
        .select('id, user_id, summary, embedding, provider, model, dimension, created_at, updated_at')
        .eq('user_id', userId)
        .maybeSingle<UserProfileSummaryRow>();

      if (error) {
        return failure(
          new InternalError(
            `Failed to fetch profile summary: ${this.formatSupabaseError(error)}`,
          ),
        );
      }

      if (!data) {
        return success(null);
      }

      return success(this.mapRowToSummary(data));
    } catch (error) {
      return failure(
        new InternalError('Unexpected error fetching profile summary', error),
      );
    }
  }

  async update(
    userId: string,
    update: UpdateUserProfileSummary,
  ): Promise<Result<UserProfileSummary, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('user_profile_summaries')
        .update({
          summary: update.summary,
          embedding: JSON.stringify(update.embedding),
          provider: update.provider,
          model: update.model || null,
          dimension: update.dimension,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select('id, user_id, summary, embedding, provider, model, dimension, created_at, updated_at')
        .single<UserProfileSummaryRow>();

      if (error) {
        return failure(
          new InternalError(
            `Failed to update profile summary: ${this.formatSupabaseError(error)}`,
          ),
        );
      }

      if (!data) {
        return failure(new NotFoundError('Profile summary not found'));
      }

      return success(this.mapRowToSummary(data));
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError('Unexpected error updating profile summary', error),
      );
    }
  }

  async upsert(
    summary: CreateUserProfileSummary,
  ): Promise<Result<UserProfileSummary, DomainError>> {
    try {
      // Check if exists
      const existingResult = await this.findByUserId(summary.userId);
      if (existingResult.success && existingResult.data) {
        // Update existing
        return this.update(summary.userId, {
          summary: summary.summary,
          embedding: summary.embedding,
          provider: summary.provider,
          ...(summary.model && { model: summary.model }),
          dimension: summary.dimension,
        });
      } else {
        // Create new
        return this.create(summary);
      }
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError('Unexpected error upserting profile summary', error),
      );
    }
  }

  private mapRowToSummary(row: UserProfileSummaryRow): UserProfileSummary {
    // Handle embedding - can be array or JSON string
    let embedding: number[];
    if (typeof row.embedding === 'string') {
      try {
        embedding = JSON.parse(row.embedding);
      } catch {
        embedding = [];
      }
    } else {
      embedding = row.embedding;
    }

    return {
      id: row.id,
      userId: row.user_id,
      summary: row.summary,
      embedding,
      provider: row.provider,
      ...(row.model && { model: row.model }),
      dimension: row.dimension || embedding.length,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  private resolveConfig(config?: Partial<SupabaseConfig>): SupabaseConfig {
    const url = config?.url ?? process.env.SUPABASE_URL;
    const serviceRoleKey =
      config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SupabaseUserProfileSummaryRepository requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
      );
    }

    return {
      url,
      serviceRoleKey,
    };
  }

  private formatSupabaseError(error: unknown): string {
    if (error && typeof error === 'object') {
      const message = (error as { message?: unknown }).message;
      const details = (error as { details?: unknown }).details;
      const hint = (error as { hint?: unknown }).hint;

      return [message, details, hint]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .join(' | ');
    }

    return typeof error === 'string' ? error : 'Unknown Supabase error';
  }
}

