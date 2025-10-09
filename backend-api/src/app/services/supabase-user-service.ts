import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  DomainError,
  InternalError,
} from '../../domain/errors/DomainError';
import { LookingForValue } from '../../domain/entities/LookingFor';
import { GENDER_VALUES, Gender } from '../../domain/entities/User';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type UserProfileRow = {
  id: string;
  email: string | null;
  name: string | null;
  birthDate: string | null;
  gender: Gender | null;
  looking_for: LookingForValue | null;
  min_age: number | null;
  max_age: number | null;
  bio: string | null;
  city: string | null;
};

export type UserProfile = {
  id: string;
  name: string;
  birthDate: string | null;
  gender: Gender | null;
  looking_for: LookingForValue | null;
  min_age: number | null;
  max_age: number | null;
  bio: string | null;
  city: string | null;
};

export type UpdateUserProfileInput = {
  birthDate?: string | null;
  gender?: Gender | null;
  looking_for?: LookingForValue | null;
  min_age?: number | null;
  max_age?: number | null;
  bio?: string | null;
  city?: string | null;
};

/**
 * Service responsible for interacting with the Supabase `users` table.
 * It returns a curated profile payload without exposing sensitive columns.
 */
export class SupabaseUserService {
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

  async getProfile(userId: string): Promise<UserProfile> {
    try {
      const profile = await this.ensureProfileRow(userId);
      return this.mapRow(profile);
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }

      throw new InternalError('Unexpected error fetching user profile', error);
    }
  }

  async updateProfile(
    userId: string,
    input: UpdateUserProfileInput,
  ): Promise<UserProfile> {
    try {
      const profile = await this.ensureProfileRow(userId);

      const updatePayload: Record<string, unknown> = {};

      if ('birthDate' in input) {
        updatePayload.birthDate = input.birthDate ?? null;
      }
      if ('gender' in input) {
        updatePayload.gender = input.gender ?? null;
      }
      if ('looking_for' in input) {
        updatePayload.looking_for = input.looking_for ?? null;
      }
      if ('min_age' in input) {
        updatePayload.min_age = input.min_age ?? null;
      }
      if ('max_age' in input) {
        updatePayload.max_age = input.max_age ?? null;
      }
      if ('bio' in input) {
        updatePayload.bio = input.bio ?? null;
      }
      if ('city' in input) {
        updatePayload.city = input.city ?? null;
      }

      if (Object.keys(updatePayload).length === 0) {
        return this.mapRow(profile);
      }

      const { data, error } = await this.client
        .from('users')
        .update(updatePayload)
        .eq('id', userId)
        .select(
          'id, email, name, birthDate, gender, looking_for, min_age, max_age, bio, city',
        )
        .single();

      if (error) {
        console.error('[SupabaseUserService] updateProfile failed', {
          userId,
          input,
          error,
        });
        throw new InternalError(
          `Failed to update user profile: ${this.formatSupabaseError(error)}`,
          error,
        );
      }

      if (!data) {
        throw new InternalError('Supabase did not return updated profile');
      }

      return this.mapRow(data as UserProfileRow);
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }

      throw new InternalError('Unexpected error updating user profile', error);
    }
  }

  private async ensureProfileRow(userId: string): Promise<UserProfileRow> {
    const existingProfile = await this.findProfileRow(userId);
    if (existingProfile) {
      return existingProfile;
    }

    const defaults = await this.resolveAuthUserDefaults(userId);

    const { data, error } = await this.client
      .from('users')
      .upsert(defaults, { onConflict: 'id' })
      .select(
        'id, email, name, birthDate, gender, looking_for, min_age, max_age, bio, city',
      )
      .single();

    if (error) {
      console.error('[SupabaseUserService] ensureProfileRow upsert failed', {
        userId,
        defaults,
        error,
      });
      throw new InternalError(
        `Failed to create user profile record: ${this.formatSupabaseError(error)}`,
        error,
      );
    }

    if (!data) {
      throw new InternalError('Supabase did not return a profile row');
    }

    return data as UserProfileRow;
  }

  private async findProfileRow(
    userId: string,
  ): Promise<UserProfileRow | null> {
    const { data, error } = await this.client
      .from('users')
      .select(
        'id, email, name, birthDate, gender, looking_for, min_age, max_age, bio, city',
      )
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[SupabaseUserService] findProfileRow query failed', {
        userId,
        error,
      });
      throw new InternalError(
        `Failed to query user profile: ${this.formatSupabaseError(error)}`,
        error,
      );
    }

    return (data as UserProfileRow | null) ?? null;
  }

  private async resolveAuthUserDefaults(userId: string) {
    const { data, error } = await this.client.auth.admin.getUserById(userId);
    if (error) {
      console.error('[SupabaseUserService] resolveAuthUserDefaults failed', {
        userId,
        error,
      });
      throw new InternalError(
        `Unable to resolve Supabase auth user: ${this.formatSupabaseError(error)}`,
        error,
      );
    }

    const metadata = data?.user?.user_metadata as Record<string, unknown> | null;
    const email = data?.user?.email ?? undefined;

    if (!email) {
      throw new InternalError('Supabase auth user is missing mandatory email');
    }

    const name = this.resolveName(metadata, email);

    let birthDate: string | null = null;
    if (metadata && typeof metadata.birthDate === 'string') {
      const trimmed = metadata.birthDate.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        birthDate = trimmed;
      }
    }

    const gender = this.normalizeGender(metadata?.gender);

    const city =
      metadata && typeof metadata.city === 'string'
        ? metadata.city.trim() || null
        : null;

    const bio =
      metadata && typeof metadata.bio === 'string'
        ? metadata.bio.trim() || null
        : null;

    return {
      id: userId,
      name,
      email,
      birthDate,
      gender,
      looking_for: null,
      min_age: null,
      max_age: null,
      bio,
      city,
    };
  }

  private resolveName(
    metadata: Record<string, unknown> | null,
    email: string | undefined,
  ): string {
    if (metadata && typeof metadata.name === 'string') {
      const trimmed = metadata.name.trim();
      if (trimmed) {
        return trimmed;
      }
    }

    if (email && typeof email === 'string') {
      const trimmedEmail = email.trim();
      if (trimmedEmail) {
        return trimmedEmail;
      }
    }

    return 'User';
  }

  private mapRow(row: UserProfileRow): UserProfile {
    return {
      id: row.id,
      name: row.name ?? 'User',
      birthDate: row.birthDate,
      gender: row.gender,
      looking_for: row.looking_for,
      min_age: row.min_age,
      max_age: row.max_age,
      bio: row.bio,
      city: row.city,
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

  private normalizeGender(value: unknown): Gender | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');

    if (!normalized) {
      return null;
    }

    if (GENDER_VALUES.includes(normalized as Gender)) {
      return normalized as Gender;
    }

    return null;
  }

  private resolveConfig(config?: Partial<SupabaseConfig>): SupabaseConfig {
    const url = config?.url ?? process.env.SUPABASE_URL;
    const serviceRoleKey =
      config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SupabaseUserService requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
      );
    }

    return {
      url,
      serviceRoleKey,
    };
  }
}
