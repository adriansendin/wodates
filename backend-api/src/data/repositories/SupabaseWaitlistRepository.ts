import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  WaitlistSignup,
  CreateWaitlistSignup,
} from '../../domain/entities/WaitlistSignup';
import { Result, success, failure } from '../../domain/Result';
import { DomainError, InternalError } from '../../domain/errors/DomainError';
import { WaitlistRepository } from '../../domain/repositories/WaitlistRepository';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type WaitlistRow = {
  id: string;
  city: string;
  email: string;
  created_at: string;
};

export class SupabaseWaitlistRepository implements WaitlistRepository {
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

  async createOrGet(
    signup: CreateWaitlistSignup
  ): Promise<
    Result<{ signup: WaitlistSignup; alreadyExisted: boolean }, DomainError>
  > {
    try {
      // Try to insert first
      const { data: insertedData, error: insertError } = await this.client
        .from('waitlist_signups')
        .insert({
          city: signup.city,
          email: signup.email,
        })
        .select('id, city, email, created_at')
        .single();

      if (insertError) {
        // Check if it's a unique constraint violation (email + city already exists)
        if (this.isUniqueViolation(insertError)) {
          // Fetch the existing record
          const { data: existingData, error: fetchError } = await this.client
            .from('waitlist_signups')
            .select('id, city, email, created_at')
            .eq('email', signup.email)
            .eq('city', signup.city)
            .single();

          if (fetchError) {
            return failure(
              new InternalError(
                `Failed to fetch existing waitlist signup: ${this.formatSupabaseError(fetchError)}`
              )
            );
          }

          if (!existingData) {
            return failure(
              new InternalError(
                'Unique constraint violation but record not found'
              )
            );
          }

          // Return existing record with alreadyExisted flag
          return success({
            signup: this.mapWaitlistSignup(existingData),
            alreadyExisted: true,
          });
        }

        // Other database errors
        return failure(
          new InternalError(
            `Failed to create waitlist signup: ${this.formatSupabaseError(insertError)}`
          )
        );
      }

      if (!insertedData) {
        return failure(
          new InternalError('Supabase did not return waitlist signup row')
        );
      }

      // New record created successfully
      return success({
        signup: this.mapWaitlistSignup(insertedData),
        alreadyExisted: false,
      });
    } catch (error) {
      return failure(
        error instanceof DomainError
          ? error
          : new InternalError(
              'Unexpected error creating waitlist signup',
              error
            )
      );
    }
  }

  private mapWaitlistSignup(row: WaitlistRow): WaitlistSignup {
    return {
      id: row.id,
      city: row.city,
      email: row.email,
      createdAt: row.created_at,
    };
  }

  private resolveConfig(config?: Partial<SupabaseConfig>): SupabaseConfig {
    const url = config?.url ?? process.env.SUPABASE_URL;
    const serviceRoleKey =
      config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SupabaseWaitlistRepository requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
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
      return code === '23505'; // PostgreSQL unique constraint violation
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
