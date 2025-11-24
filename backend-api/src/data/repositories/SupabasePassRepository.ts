import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pass, CreatePass } from '../../domain/entities/Pass';
import { Result, success, failure } from '../../domain/Result';
import {
  ConflictError,
  DomainError,
  InternalError,
} from '../../domain/errors/DomainError';
import { PassRepository } from '../../domain/repositories/PassRepository';

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

export class SupabasePassRepository implements PassRepository {
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

  async create(passData: CreatePass): Promise<Result<Pass, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('interactions')
        .insert({
          from_user: passData.userId,
          to_user: passData.targetUserId,
          action: 'pass',
        })
        .select('id, from_user, to_user, created_at')
        .single();

      if (error) {
        if (this.isUniqueViolation(error)) {
          return failure(new ConflictError('User already passed'));
        }

        return failure(
          new InternalError(
            `Failed to register pass: ${this.formatSupabaseError(error)}`
          )
        );
      }

      if (!data) {
        return failure(new InternalError('Supabase did not return pass row'));
      }

      return success(this.mapPass(data));
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError('Unexpected error creating pass', error)
      );
    }
  }

  async findByUserId(userId: string): Promise<Result<Pass[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from('interactions')
        .select('id, from_user, to_user, created_at')
        .eq('from_user', userId)
        .eq('action', 'pass')
        .order('created_at', { ascending: false });

      if (error) {
        return failure(
          new InternalError(
            `Failed to query passes: ${this.formatSupabaseError(error)}`
          )
        );
      }

      return success((data ?? []).map((row) => this.mapPass(row)));
    } catch (error) {
      return failure(
        new InternalError('Unexpected error fetching passes', error)
      );
    }
  }

  async hasPassed(
    userId: string,
    targetUserId: string
  ): Promise<Result<boolean, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('interactions')
        .select('id')
        .eq('from_user', userId)
        .eq('to_user', targetUserId)
        .eq('action', 'pass')
        .maybeSingle();

      if (error) {
        return failure(
          new InternalError(
            `Failed to verify pass: ${this.formatSupabaseError(error)}`
          )
        );
      }

      return success(Boolean(data));
    } catch (error) {
      return failure(
        new InternalError('Unexpected error checking pass', error)
      );
    }
  }

  private mapPass(row: InteractionRow): Pass {
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
        'SupabasePassRepository requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
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
