import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  UserAIProfile,
  CreateUserAIProfile,
  UpdateUserAIProfile,
} from '../../domain/entities/UserAIProfile';
import { Result, success, failure } from '../../domain/Result';
import {
  DomainError,
  InternalError,
  NotFoundError,
} from '../../domain/errors/DomainError';
import { UserAIProfileRepository } from '../../domain/repositories/UserAIProfileRepository';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type UserAIProfileRow = {
  user_id: string;
  summary: string | null; // Stored as plain text
  summary_incremental: string | null; // Stored as plain text
  summary_updated_at: string;
  summary_embedding: number[] | string | null; // Can be vector or array
};

export class SupabaseUserAIProfileRepository
  implements UserAIProfileRepository
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
    profile: CreateUserAIProfile
  ): Promise<Result<UserAIProfile, DomainError>> {
    try {
      const insertData: {
        user_id: string;
        summary?: string | null;
        summary_incremental?: string | null;
        summary_embedding?: string | null;
      } = {
        user_id: profile.userId,
      };

      if (profile.summary !== undefined) {
        insertData.summary = profile.summary || null;
      }

      if (profile.summaryIncremental !== undefined) {
        insertData.summary_incremental = profile.summaryIncremental || null;
      }

      if (profile.summaryEmbedding !== undefined) {
        insertData.summary_embedding = profile.summaryEmbedding
          ? JSON.stringify(profile.summaryEmbedding)
          : null;
      }

      const { data, error } = await this.client
        .from('user_ai_profiles')
        .insert(insertData)
        .select(
          'user_id, summary, summary_incremental, summary_updated_at, summary_embedding'
        )
        .single<UserAIProfileRow>();

      if (error) {
        return failure(
          new InternalError(
            `Failed to insert AI profile: ${this.formatSupabaseError(error)}`
          )
        );
      }

      if (!data) {
        return failure(
          new InternalError('Supabase did not return AI profile row')
        );
      }

      return success(this.mapRowToProfile(data));
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError('Unexpected error creating AI profile', error)
      );
    }
  }

  async findByUserId(
    userId: string
  ): Promise<Result<UserAIProfile | null, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('user_ai_profiles')
        .select(
          'user_id, summary, summary_incremental, summary_updated_at, summary_embedding'
        )
        .eq('user_id', userId)
        .maybeSingle<UserAIProfileRow>();

      if (error) {
        return failure(
          new InternalError(
            `Failed to fetch AI profile: ${this.formatSupabaseError(error)}`
          )
        );
      }

      if (!data) {
        return success(null);
      }

      return success(this.mapRowToProfile(data));
    } catch (error) {
      return failure(
        new InternalError('Unexpected error fetching AI profile', error)
      );
    }
  }

  async update(
    userId: string,
    update: UpdateUserAIProfile
  ): Promise<Result<UserAIProfile, DomainError>> {
    try {
      const updateData: {
        summary?: string | null;
        summary_incremental?: string | null;
        summary_embedding?: string | null;
        summary_updated_at?: string;
      } = {
        summary_updated_at: new Date().toISOString(),
      };

      if (update.summary !== undefined) {
        updateData.summary = update.summary || null;
      }

      if (update.summaryIncremental !== undefined) {
        updateData.summary_incremental = update.summaryIncremental || null;
      }

      if (update.summaryEmbedding !== undefined) {
        updateData.summary_embedding = update.summaryEmbedding
          ? JSON.stringify(update.summaryEmbedding)
          : null;
      }

      const { data, error } = await this.client
        .from('user_ai_profiles')
        .update(updateData)
        .eq('user_id', userId)
        .select(
          'user_id, summary, summary_incremental, summary_updated_at, summary_embedding'
        )
        .single<UserAIProfileRow>();

      if (error) {
        return failure(
          new InternalError(
            `Failed to update AI profile: ${this.formatSupabaseError(error)}`
          )
        );
      }

      if (!data) {
        return failure(new NotFoundError('AI profile not found'));
      }

      return success(this.mapRowToProfile(data));
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError('Unexpected error updating AI profile', error)
      );
    }
  }

  async upsert(
    profile: CreateUserAIProfile
  ): Promise<Result<UserAIProfile, DomainError>> {
    try {
      // Check if exists
      const existingResult = await this.findByUserId(profile.userId);
      if (existingResult.success && existingResult.data) {
        // Update existing
        return this.update(profile.userId, {
          summary: profile.summary,
          summaryIncremental: profile.summaryIncremental,
          summaryEmbedding: profile.summaryEmbedding,
        });
      } else {
        // Create new
        return this.create(profile);
      }
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError('Unexpected error upserting AI profile', error)
      );
    }
  }

  private mapRowToProfile(row: UserAIProfileRow): UserAIProfile {
    // Handle embedding - can be array or JSON string
    let embedding: number[] | null = null;
    if (row.summary_embedding !== null && row.summary_embedding !== undefined) {
      if (typeof row.summary_embedding === 'string') {
        try {
          embedding = JSON.parse(row.summary_embedding);
        } catch {
          embedding = null;
        }
      } else {
        embedding = row.summary_embedding;
      }
    }

    // Summary fields are plain text, no parsing needed
    const summary =
      row.summary && row.summary.trim() !== '' ? row.summary : null;
    const summaryIncremental =
      row.summary_incremental && row.summary_incremental.trim() !== ''
        ? row.summary_incremental
        : null;

    return {
      userId: row.user_id,
      summary,
      summaryIncremental,
      summaryUpdatedAt: new Date(row.summary_updated_at).toISOString(),
      summaryEmbedding: embedding,
    };
  }

  private resolveConfig(config?: Partial<SupabaseConfig>): SupabaseConfig {
    const url = config?.url ?? process.env.SUPABASE_URL;
    const serviceRoleKey =
      config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SupabaseUserAIProfileRepository requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
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
        .filter(
          (value): value is string =>
            typeof value === 'string' && value.trim().length > 0
        )
        .join(' | ');
    }

    return typeof error === 'string' ? error : 'Unknown Supabase error';
  }
}
