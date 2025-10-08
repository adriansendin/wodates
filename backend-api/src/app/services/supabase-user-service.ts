import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  DomainError,
  InternalError,
  NotFoundError,
} from '../../domain/errors/DomainError';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type UserProfileRow = {
  id: string;
  name: string | null;
  birthDate: string | null;
  gender: string | null;
  looking_for: string | null;
  min_age: number | null;
  max_age: number | null;
  bio: string | null;
  city: string | null;
};

export type UserProfile = {
  id: string;
  name: string;
  birthDate: string | null;
  gender: string | null;
  looking_for: string | null;
  min_age: number | null;
  max_age: number | null;
  bio: string | null;
  city: string | null;
};

export type UpdateUserProfileInput = {
  birthDate?: string | null;
  gender?: string | null;
  looking_for?: string | null;
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
      const existingProfile = await this.findProfileRow(userId);
      if (existingProfile) {
        return this.mapRow(existingProfile);
      }

      const defaultName = await this.resolveUserName(userId);
      const { data, error } = await this.client
        .from('users')
        .insert({
          id: userId,
          name: defaultName,
        })
        .select(
          'id, name, birthDate, gender, looking_for, min_age, max_age, bio, city',
        )
        .single();

      if (error) {
        throw new InternalError('Failed to create user profile record', error);
      }

      if (!data) {
        throw new InternalError('Supabase did not return a profile row');
      }

      return this.mapRow(data as UserProfileRow);
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
      const profile = await this.findProfileRow(userId);
      if (!profile) {
        throw new NotFoundError('User profile not found');
      }

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
          'id, name, birthDate, gender, looking_for, min_age, max_age, bio, city',
        )
        .single();

      if (error) {
        throw new InternalError('Failed to update user profile', error);
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

  private async findProfileRow(
    userId: string,
  ): Promise<UserProfileRow | null> {
    const { data, error } = await this.client
      .from('users')
      .select(
        'id, name, birthDate, gender, looking_for, min_age, max_age, bio, city',
      )
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw new InternalError('Failed to query user profile', error);
    }

    return (data as UserProfileRow | null) ?? null;
  }

  private async resolveUserName(userId: string): Promise<string> {
    const { data, error } = await this.client.auth.admin.getUserById(userId);
    if (error) {
      throw new InternalError('Unable to resolve Supabase auth user', error);
    }

    const metadata = data?.user?.user_metadata as Record<string, unknown> | null;
    const email = data?.user?.email ?? undefined;

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
