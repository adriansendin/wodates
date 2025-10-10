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
        matchData.userId2,
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
            `Failed to create chat: ${this.formatSupabaseError(chatError)}`,
          ),
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
            `Failed to register chat participants: ${this.formatSupabaseError(participantsError)}`,
          ),
        );
      }

      const match: Match = {
        id: chatRow.id,
        userId1: matchData.userId1,
        userId2: matchData.userId2,
        createdAt: chatRow.created_at,
      };

      return success(match);
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError('Unexpected error creating match', error),
      );
    }
  }

  async findByUserId(userId: string): Promise<Result<Match[], DomainError>> {
    try {
      const { data: participantRows, error: participantError } = await this.client
        .from('chat_participants')
        .select('chat_id')
        .eq('user_id', userId);

      if (participantError) {
        return failure(
          new InternalError(
            `Failed to query chat participations: ${this.formatSupabaseError(participantError)}`,
          ),
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
            `Failed to fetch chats: ${this.formatSupabaseError(chatError)}`,
          ),
        );
      }

      const matches =
        chatRows
          ?.map((row) => this.mapChatRowToMatch(row, userId))
          .filter((match): match is Match => Boolean(match)) ?? [];

      return success(matches);
    } catch (error) {
      return failure(
        new InternalError('Unexpected error fetching matches', error),
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
            `Failed to fetch chat: ${this.formatSupabaseError(error)}`,
          ),
        );
      }

      if (!chatRow) {
        return failure(new NotFoundError('Match not found'));
      }

      const match = this.mapChatRowToMatch(chatRow);
      if (!match) {
        return failure(
          new InternalError(
            'Chat does not have enough participants to be considered a match',
          ),
        );
      }

      return success(match);
    } catch (error) {
      return failure(
        new InternalError('Unexpected error fetching match', error),
      );
    }
  }

  async existsBetweenUsers(
    userId1: string,
    userId2: string,
  ): Promise<Result<boolean, DomainError>> {
    const matchResult = await this.getMatchBetween(userId1, userId2);
    if (!matchResult.success) {
      return failure(matchResult.error);
    }

    return success(Boolean(matchResult.data));
  }

  private async getMatchBetween(
    userId1: string,
    userId2: string,
  ): Promise<Result<Match | null, DomainError>> {
    try {
      const { data: participantRows, error: participantError } = await this.client
        .from('chat_participants')
        .select('chat_id')
        .eq('user_id', userId1);

      if (participantError) {
        return failure(
          new InternalError(
            `Failed to query chat participations: ${this.formatSupabaseError(participantError)}`,
          ),
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
            `Failed to fetch chats: ${this.formatSupabaseError(chatError)}`,
          ),
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
            'Chat does not have enough participants to be considered a match',
          ),
        );
      }

      return success(match);
    } catch (error) {
      return failure(
        new InternalError('Unexpected error verifying match', error),
      );
    }
  }

  private mapChatRowToMatch(
    row: ChatRow,
    preferredUserId?: string,
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
        'SupabaseMatchRepository requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
      );
    }

    return {
      url,
      serviceRoleKey,
    };
  }

  private formatSupabaseError(error: unknown): string {
    if (error && typeof error === 'object') {
      const message = (error as { message?: string }).message;
      const details = (error as { details?: string }).details;
      const hint = (error as { hint?: string }).hint;

      return [message, details, hint]
        .filter(
          (segment) => typeof segment === 'string' && segment.trim().length,
        )
        .join(' | ');
    }

    return typeof error === 'string' ? error : 'Unknown Supabase error';
  }
}
