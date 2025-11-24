import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  BlockedUser,
  CreateBlockedUser,
} from '../../domain/entities/BlockedUser';
import { Result, success, failure } from '../../domain/Result';
import {
  ConflictError,
  DomainError,
  InternalError,
} from '../../domain/errors/DomainError';
import { BlockedUserRepository } from '../../domain/repositories/BlockedUserRepository';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type BlockedUserRow = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

export class SupabaseBlockedUserRepository implements BlockedUserRepository {
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
    blockedUserData: CreateBlockedUser
  ): Promise<Result<BlockedUser, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('blocked_users')
        .insert({
          blocker_id: blockedUserData.blockerId,
          blocked_id: blockedUserData.blockedId,
        })
        .select('blocker_id, blocked_id, created_at')
        .single();

      if (error) {
        if (this.isUniqueViolation(error)) {
          return failure(new ConflictError('User already blocked'));
        }

        return failure(
          new InternalError(
            `Failed to block user: ${this.formatSupabaseError(error)}`
          )
        );
      }

      if (!data) {
        return failure(
          new InternalError('Supabase did not return blocked_users row')
        );
      }

      return success(this.mapBlockedUser(data));
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError('Unexpected error blocking user', error)
      );
    }
  }

  async hasBlocked(
    blockerId: string,
    blockedId: string
  ): Promise<Result<boolean, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('blocked_users')
        .select('blocker_id')
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId)
        .maybeSingle();

      if (error) {
        return failure(
          new InternalError(
            `Failed to check block status: ${this.formatSupabaseError(error)}`
          )
        );
      }

      return success(Boolean(data));
    } catch (error) {
      return failure(
        new InternalError('Unexpected error checking block status', error)
      );
    }
  }

  async isBlocked(
    userId1: string,
    userId2: string
  ): Promise<Result<boolean, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('blocked_users')
        .select('blocker_id')
        .or(
          `and(blocker_id.eq.${userId1},blocked_id.eq.${userId2}),and(blocker_id.eq.${userId2},blocked_id.eq.${userId1})`
        );

      if (error) {
        return failure(
          new InternalError(
            `Failed to check block status: ${this.formatSupabaseError(error)}`
          )
        );
      }

      return success(data && data.length > 0);
    } catch (error) {
      return failure(
        new InternalError('Unexpected error checking block status', error)
      );
    }
  }

  async getBlockedByUser(
    userId: string
  ): Promise<Result<BlockedUser[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from('blocked_users')
        .select('blocker_id, blocked_id, created_at')
        .eq('blocker_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        return failure(
          new InternalError(
            `Failed to get blocked users: ${this.formatSupabaseError(error)}`
          )
        );
      }

      return success((data ?? []).map((row) => this.mapBlockedUser(row)));
    } catch (error) {
      return failure(
        new InternalError('Unexpected error fetching blocked users', error)
      );
    }
  }

  async delete(
    blockerId: string,
    blockedId: string
  ): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from('blocked_users')
        .delete()
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId);

      if (error) {
        return failure(
          new InternalError(
            `Failed to unblock user: ${this.formatSupabaseError(error)}`
          )
        );
      }

      return success(undefined);
    } catch (error) {
      return failure(
        new InternalError('Unexpected error unblocking user', error)
      );
    }
  }

  private mapBlockedUser(row: BlockedUserRow): BlockedUser {
    return {
      blockerId: row.blocker_id,
      blockedId: row.blocked_id,
      createdAt: row.created_at,
    };
  }

  private resolveConfig(config?: Partial<SupabaseConfig>): SupabaseConfig {
    const url = config?.url ?? process.env.SUPABASE_URL;
    const serviceRoleKey =
      config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SupabaseBlockedUserRepository requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
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
