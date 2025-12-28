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
      // Get the last read message ID for this user
      const lastReadResult = await this.matchRepository.getLastReadMessageId(
        matchId,
        userId
      );

      if (!lastReadResult.success) {
        // If we can't get the last read message, assume no unread messages
        // This is a safe fallback
        return 0;
      }

      const lastReadMessageId = lastReadResult.data;

      if (lastReadMessageId === null) {
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

        return count ?? 0;
      }

      // Get the last read message to get its timestamp
      const lastReadMessageResult =
        await this.messageRepository.findById(lastReadMessageId);

      if (!lastReadMessageResult.success || !lastReadMessageResult.data) {
        // If the message doesn't exist anymore, count all messages from the other user
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

        return count ?? 0;
      }

      const lastReadMessage = lastReadMessageResult.data;
      const lastReadTimestamp = lastReadMessage.createdAt;
      const lastReadMessageIdFromMessage = lastReadMessage.id;
      const lastReadSenderId = lastReadMessage.senderId;

      // First, verify if the last read message is actually the latest message in the chat
      // If it is, then there are no unread messages
      const { data: latestMessageRow, error: latestMessageError } = await this.client
        .from('messages')
        .select('id, created_at')
        .eq('chat_id', matchId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string; created_at: string }>();

      if (latestMessageError) {
        console.error(
          `[MatchOverviewService] Error getting latest message: ${this.formatSupabaseError(latestMessageError)}`
        );
        // Continue with calculation as fallback
      } else if (latestMessageRow) {
        // If the last read message is the latest message in the chat, there are no unread messages
        if (latestMessageRow.id === lastReadMessageIdFromMessage) {
          console.log(
            `[MatchOverviewService] Last read message is the latest message in chat ${matchId}, unreadCount = 0`
          );
          return 0;
        }
      }

      console.log(
        `[MatchOverviewService] Calculating unread count - match: ${matchId}, userId: ${userId}, otherUserId: ${otherUserId}, lastReadMessageId: ${lastReadMessageIdFromMessage}, lastReadTimestamp: ${lastReadTimestamp}, lastReadSenderId: ${lastReadSenderId}`
      );

      // Use a more reliable method: get all messages from the other user that come after the last read message
      // and count them directly, ensuring we don't count the last read message itself
      const { data: allOtherUserMessages, error: messagesError } = await this.client
        .from('messages')
        .select('id, created_at')
        .eq('chat_id', matchId)
        .eq('sender_id', otherUserId)
        .gte('created_at', lastReadTimestamp)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      if (messagesError) {
        console.error(
          `[MatchOverviewService] Error fetching messages: ${this.formatSupabaseError(messagesError)}`
        );
        return 0;
      }

      if (!allOtherUserMessages || allOtherUserMessages.length === 0) {
        console.log(
          `[MatchOverviewService] No messages from other user found, unreadCount = 0`
        );
        return 0;
      }

      // Filter out the last read message and count only messages that come AFTER it
      const unreadMessages = allOtherUserMessages.filter(
        (msg) => {
          // Exclude the last read message itself
          if (msg.id === lastReadMessageIdFromMessage) {
            return false;
          }
          
          const msgTimestamp = new Date(msg.created_at).getTime();
          const lastReadTimestampMs = new Date(lastReadTimestamp).getTime();
          
          // Include messages with timestamp > lastReadTimestamp
          if (msgTimestamp > lastReadTimestampMs) {
            return true;
          }
          
          // Include messages with same timestamp but later ID (only if last read is from other user)
          if (
            msgTimestamp === lastReadTimestampMs &&
            lastReadSenderId === otherUserId &&
            msg.id > lastReadMessageIdFromMessage
          ) {
            return true;
          }
          
          return false;
        }
      );

      const unreadCount = unreadMessages.length;

      // Debug logging
      console.log(
        `[MatchOverviewService] Final unread count for match ${matchId}: ${unreadCount} (userId: ${userId}, otherUserId: ${otherUserId}, lastRead: ${lastReadMessageIdFromMessage}, lastReadSender: ${lastReadSenderId}, totalMessagesFromOtherUser: ${allOtherUserMessages.length})`
      );
      
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
   * Updates last_read_message_id to the latest message in the chat
   * This ensures that when calculating unreadCount, we know the user has seen all messages up to this point
   */
  async markAsRead(
    matchId: string,
    userId: string
  ): Promise<Result<void, DomainError>> {
    try {
      // Get the latest message in the chat using a direct SQL query to ensure we get the truly latest
      // This is more efficient and reliable than getting multiple messages and sorting
      const { data: latestMessageRow, error: latestMessageError } = await this.client
        .from('messages')
        .select('id, created_at')
        .eq('chat_id', matchId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string; created_at: string }>();

      if (latestMessageError) {
        return failure(
          new InternalError(
            `Failed to get latest message: ${this.formatSupabaseError(latestMessageError)}`
          )
        );
      }

      // If there are no messages, we can still mark as read (set to null)
      const lastMessageId = latestMessageRow?.id ?? null;

      // Update last_read_message_id
      const updateResult = await this.matchRepository.updateLastReadMessage(
        matchId,
        userId,
        lastMessageId
      );

      if (!updateResult.success) {
        return failure(updateResult.error);
      }

      console.log(
        `[MatchOverviewService] Marked messages as read for match ${matchId}, user ${userId}, lastMessageId: ${lastMessageId}`
      );

      return success(undefined);
    } catch (error) {
      return failure(
        new InternalError('Unexpected error marking messages as read', error)
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
