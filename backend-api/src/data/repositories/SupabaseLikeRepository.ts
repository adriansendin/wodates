import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Like, CreateLike } from '../../domain/entities/Like';
import { Result, success, failure } from '../../domain/Result';
import {
  ConflictError,
  DomainError,
  InternalError,
  NotFoundError,
} from '../../domain/errors/DomainError';
import { LikeRepository } from '../../domain/repositories/LikeRepository';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type InteractionRow = {
  id: string;
  from_user: string;
  to_user: string;
  created_at: string;
};

export class SupabaseLikeRepository implements LikeRepository {
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

  async create(likeData: CreateLike): Promise<Result<Like, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('interactions')
        .insert({
          from_user: likeData.userId,
          to_user: likeData.targetUserId,
          action: 'like',
        })
        .select('id, from_user, to_user, created_at')
        .single();

      if (error) {
        if (this.isUniqueViolation(error)) {
          return failure(new ConflictError('User already liked'));
        }

        return failure(
          new InternalError(
            `Failed to register like: ${this.formatSupabaseError(error)}`
          )
        );
      }

      if (!data) {
        return failure(new InternalError('Supabase did not return like row'));
      }

      return success(this.mapLike(data));
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError('Unexpected error creating like', error)
      );
    }
  }

  async findByUserId(userId: string): Promise<Result<Like[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from('interactions')
        .select('id, from_user, to_user, created_at')
        .eq('from_user', userId)
        .eq('action', 'like')
        .order('created_at', { ascending: false });

      if (error) {
        return failure(
          new InternalError(
            `Failed to query likes: ${this.formatSupabaseError(error)}`
          )
        );
      }

      return success((data ?? []).map((row) => this.mapLike(row)));
    } catch (error) {
      return failure(
        new InternalError('Unexpected error fetching likes', error)
      );
    }
  }

  async findByUserAndTarget(
    userId: string,
    targetUserId: string
  ): Promise<Result<Like, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('interactions')
        .select('id, from_user, to_user, created_at')
        .eq('from_user', userId)
        .eq('to_user', targetUserId)
        .eq('action', 'like')
        .maybeSingle();

      if (error) {
        return failure(
          new InternalError(
            `Failed to query like: ${this.formatSupabaseError(error)}`
          )
        );
      }

      if (!data) {
        return failure(new NotFoundError('Like not found'));
      }

      return success(this.mapLike(data));
    } catch (error) {
      return failure(
        new InternalError('Unexpected error fetching like', error)
      );
    }
  }

  async hasLiked(
    userId: string,
    targetUserId: string
  ): Promise<Result<boolean, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('interactions')
        .select('id')
        .eq('from_user', userId)
        .eq('to_user', targetUserId)
        .eq('action', 'like')
        .maybeSingle();

      if (error) {
        return failure(
          new InternalError(
            `Failed to verify like: ${this.formatSupabaseError(error)}`
          )
        );
      }

      return success(Boolean(data));
    } catch (error) {
      return failure(
        new InternalError('Unexpected error checking like', error)
      );
    }
  }

  private mapLike(row: InteractionRow): Like {
    return {
      id: row.id,
      userId: row.from_user,
      targetUserId: row.to_user,
      createdAt: row.created_at,
    };
  }

  private resolveConfig(config?: Partial<SupabaseConfig>): SupabaseConfig {
    const url = config?.url ?? process.env.SUPABASE_URL;
    const serviceRoleKey =
      config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SupabaseLikeRepository requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
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
