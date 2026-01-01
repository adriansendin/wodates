import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { Match, CreateMatch } from '../../domain/entities/Match';
import { Result, success, failure } from '../../domain/Result';
import {
  DomainError,
  InternalError,
  NotFoundError,
} from '../../domain/errors/DomainError';
import { MatchRepository } from '../../domain/repositories/MatchRepository';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type ChatRow = {
  id: string;
  created_at: string;
  chat_participants: Array<{
    user_id: string;
  }> | null;
};

export class SupabaseMatchRepository implements MatchRepository {
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

  async create(matchData: CreateMatch): Promise<Result<Match, DomainError>> {
    try {
      // Return existing match if present
      const existingMatchResult = await this.getMatchBetween(
        matchData.userId1,
        matchData.userId2
      );

      if (!existingMatchResult.success) {
        return failure(existingMatchResult.error);
      }

      const existingMatch = existingMatchResult.data;
      if (existingMatch) {
        return success(existingMatch);
      }

      const chatId = randomUUID();
      const { data: chatRow, error: chatError } = await this.client
        .from('chats')
        .insert({ id: chatId })
        .select('id, created_at')
        .single();

      if (chatError) {
        return failure(
          new InternalError(
            `Failed to create chat: ${this.formatSupabaseError(chatError)}`
          )
        );
      }

      if (!chatRow) {
        return failure(new InternalError('Supabase did not return chat row'));
      }

      const participantsPayload = [
        { chat_id: chatRow.id, user_id: matchData.userId1 },
        { chat_id: chatRow.id, user_id: matchData.userId2 },
      ];

      const { error: participantsError } = await this.client
        .from('chat_participants')
        .insert(participantsPayload);

      if (participantsError) {
        // Attempt to rollback chat creation to avoid orphan records
        await this.client.from('chats').delete().eq('id', chatRow.id);

        return failure(
          new InternalError(
            `Failed to register chat participants: ${this.formatSupabaseError(participantsError)}`
          )
        );
      }

      const match: Match = {
        id: chatRow.id,
        userId1: matchData.userId1,
        userId2: matchData.userId2,
        createdAt: chatRow.created_at,
      };

      // Update active_chats_count for both users
      await this.updateActiveChatsCount([matchData.userId1, matchData.userId2]);

      return success(match);
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError('Unexpected error creating match', error)
      );
    }
  }

  async findByUserId(userId: string): Promise<Result<Match[], DomainError>> {
    try {
      const { data: participantRows, error: participantError } =
        await this.client
          .from('chat_participants')
          .select('chat_id')
          .eq('user_id', userId);

      if (participantError) {
        return failure(
          new InternalError(
            `Failed to query chat participations: ${this.formatSupabaseError(participantError)}`
          )
        );
      }

      const chatIds =
        participantRows?.map((row: { chat_id: string }) => row.chat_id) ?? [];

      if (chatIds.length === 0) {
        return success([]);
      }

      const { data: chatRows, error: chatError } = await this.client
        .from('chats')
        .select('id, created_at, chat_participants (user_id)')
        .in('id', chatIds)
        .order('created_at', { ascending: false });

      if (chatError) {
        return failure(
          new InternalError(
            `Failed to fetch chats: ${this.formatSupabaseError(chatError)}`
          )
        );
      }

      const matches =
        chatRows
          ?.map((row) => this.mapChatRowToMatch(row, userId))
          .filter((match): match is Match => Boolean(match)) ?? [];

      return success(matches);
    } catch (error) {
      return failure(
        new InternalError('Unexpected error fetching matches', error)
      );
    }
  }

  async findById(id: string): Promise<Result<Match, DomainError>> {
    try {
      const { data: chatRow, error } = await this.client
        .from('chats')
        .select('id, created_at, chat_participants (user_id)')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        return failure(
          new InternalError(
            `Failed to fetch chat: ${this.formatSupabaseError(error)}`
          )
        );
      }

      if (!chatRow) {
        return failure(new NotFoundError('Match not found'));
      }

      const match = this.mapChatRowToMatch(chatRow);
      if (!match) {
        return failure(
          new InternalError(
            'Chat does not have enough participants to be considered a match'
          )
        );
      }

      return success(match);
    } catch (error) {
      return failure(
        new InternalError('Unexpected error fetching match', error)
      );
    }
  }

  async existsBetweenUsers(
    userId1: string,
    userId2: string
  ): Promise<Result<boolean, DomainError>> {
    const matchResult = await this.getMatchBetween(userId1, userId2);
    if (!matchResult.success) {
      return failure(matchResult.error);
    }

    return success(Boolean(matchResult.data));
  }

  async delete(matchId: string): Promise<Result<void, DomainError>> {
    try {
      // Get user IDs before deleting participants (needed to update active_chats_count)
      const { data: participantRows, error: fetchError } = await this.client
        .from('chat_participants')
        .select('user_id')
        .eq('chat_id', matchId);

      if (fetchError) {
        return failure(
          new InternalError(
            `Failed to fetch chat participants: ${this.formatSupabaseError(fetchError)}`
          )
        );
      }

      const userIds =
        participantRows?.map((row: { user_id: string }) => row.user_id) ?? [];

      // Delete chat participants first (due to foreign key constraints)
      const { error: participantsError } = await this.client
        .from('chat_participants')
        .delete()
        .eq('chat_id', matchId);

      if (participantsError) {
        return failure(
          new InternalError(
            `Failed to delete chat participants: ${this.formatSupabaseError(participantsError)}`
          )
        );
      }

      // Delete messages associated with the chat
      const { error: messagesError } = await this.client
        .from('messages')
        .delete()
        .eq('chat_id', matchId);

      if (messagesError) {
        return failure(
          new InternalError(
            `Failed to delete messages: ${this.formatSupabaseError(messagesError)}`
          )
        );
      }

      // Delete the chat itself
      const { error: chatError } = await this.client
        .from('chats')
        .delete()
        .eq('id', matchId);

      if (chatError) {
        return failure(
          new InternalError(
            `Failed to delete chat: ${this.formatSupabaseError(chatError)}`
          )
        );
      }

      // Update active_chats_count for both users
      if (userIds.length > 0) {
        await this.updateActiveChatsCount(userIds);
      }

      return success(undefined);
    } catch (error) {
      return failure(
        new InternalError('Unexpected error deleting match', error)
      );
    }
  }

  async getMatchBetween(
    userId1: string,
    userId2: string
  ): Promise<Result<Match | null, DomainError>> {
    try {
      const { data: participantRows, error: participantError } =
        await this.client
          .from('chat_participants')
          .select('chat_id')
          .eq('user_id', userId1);

      if (participantError) {
        return failure(
          new InternalError(
            `Failed to query chat participations: ${this.formatSupabaseError(participantError)}`
          )
        );
      }

      const chatIds =
        participantRows?.map((row: { chat_id: string }) => row.chat_id) ?? [];

      if (chatIds.length === 0) {
        return success(null);
      }

      const { data: chatRows, error: chatError } = await this.client
        .from('chats')
        .select('id, created_at, chat_participants (user_id)')
        .in('id', chatIds);

      if (chatError) {
        return failure(
          new InternalError(
            `Failed to fetch chats: ${this.formatSupabaseError(chatError)}`
          )
        );
      }

      const matchRow = chatRows?.find((row) => {
        const participants = row.chat_participants ?? [];
        if (participants.length < 2) {
          return false;
        }

        const participantIds = new Set(participants.map((p) => p.user_id));
        return participantIds.has(userId1) && participantIds.has(userId2);
      });

      if (!matchRow) {
        return success(null);
      }

      const match = this.mapChatRowToMatch(matchRow);
      if (!match) {
        return failure(
          new InternalError(
            'Chat does not have enough participants to be considered a match'
          )
        );
      }

      return success(match);
    } catch (error) {
      return failure(
        new InternalError('Unexpected error verifying match', error)
      );
    }
  }

  private mapChatRowToMatch(
    row: ChatRow,
    preferredUserId?: string
  ): Match | null {
    const participants = row.chat_participants ?? [];
    if (participants.length < 2) {
      return null;
    }

    const participantIds = [
      ...new Set(participants.map((participant) => participant.user_id)),
    ];

    if (participantIds.length < 2) {
      return null;
    }

    let [userId1, userId2] = participantIds.slice(0, 2);

    if (preferredUserId && userId2 === preferredUserId) {
      [userId1, userId2] = [userId2, userId1];
    }

    if (!userId1 || !userId2) {
      return null; // garantía: no devolvemos match con ids vacíos
    }

    return {
      id: row.id,
      userId1,
      userId2,
      createdAt: row.created_at,
    };
  }

  private resolveConfig(config?: Partial<SupabaseConfig>): SupabaseConfig {
    const url = config?.url ?? process.env.SUPABASE_URL;
    const serviceRoleKey =
      config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SupabaseMatchRepository requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
      );
    }

    return {
      url,
      serviceRoleKey,
    };
  }

  /**
   * Gets active_chats_count for given users
   */
  async getActiveChatsCount(userIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();

    if (userIds.length === 0) {
      return result;
    }

    const { data, error } = await this.client
      .from('users')
      .select('id, active_chats_count')
      .in('id', userIds);

    if (error) {
      console.error(
        `[SupabaseMatchRepository] Failed to get active_chats_count:`,
        this.formatSupabaseError(error)
      );
      // Return map with 0 for all users on error
      for (const userId of userIds) {
        result.set(userId, 0);
      }
      return result;
    }

    for (const row of data ?? []) {
      result.set(row.id, row.active_chats_count ?? 0);
    }

    // Set 0 for users not found
    for (const userId of userIds) {
      if (!result.has(userId)) {
        result.set(userId, 0);
      }
    }

    return result;
  }

  /**
   * Updates active_chats_count for given users by counting their active chats
   * (chats that are not blocked)
   * Public method to be called from use cases
   */
  async updateActiveChatsCountForUsers(userIds: string[]): Promise<void> {
    await this.updateActiveChatsCount(userIds);
  }

  /**
   * Updates active_chats_count for given users by counting their active chats
   * (chats that are not blocked)
   */
  private async updateActiveChatsCount(userIds: string[]): Promise<void> {
    for (const userId of userIds) {
      // Count active chats: chats where user is participant AND not blocked
      const { data: participantRows, error: participantError } =
        await this.client
          .from('chat_participants')
          .select('chat_id')
          .eq('user_id', userId);

      if (participantError) {
        console.error(
          `[SupabaseMatchRepository] Failed to count chats for user ${userId}:`,
          this.formatSupabaseError(participantError)
        );
        continue;
      }

      const chatIds =
        participantRows?.map((row: { chat_id: string }) => row.chat_id) ?? [];

      if (chatIds.length === 0) {
        // No chats, set to 0
        await this.client
          .from('users')
          .update({ active_chats_count: 0 })
          .eq('id', userId);
        continue;
      }

      // Get all participants for these chats to check for blocks
      const { data: allParticipants, error: allParticipantsError } =
        await this.client
          .from('chat_participants')
          .select('chat_id, user_id')
          .in('chat_id', chatIds);

      if (allParticipantsError) {
        console.error(
          `[SupabaseMatchRepository] Failed to fetch all participants for user ${userId}:`,
          this.formatSupabaseError(allParticipantsError)
        );
        continue;
      }

      // Group participants by chat_id
      const chatParticipantsMap = new Map<string, string[]>();
      for (const participant of allParticipants ?? []) {
        const chatId = participant.chat_id;
        if (!chatParticipantsMap.has(chatId)) {
          chatParticipantsMap.set(chatId, []);
        }
        chatParticipantsMap.get(chatId)!.push(participant.user_id);
      }

      // Get all blocks involving this user
      const { data: blocks, error: blocksError } = await this.client
        .from('blocked_users')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

      if (blocksError) {
        console.error(
          `[SupabaseMatchRepository] Failed to fetch blocks for user ${userId}:`,
          this.formatSupabaseError(blocksError)
        );
        continue;
      }

      const blockedUserIds = new Set<string>();
      for (const block of blocks ?? []) {
        if (block.blocker_id === userId) {
          blockedUserIds.add(block.blocked_id);
        } else {
          blockedUserIds.add(block.blocker_id);
        }
      }

      // Get is_bot status for all other participants to exclude bot chats
      const otherParticipantIds = Array.from(
        new Set(
          Array.from(chatParticipantsMap.values())
            .flat()
            .filter((id) => id !== userId)
        )
      );

      const { data: userRows, error: usersError } = await this.client
        .from('users')
        .select('id, is_bot')
        .in('id', otherParticipantIds);

      if (usersError) {
        console.error(
          `[SupabaseMatchRepository] Failed to fetch user bot status for user ${userId}:`,
          this.formatSupabaseError(usersError)
        );
        continue;
      }

      const botUserIds = new Set<string>();
      for (const userRow of userRows ?? []) {
        if (userRow.is_bot === true) {
          botUserIds.add(userRow.id);
        }
      }

      // Count active chats (chats without blocks AND without bots)
      let activeChatsCount = 0;
      for (const [, participantIds] of chatParticipantsMap.entries()) {
        // Get the other participant (not the current user)
        const otherParticipantId = participantIds.find((id) => id !== userId);
        if (!otherParticipantId) {
          continue;
        }

        // Exclude chats with bots
        if (botUserIds.has(otherParticipantId)) {
          continue;
        }

        // Check if there's a block between this user and the other participant
        if (!blockedUserIds.has(otherParticipantId)) {
          activeChatsCount++;
        }
      }

      // Update active_chats_count
      const { error: updateError } = await this.client
        .from('users')
        .update({ active_chats_count: activeChatsCount })
        .eq('id', userId);

      if (updateError) {
        console.error(
          `[SupabaseMatchRepository] Failed to update active_chats_count for user ${userId}:`,
          this.formatSupabaseError(updateError)
        );
      }
    }
  }

  async updateLastReadMessage(
    chatId: string,
    userId: string,
    messageId: string | null
  ): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from('chat_participants')
        .update({ last_read_message_id: messageId })
        .eq('chat_id', chatId)
        .eq('user_id', userId);

      if (error) {
        return failure(
          new InternalError(
            `Failed to update last read message: ${this.formatSupabaseError(error)}`
          )
        );
      }

      return success(undefined);
    } catch (error) {
      return failure(
        new InternalError('Unexpected error updating last read message', error)
      );
    }
  }

  async getLastReadMessageId(
    chatId: string,
    userId: string
  ): Promise<Result<string | null, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('chat_participants')
        .select('last_read_message_id')
        .eq('chat_id', chatId)
        .eq('user_id', userId)
        .maybeSingle<{ last_read_message_id: string | null }>();

      if (error) {
        return failure(
          new InternalError(
            `Failed to get last read message: ${this.formatSupabaseError(error)}`
          )
        );
      }

      return success(data?.last_read_message_id ?? null);
    } catch (error) {
      return failure(
        new InternalError('Unexpected error getting last read message', error)
      );
    }
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
