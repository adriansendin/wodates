import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ContactUsMessage,
  CreateContactUsMessage,
} from '../../domain/entities/ContactUsMessage';
import { Result, success, failure } from '../../domain/Result';
import {
  DomainError,
  InternalError,
} from '../../domain/errors/DomainError';
import { ContactUsMessageRepository } from '../../domain/repositories/ContactUsMessageRepository';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type ContactUsMessageRow = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export class SupabaseContactUsMessageRepository
  implements ContactUsMessageRepository
{
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
    message: CreateContactUsMessage
  ): Promise<Result<ContactUsMessage, DomainError>> {
    try {
      const { data, error } = await this.client
        .from('contact_us_messages')
        .insert({
          user_id: message.userId,
          content: message.content,
        })
        .select('id, user_id, content, created_at')
        .single<ContactUsMessageRow>();

      if (error) {
        return failure(
          new InternalError(
            `Failed to insert contact us message: ${this.formatSupabaseError(
              error
            )}`
          )
        );
      }

      if (!data) {
        return failure(
          new InternalError('Supabase did not return contact us message row')
        );
      }

      return success(this.mapRowToMessage(data));
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError('Unexpected error creating contact us message', error)
      );
    }
  }

  private mapRowToMessage(row: ContactUsMessageRow): ContactUsMessage {
    return {
      id: row.id,
      userId: row.user_id,
      content: row.content,
      createdAt: row.created_at,
    };
  }

  private resolveConfig(config?: Partial<SupabaseConfig>): SupabaseConfig {
    const url = config?.url ?? process.env.SUPABASE_URL;
    const serviceRoleKey =
      config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SupabaseContactUsMessageRepository requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
      );
    }

    return { url, serviceRoleKey };
  }

  private formatSupabaseError(error: unknown): string {
    if (error && typeof error === 'object') {
      const message = (error as { message?: string }).message;
      const details = (error as { details?: string }).details;
      const hint = (error as { hint?: string }).hint;
      return [message, details, hint]
        .filter((segment) => typeof segment === 'string' && segment.trim().length)
        .join(' | ');
    }

    return typeof error === 'string' ? error : 'Unknown Supabase error';
  }
}

