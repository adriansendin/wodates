import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Message, CreateMessage } from '../../domain/entities/Message';
import { Result, success, failure } from '../../domain/Result';
import {
  DomainError,
  InternalError,
  NotFoundError,
} from '../../domain/errors/DomainError';
import { MessageRepository } from '../../domain/repositories/MessageRepository';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type MessageRow = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export class SupabaseMessageRepository implements MessageRepository {
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

  async create(message: CreateMessage): Promise<Result<Message, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('messages')
        .insert({
          chat_id: message.matchId,
          sender_id: message.senderId,
          content: message.content,
        })
        .select('id, chat_id, sender_id, content, created_at')
        .single<MessageRow>();

      if (error) {
        return failure(
          new InternalError(
            `Failed to insert message: ${this.formatSupabaseError(error)}`,
          ),
        );
      }

      if (!data) {
        return failure(new InternalError('Supabase did not return message row'));
      }

      return success(this.mapRowToMessage(data));
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError('Unexpected error creating message', error),
      );
    }
  }

  async findByMatchId(
    matchId: string,
    limit: number,
    before?: string,
  ): Promise<Result<Message[], DomainError>> {
    try {
      let beforeCreatedAt: string | undefined;

      if (before) {
        const beforeResult = await this.findById(before);
        if (beforeResult.success) {
          beforeCreatedAt = beforeResult.data.createdAt;
        }
      }

      let query = this.client
        .from('messages')
        .select('id, chat_id, sender_id, content, created_at')
        .eq('chat_id', matchId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (beforeCreatedAt) {
        query = query.lt('created_at', beforeCreatedAt);
      }

      const { data, error } = await query;

      if (error) {
        return failure(
          new InternalError(
            `Failed to fetch messages: ${this.formatSupabaseError(error)}`,
          ),
        );
      }

      if (!data) {
        return success([]);
      }

      return success(data.map((row) => this.mapRowToMessage(row)));
    } catch (error) {
      return failure(
        new InternalError('Unexpected error fetching messages', error),
      );
    }
  }

  async findById(id: string): Promise<Result<Message, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('messages')
        .select('id, chat_id, sender_id, content, created_at')
        .eq('id', id)
        .maybeSingle<MessageRow>();

      if (error) {
        return failure(
          new InternalError(
            `Failed to fetch message: ${this.formatSupabaseError(error)}`,
          ),
        );
      }

      if (!data) {
        return failure(new NotFoundError('Message not found'));
      }

      return success(this.mapRowToMessage(data));
    } catch (error) {
      return failure(
        new InternalError('Unexpected error fetching message', error),
      );
    }
  }

  private mapRowToMessage(row: MessageRow): Message {
    return {
      id: row.id,
      matchId: row.chat_id,
      senderId: row.sender_id,
      content: row.content,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  private resolveConfig(config?: Partial<SupabaseConfig>): SupabaseConfig {
    const url = config?.url ?? process.env.SUPABASE_URL;
    const serviceRoleKey =
      config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SupabaseMessageRepository requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
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
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .join(' | ');
    }

    return typeof error === 'string' ? error : 'Unknown Supabase error';
  }
}
