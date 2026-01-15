import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  DomainError,
  InternalError,
  NotFoundError,
} from '../../domain/errors/DomainError';
import { DOC_LOVE_EMAIL } from '../../domain/constants/system-users';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

/**
 * Helper service to get Doc Love's user ID
 *
 * Caches the UUID in memory after first lookup to avoid repeated queries.
 * Uses email as the identifier since Supabase generates UUIDs automatically.
 */
export class DocLoveHelper {
  private readonly client: SupabaseClient;
  private static cachedUserId: string | null = null;

  constructor(config?: Partial<SupabaseConfig>) {
    const resolved = this.resolveConfig(config);
    this.client = createClient(resolved.url, resolved.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Gets Doc Love's user ID (UUID)
   *
   * - Returns cached UUID if available
   * - Otherwise searches by email using Admin API
   * - Validates that the user exists and is marked as bot
   * - Caches the UUID for future calls
   *
   * @returns Doc Love's user ID (UUID)
   * @throws NotFoundError if Doc Love user doesn't exist
   * @throws InternalError if there's an error fetching the user
   */
  async getDocLoveUserId(): Promise<string> {
    // Return cached UUID if available
    if (DocLoveHelper.cachedUserId) {
      return DocLoveHelper.cachedUserId;
    }

    try {
      // Search for user by email using Admin API with pagination
      // listUsers() returns max 50 users per page, so we need to paginate
      const normalizedSearchEmail = DOC_LOVE_EMAIL.toLowerCase().trim();
      let page = 1;
      let perPage = 50;
      let docLoveUser: { id: string; email: string | undefined } | null = null;
      let totalUsersChecked = 0;

      console.log(
        `[DocLoveHelper] Searching for email "${DOC_LOVE_EMAIL}" (normalized: "${normalizedSearchEmail}")`
      );

      // Paginate through all users until we find Doc Love or run out of users
      while (!docLoveUser) {
        const { data, error } = await this.client.auth.admin.listUsers({
          page,
          perPage,
        });

        if (error) {
          throw new InternalError(
            `Failed to list users (page ${page}): ${this.formatSupabaseError(error)}`
          );
        }

        const users = data.users || [];
        totalUsersChecked += users.length;

        console.log(
          `[DocLoveHelper] Checking page ${page}: ${users.length} users (total checked: ${totalUsersChecked})`
        );

        // Find Doc Love by email (case-insensitive comparison)
        docLoveUser =
          users.find(
            (user) =>
              user.email?.toLowerCase().trim() === normalizedSearchEmail
          ) || null;

        // If found, break out of loop
        if (docLoveUser) {
          console.log(
            `[DocLoveHelper] Found Doc Love user on page ${page}: id=${docLoveUser.id}, email=${docLoveUser.email}`
          );
          break;
        }

        // If we got fewer users than perPage, we've reached the end
        if (users.length < perPage) {
          console.log(
            `[DocLoveHelper] Reached end of user list. Checked ${totalUsersChecked} users total.`
          );
          break;
        }

        // Move to next page
        page++;
      }

      if (!docLoveUser) {
        console.error(
          `[DocLoveHelper] Doc Love user not found after checking ${totalUsersChecked} users across ${page} page(s)`
        );
        throw new NotFoundError(
          `Doc Love user not found with email: ${DOC_LOVE_EMAIL}. Checked ${totalUsersChecked} users. Make sure the user exists in auth.users.`
        );
      }

      const userId = docLoveUser.id;
      const foundEmail = docLoveUser.email;

      console.log(
        `[DocLoveHelper] Found Doc Love user: id=${userId}, email=${foundEmail}`
      );

      // Validate that user exists in public.users and is marked as bot
      const { data: publicUser, error: publicUserError } = await this.client
        .from('users')
        .select('id, is_bot')
        .eq('id', userId)
        .single();

      if (publicUserError || !publicUser) {
        throw new InternalError(
          `Doc Love user found in auth.users but not in public.users: ${this.formatSupabaseError(publicUserError)}`
        );
      }

      if (!publicUser.is_bot) {
        console.warn(
          `[DocLoveHelper] User ${userId} (${DOC_LOVE_EMAIL}) is not marked as bot in public.users`
        );
        // Don't throw error, but log warning
      }

      // Cache the UUID
      DocLoveHelper.cachedUserId = userId;

      return userId;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }

      throw new InternalError(
        'Unexpected error fetching Doc Love user ID',
        error
      );
    }
  }

  /**
   * Clears the cached user ID
   * Useful for testing or if Doc Love is recreated
   */
  static clearCache(): void {
    DocLoveHelper.cachedUserId = null;
  }

  private resolveConfig(config?: Partial<SupabaseConfig>): SupabaseConfig {
    const url = config?.url ?? process.env.SUPABASE_URL;
    const serviceRoleKey =
      config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'DocLoveHelper requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
      );
    }

    return {
      url,
      serviceRoleKey,
    };
  }

  private formatSupabaseError(error: unknown): string {
    if (error && typeof error === 'object') {
      const maybeMessage = (error as { message?: unknown }).message;
      const maybeDetails = (error as { details?: unknown }).details;
      const maybeHint = (error as { hint?: unknown }).hint;

      const segments = [
        typeof maybeMessage === 'string' ? maybeMessage.trim() : null,
        typeof maybeDetails === 'string' ? maybeDetails.trim() : null,
        typeof maybeHint === 'string' ? maybeHint.trim() : null,
      ].filter((segment): segment is string => Boolean(segment));

      if (segments.length > 0) {
        return segments.join(' | ');
      }
    }

    return typeof error === 'string' ? error : 'Unknown Supabase error';
  }
}
