import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Match } from '../../domain/entities/Match';
import { Message } from '../../domain/entities/Message';
import { Result, failure, success } from '../../domain/Result';
import { DomainError, InternalError } from '../../domain/errors/DomainError';
import { MatchRepository } from '../../domain/repositories/MatchRepository';
import { MessageRepository } from '../../domain/repositories/MessageRepository';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type MatchOverview = Match & {
  otherUser: {
    id: string;
    name: string;
    bio?: string | null;
    photoUrl?: string | null;
    birthDate?: string | null;
    gender?: string | null;
  } | null;
  lastMessage?: Message;
  unreadCount: number;
};

type UserRow = {
  id: string;
  bio: string | null;
  birthDate: string | null;
  gender: string | null;
  avatar_url: string | null;
};

type AuthUserRow = {
  id: string;
  email: string;
  raw_user_meta_data: Record<string, unknown> | null;
};

export class MatchOverviewService {
  private readonly client: SupabaseClient;

  constructor(
    private matchRepository: MatchRepository,
    private messageRepository: MessageRepository,
    config?: Partial<SupabaseConfig>,
  ) {
    const resolved = this.resolveConfig(config);
    this.client = createClient(resolved.url, resolved.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async list(userId: string): Promise<Result<MatchOverview[], DomainError>> {
    const matchesResult = await this.matchRepository.findByUserId(userId);
    if (!matchesResult.success) {
      return failure(matchesResult.error);
    }

    const matches = matchesResult.data;
    if (matches.length === 0) {
      return success([]);
    }

    const otherUserIds = new Set<string>();

    for (const match of matches) {
      const otherUserId =
        match.userId1 === userId ? match.userId2 : match.userId1;
      otherUserIds.add(otherUserId);
    }

    // Get profile data from public.users
    const { data: userRows, error: userError } = await this.client
      .from('users')
      .select('id, bio, birthDate, gender, avatar_url')
      .in('id', Array.from(otherUserIds));

    if (userError) {
      return failure(
        new InternalError(
          `Failed to fetch match participants: ${this.formatSupabaseError(userError)}`,
        ),
      );
    }

    // Get name and email from auth.users
    const authUsersResult = await this.getAuthUsers(Array.from(otherUserIds));
    if (!authUsersResult.success) {
      return failure(authUsersResult.error);
    }

    const userMap = new Map<string, UserRow>();
    (userRows as UserRow[] | null | undefined)?.forEach((row) =>
      userMap.set(row.id, row),
    );

    const authUserMap = new Map<string, AuthUserRow>();
    authUsersResult.data.forEach((row) => authUserMap.set(row.id, row));

    const overviews: MatchOverview[] = [];

    for (const match of matches) {
      const otherUserId =
        match.userId1 === userId ? match.userId2 : match.userId1;
      const otherUserRow = otherUserId
        ? userMap.get(otherUserId) ?? null
        : null;
      const otherAuthUser = otherUserId
        ? authUserMap.get(otherUserId) ?? null
        : null;

      let lastMessage: Message | undefined;
      const lastMessageResult = await this.messageRepository.findByMatchId(
        match.id,
        1,
      );

      if (lastMessageResult.success && lastMessageResult.data.length > 0) {
        lastMessage = lastMessageResult.data[0];
      }

      overviews.push({
        ...(match as any),
        otherUser: otherUserRow && otherAuthUser
          ? {
              id: otherUserRow.id,
              name: this.extractDisplayName(otherAuthUser),
              bio: otherUserRow.bio,
              photoUrl: this.normalizeUrl(otherUserRow.avatar_url),
              birthDate: otherUserRow.birthDate,
              gender: otherUserRow.gender,
            }
          : null,
        lastMessage: lastMessage ?? undefined,
        unreadCount: 0,
      });
    }

    // Sort newer matches first
    overviews.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return success(overviews);
  }

  private async getAuthUsers(userIds: string[]): Promise<Result<AuthUserRow[], DomainError>> {
    try {
      // Use admin client to access auth.users table
      const { data, error } = await this.client.auth.admin.listUsers({
        page: 1,
        perPage: 1000, // Adjust as needed
      });

      if (error) {
        return failure(
          new InternalError(
            `Failed to fetch auth users: ${this.formatSupabaseError(error)}`,
          ),
        );
      }

      // Filter users by the requested IDs
      const filteredUsers = data.users
        .filter(user => userIds.includes(user.id))
        .map(user => ({
          id: user.id,
          email: user.email ?? '',
          raw_user_meta_data: user.user_metadata as Record<string, unknown> | null,
        }));

      return success(filteredUsers);
    } catch (error) {
      return failure(
        new InternalError('Unexpected error fetching auth users', error),
      );
    }
  }

  private extractDisplayName(authUser: AuthUserRow): string {
    const metadata = authUser.raw_user_meta_data;
    const displayName =
      metadata && typeof metadata.display_name === 'string'
        ? metadata.display_name.trim()
        : '';

    return displayName || authUser.email || 'User';
  }

  private normalizeUrl(value: string | null): string | null {
    if (!value) {
      return null;
    }

    try {
      return new URL(value).toString();
    } catch {
      return null;
    }
  }

  private resolveConfig(config?: Partial<SupabaseConfig>): SupabaseConfig {
    const url = config?.url ?? process.env.SUPABASE_URL;
    const serviceRoleKey =
      config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'MatchOverviewService requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
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
        .filter((segment): segment is string => typeof segment === 'string' && segment.trim().length > 0)
        .join(' | ');
    }

    return typeof error === 'string' ? error : 'Unknown Supabase error';
  }
}
