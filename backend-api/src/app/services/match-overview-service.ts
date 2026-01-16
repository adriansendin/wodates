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
    isBot?: boolean;
  } | null;
  lastMessage?: Message;
  unreadCount: number;
};

type UserRow = {
  id: string;
  bio: string | null;
  birthDate: string | null;
  gender: string | null;
  is_bot: boolean | null;
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
    config?: Partial<SupabaseConfig>
  ) {
    const resolved = this.resolveConfig(config);
    this.client = createClient(resolved.url, resolved.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async list(
    userId: string
  ): Promise<Result<MatchOverviewResult, DomainError>> {
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
      const isBlockedResult = await this.blockedUserRepository.isBlocked(
        userId,
        otherUserId
      );
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
      .select('id, bio, birthDate, gender, is_bot')
      .in('id', Array.from(otherUserIds));

    if (userError) {
      return failure(
        new InternalError(
          `Failed to fetch match participants: ${this.formatSupabaseError(userError)}`
        )
      );
    }

    // Get name and email from auth.users
    const authUsersResult = await this.getAuthUsers(Array.from(otherUserIds));
    if (!authUsersResult.success) {
      return failure(authUsersResult.error);
    }

    const userMap = new Map<string, UserRow>();
    (userRows as UserRow[] | null | undefined)?.forEach((row) =>
      userMap.set(row.id, row)
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
        1
      );

      if (lastMessageResult.success && lastMessageResult.data.length > 0) {
        lastMessage = lastMessageResult.data[0];
      }

      const photoUrl = otherUserRow
        ? await this.getMainPhotoUrl(otherUserRow.id)
        : null;

      // Calculate unread count
      const unreadCount = await this.calculateUnreadCount(
        match.id,
        userId,
        otherUserId
      );

      overviews.push({
        ...(match as any),
        otherUser:
          otherUserRow && otherAuthUser
            ? {
                id: otherUserRow.id,
                name: this.extractDisplayName(otherAuthUser),
                bio: otherUserRow.bio,
                photoUrl: photoUrl ? this.normalizeUrl(photoUrl) : null,
                birthDate: otherUserRow.birthDate,
                gender: otherUserRow.gender,
                isBot: otherUserRow.is_bot ?? false,
              }
            : null,
        lastMessage: lastMessage ?? undefined,
        unreadCount,
      });
    }

    // Sort newer matches first
    overviews.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
  private async getAuthUsers(
    userIds: string[]
  ): Promise<Result<AuthUserRow[], DomainError>> {
    try {
      // Fetch each user individually in parallel using getUserById
      const userPromises = userIds.map(async (userId) => {
        const { data, error } =
          await this.client.auth.admin.getUserById(userId);

        if (error || !data?.user) {
          console.warn(
            `[MatchOverviewService] Could not fetch auth user ${userId}`,
            error
          );
          return null;
        }

        return {
          id: data.user.id,
          email: data.user.email ?? '',
          raw_user_meta_data: data.user.user_metadata as Record<
            string,
            unknown
          > | null,
        };
      });

      const results = await Promise.all(userPromises);

      // Filter out null results (failed fetches)
      const validUsers = results.filter(
        (user): user is AuthUserRow => user !== null
      );

      return success(validUsers);
    } catch (error) {
      return failure(
        new InternalError('Unexpected error fetching auth users', error)
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

  private async getMainPhotoUrl(userId: string): Promise<string | null> {
    try {
      const { data, error } = await this.client
        .from('user_photos')
        .select('public_url')
        .eq('user_id', userId)
        .eq('is_main', true)
        .single();

      if (error || !data) {
        return null;
      }

      return this.normalizeUrl(data.public_url);
    } catch {
      return null;
    }
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
        'MatchOverviewService requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
      );
    }

    return {
      url,
      serviceRoleKey,
    };
  }

  /**
   * Calculates the number of unread messages for a user in a match/chat
   * IMPORTANT: Only counts messages sent by the OTHER USER, NOT by the current user
   * Unread messages are those sent by the other user after the last read message
   * Uses efficient SQL count query instead of loading all messages
   */
  private async calculateUnreadCount(
    matchId: string,
    userId: string,
    otherUserId: string
  ): Promise<number> {
    try {
      // Get the last read timestamp for this user
      const lastReadResult = await this.matchRepository.getLastReadAt(
        matchId,
        userId
      );

      // Treat repository failures as "never read" - count all messages from other user
      // This prevents badge bouncing due to intermittent repository failures
      const lastReadAt = lastReadResult.success ? lastReadResult.data : null;

      if (!lastReadResult.success) {
        // Repository failure treated as "never read" - stable fallback for unread count calculation
      }

      if (lastReadAt === null) {
        // User has never read any messages, count all messages from the other user
        const { count, error } = await this.client
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('chat_id', matchId)
          .eq('sender_id', otherUserId);

        if (error) {
          console.error(
            `[MatchOverviewService] Error counting unread messages: ${this.formatSupabaseError(error)}`
          );
          return 0;
        }

        // Count all messages since user has never read any
        return count ?? 0;
      }

      // Count messages from the other user that were sent AFTER the last read timestamp
      const { count, error } = await this.client
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', matchId)
        .eq('sender_id', otherUserId)
        .gt('created_at', lastReadAt.toISOString()); // Use > to exclude messages sent at exactly the same time

      if (error) {
        console.error(
          `[MatchOverviewService] Error counting unread messages: ${this.formatSupabaseError(error)}`
        );
        return 0;
      }

      const unreadCount = count ?? 0;

      // Successfully calculated unread count with timestamp filter

      // Safety check: ensure we're only counting messages from otherUserId, not from userId
      if (otherUserId === userId) {
        console.error(
          `[MatchOverviewService] ERROR: otherUserId equals userId! This should never happen. Match: ${matchId}, User: ${userId}`
        );
        return 0;
      }

      return unreadCount;
    } catch (error) {
      // On any error, return 0 to avoid breaking the matches list
      console.error(
        `[MatchOverviewService] Error calculating unread count for match ${matchId}:`,
        error
      );
      return 0;
    }
  }

  /**
   * Marks all messages in a match/chat as read for a user
   * Updates last_read_at to current server timestamp (ignores client timestamp for clock drift protection)
   * This ensures that when calculating unreadCount, we know the user has seen all messages up to this point
   */
  async markAsRead(
    matchId: string,
    userId: string,
    _readAt?: Date
  ): Promise<Result<void, DomainError>> {
    try {
      // Always use server time for consistency and protection against clock drift
      // Client _readAt is accepted for API compatibility but ignored
      const timestamp = new Date();

      // Update last_read_at timestamp
      const updateResult = await this.matchRepository.updateLastReadAt(
        matchId,
        userId,
        timestamp
      );

      if (!updateResult.success) {
        return failure(updateResult.error);
      }

      // Successfully marked messages as read using server timestamp

      return success(undefined);
    } catch (error) {
      return failure(
        new InternalError('Failed to mark messages as read', error)
      );
    }
  }

  private formatSupabaseError(error: unknown): string {
    if (error && typeof error === 'object') {
      const message = (error as { message?: unknown }).message;
      const details = (error as { details?: unknown }).details;
      const hint = (error as { hint?: unknown }).hint;

      return [message, details, hint]
        .filter(
          (segment): segment is string =>
            typeof segment === 'string' && segment.trim().length > 0
        )
        .join(' | ');
    }

    return typeof error === 'string' ? error : 'Unknown Supabase error';
  }
}
