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
  // email and name are no longer in public.users, they come from auth.users
  birthDate: string | null;
  gender: Gender | null;
  looking_for: LookingForValue | null;
  min_age: number | null;
  max_age: number | null;
  bio: string | null;
  city: string | null;
  avatar_url: string | null;
  show_in_feed: boolean | null;
};

export type UserProfile = {
  id: string;
  name: string; // Retrieved from auth.users.raw_user_meta_data.display_name
  email: string; // Retrieved from auth.users.email
  birthDate: string | null;
  gender: Gender | null;
  looking_for: LookingForValue | null;
  min_age: number | null;
  max_age: number | null;
  bio: string | null;
  city: string | null;
  avatarUrl: string | null;
  show_in_feed: boolean | null;
};

export type UpdateUserProfileInput = {
  birthDate?: string | null;
  gender?: Gender | null;
  looking_for?: LookingForValue | null;
  min_age?: number | null;
  max_age?: number | null;
  bio?: string | null;
  city?: string | null;
  avatarUrl?: string | null;
  show_in_feed?: boolean | null;
};

/**
 * SupabaseUserService - Gestión de perfiles de usuario
 * 
 * ARQUITECTURA DE DATOS DESPUÉS DE MIGRACIÓN:
 * - public.users: bio, preferences, dates, city, etc. (datos del perfil)
 * - auth.users.email: email del usuario
 * - auth.users.raw_user_meta_data.display_name: nombre del usuario
 * 
 * IMPORTANTE: Solo el backend con SERVICE_ROLE_KEY puede acceder a auth.users
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
      // Get profile data from public.users
      const profile = await this.ensureProfileRow(userId);
      
      // Get name and email from auth.users
      const authUser = await this.getAuthUser(userId);
      
      return this.mapRow(profile, authUser);
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
      if ('avatarUrl' in input) {
        updatePayload.avatar_url = this.sanitizeAvatarUrl(input.avatarUrl);
      }
      if ('show_in_feed' in input) {
        updatePayload.show_in_feed = input.show_in_feed ?? null;
      }

      if (Object.keys(updatePayload).length === 0) {
        // Get auth user data even if no profile updates
        const authUser = await this.getAuthUser(userId);
        return this.mapRow(profile, authUser);
      }

      const { data, error } = await this.client
        .from('users')
        .update(updatePayload)
        .eq('id', userId)
        .select(
          'id, birthDate, gender, looking_for, min_age, max_age, bio, city, avatar_url, show_in_feed',
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

      // Get name and email from auth.users
      const authUser = await this.getAuthUser(userId);
      
      return this.mapRow(data as UserProfileRow, authUser);
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
        'id, birthDate, gender, looking_for, min_age, max_age, bio, city, avatar_url, show_in_feed',
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
        'id, birthDate, gender, looking_for, min_age, max_age, bio, city, avatar_url, show_in_feed',
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

    const avatarUrl = this.resolveAvatarUrl(metadata);

    return {
      id: userId,
      // name and email are no longer stored in public.users
      birthDate,
      gender,
      looking_for: null,
      min_age: null,
      max_age: null,
      bio,
      city,
      avatar_url: avatarUrl,
      show_in_feed: true, // Default to true as per database schema
    };
  }

  /**
   * Obtiene name y email desde auth.users usando service role
   * 
   * @param userId - ID del usuario
   * @returns {name, email} - name viene de raw_user_meta_data.display_name, email de auth.users.email
   */
  private async getAuthUser(userId: string): Promise<{ name: string; email: string }> {
    const { data, error } = await this.client.auth.admin.getUserById(userId);
    if (error) {
      console.error('[SupabaseUserService] getAuthUser failed', {
        userId,
        error,
      });
      throw new InternalError(
        `Unable to get auth user: ${this.formatSupabaseError(error)}`,
        error,
      );
    }

    const user = data?.user;
    if (!user) {
      throw new InternalError('Auth user not found');
    }

    const metadata = user.user_metadata as Record<string, unknown> | null;
    const email = user.email ?? '';
    
    // Get display_name from raw_user_meta_data (this is where we store the user's name)
    const displayName =
      metadata && typeof metadata.display_name === 'string'
        ? metadata.display_name.trim()
        : '';

    const name = displayName || email || 'User';

    return { name, email };
  }


  private mapRow(row: UserProfileRow, authUser: { name: string; email: string }): UserProfile {
    return {
      id: row.id,
      name: authUser.name, // From auth.users.raw_user_meta_data.display_name
      email: authUser.email, // From auth.users.email
      birthDate: row.birthDate,
      gender: row.gender,
      looking_for: row.looking_for,
      min_age: row.min_age,
      max_age: row.max_age,
      bio: row.bio,
      city: row.city,
      avatarUrl: this.sanitizeAvatarUrl(row.avatar_url),
      show_in_feed: row.show_in_feed,
    };
  }

  private resolveAvatarUrl(
    metadata: Record<string, unknown> | null,
  ): string | null {
    if (!metadata) {
      return null;
    }

    const candidateKeys = [
      'avatar_url',
      'avatarUrl',
      'picture',
      'photoUrl',
      'image',
      'image_url',
    ];

    for (const key of candidateKeys) {
      const value = metadata[key];
      if (typeof value === 'string') {
        const sanitized = this.sanitizeAvatarUrl(value);
        if (sanitized) {
          return sanitized;
        }
      }
    }

    return null;
  }

  private sanitizeAvatarUrl(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const url = new URL(trimmed);
      return url.toString();
    } catch {
      return null;
    }
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

  /**
   * Upload user avatar to Supabase Storage
   * Uses SERVICE_ROLE_KEY for full access to storage
   * Only deletes previous avatar AFTER successful upload
   * 
   * @param userId - The user ID
   * @param buffer - Image file buffer
   * @param mimeType - MIME type of the image (image/jpeg or image/png)
   * @returns Public URL of the uploaded avatar
   */
  async uploadAvatar(
    userId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    try {
      const AVATAR_BUCKET = 'avatars';
      
      // Step 1: Generate unique filename: {userId}_{timestamp}.jpg
      const timestamp = Date.now();
      const extension = mimeType === 'image/png' ? 'png' : 'jpg';
      const fileName = `${userId}_${timestamp}.${extension}`;
      const filePath = `${userId}/${fileName}`;

      console.log(`[SupabaseUserService] Uploading avatar: ${filePath}, Size: ${Math.round(buffer.length / 1024)}KB`);

      // Step 2: Upload new avatar to Supabase Storage
      const { error } = await this.client.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: true, // Allow overwriting
        });

      if (error) {
        console.error('[SupabaseUserService] Error uploading to Supabase Storage:', error);
        throw new InternalError(
          `Failed to upload avatar: ${this.formatSupabaseError(error)}`,
          error,
        );
      }

      // Step 3: Get public URL
      const { data: publicUrlData } = this.client.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);

      if (!publicUrlData?.publicUrl) {
        throw new InternalError('Failed to get public URL for uploaded avatar');
      }

      const avatarUrl = publicUrlData.publicUrl;
      console.log(`[SupabaseUserService] Upload successful: ${avatarUrl}`);

      // Step 4: Update avatar_url in public.users table
      const { error: updateError } = await this.client
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', userId);

      if (updateError) {
        console.error('[SupabaseUserService] Error updating avatar_url in database:', updateError);
        throw new InternalError(
          `Failed to update user avatar: ${this.formatSupabaseError(updateError)}`,
          updateError,
        );
      }

      // Step 5: ONLY NOW delete previous avatars (after everything succeeded)
      await this.deleteUserAvatars(userId, filePath); // Exclude the new file

      return avatarUrl;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }

      throw new InternalError('Unexpected error uploading avatar', error);
    }
  }

  /**
   * Delete all avatar files for a specific user from Supabase Storage
   * EXCEPT the newly uploaded file
   * 
   * @param userId - The user ID
   * @param excludeFilePath - The file path to exclude from deletion (the new avatar)
   */
  private async deleteUserAvatars(userId: string, excludeFilePath: string): Promise<void> {
    try {
      const AVATAR_BUCKET = 'avatars';
      
      // List all files in the user's folder
      const { data: files, error: listError } = await this.client.storage
        .from(AVATAR_BUCKET)
        .list(userId);

      if (listError) {
        console.warn(`[SupabaseUserService] Could not list files for user ${userId}:`, listError);
        return; // Continue even if we can't list files
      }

      if (!files || files.length === 0) {
        console.log(`[SupabaseUserService] No existing avatars found for user ${userId}`);
        return;
      }

      // Filter out the newly uploaded file
      const filesToDelete = files.filter(file => {
        const filePath = `${userId}/${file.name}`;
        return filePath !== excludeFilePath;
      });

      if (filesToDelete.length === 0) {
        console.log(`[SupabaseUserService] No old avatars to delete for user ${userId}`);
        return;
      }

      // Create array of file paths to delete
      const filePaths = filesToDelete.map(file => `${userId}/${file.name}`);
      
      console.log(`[SupabaseUserService] Deleting ${filePaths.length} old avatar(s) for user ${userId}:`, filePaths);

      // Delete old files
      const { error: deleteError } = await this.client.storage
        .from(AVATAR_BUCKET)
        .remove(filePaths);

      if (deleteError) {
        console.warn(`[SupabaseUserService] Error deleting old avatars for user ${userId}:`, deleteError);
        // Don't throw error - cleanup failure shouldn't break the upload
      } else {
        console.log(`[SupabaseUserService] Successfully deleted ${filePaths.length} old avatar(s) for user ${userId}`);
      }
    } catch (error) {
      console.warn(`[SupabaseUserService] Unexpected error deleting old avatars for user ${userId}:`, error);
      // Don't throw error - cleanup failure shouldn't break the upload
    }
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
