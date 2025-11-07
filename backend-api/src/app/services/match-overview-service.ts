import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Match } from '../../domain/entities/Match';
import { Message } from '../../domain/entities/Message';
import { Result, failure, success } from '../../domain/Result';
import { DomainError, InternalError } from '../../domain/errors/DomainError';
import { MatchRepository } from '../../domain/repositories/MatchRepository';
import { MessageRepository } from '../../domain/repositories/MessageRepository';
import { BlockedUserRepository } from '../../domain/repositories/BlockedUserRepository';

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

type MatchOverviewResult = {
  matches: MatchOverview[];
  activeChatsCount: number;
};

export class MatchOverviewService {
  private readonly client: SupabaseClient;

  constructor(
    private matchRepository: MatchRepository,
    private messageRepository: MessageRepository,
    private blockedUserRepository: BlockedUserRepository,
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

  async list(userId: string): Promise<Result<MatchOverviewResult, DomainError>> {
    const matchesResult = await this.matchRepository.findByUserId(userId);
    if (!matchesResult.success) {
      return failure(matchesResult.error);
    }

    const matches = matchesResult.data;
    
    // Get active_chats_count for the current user
    const activeChatsCounts = await this.matchRepository.getActiveChatsCount([
      userId,
    ]);
    const userActiveChatsCount = activeChatsCounts.get(userId) ?? 0;

    if (matches.length === 0) {
      return success({
        matches: [],
        activeChatsCount: userActiveChatsCount,
      });
    }

    // Filter out matches where there's a block relationship
    const filteredMatches: Match[] = [];
    for (const match of matches) {
      const otherUserId =
        match.userId1 === userId ? match.userId2 : match.userId1;
      
      // Check if there's any block between users (bidirectional)
      const isBlockedResult = await this.blockedUserRepository.isBlocked(userId, otherUserId);
      if (isBlockedResult.success && !isBlockedResult.data) {
        // No block exists, include this match
        filteredMatches.push(match);
      }
    }

    if (filteredMatches.length === 0) {
      return success({
        matches: [],
        activeChatsCount: userActiveChatsCount,
      });
    }

    const otherUserIds = new Set<string>();

    for (const match of filteredMatches) {
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

    for (const match of filteredMatches) {
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

    return success({
      matches: overviews,
      activeChatsCount: userActiveChatsCount,
    });
  }

  /**
   * Obtiene los datos de autenticación (name, email) para múltiples usuarios desde auth.users
   * Usa getUserById para obtener solo los usuarios necesarios de forma eficiente
   * 
   * @param userIds - Array de IDs de usuarios a obtener
   * @returns Result con los datos de auth de los usuarios solicitados
   */
  private async getAuthUsers(userIds: string[]): Promise<Result<AuthUserRow[], DomainError>> {
    try {
      // Fetch each user individually in parallel using getUserById
      const userPromises = userIds.map(async (userId) => {
        const { data, error } = await this.client.auth.admin.getUserById(userId);
        
        if (error || !data?.user) {
          console.warn(`[MatchOverviewService] Could not fetch auth user ${userId}`, error);
          return null;
        }

        return {
          id: data.user.id,
          email: data.user.email ?? '',
          raw_user_meta_data: data.user.user_metadata as Record<string, unknown> | null,
        };
      });

      const results = await Promise.all(userPromises);
      
      // Filter out null results (failed fetches)
      const validUsers = results.filter((user): user is AuthUserRow => user !== null);

      return success(validUsers);
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
