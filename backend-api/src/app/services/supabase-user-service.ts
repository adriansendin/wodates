import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DomainError, InternalError } from '../../domain/errors/DomainError';
import { LookingForValue } from '../../domain/entities/LookingFor';
import { GENDER_VALUES, Gender } from '../../domain/entities/User';
import {
  WantsChildren,
  CaresAboutPartnerChildren,
} from '../../domain/entities/FamilyPlan';
import {
  Smoking,
  CaresAboutPartnerSmoking,
} from '../../domain/entities/Habits';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

export type VerificationStatus =
  | 'pending'
  | 'verifying'
  | 'verified'
  | 'rejected';

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
  // avatar_url removed - photos are now stored in user_photos table
  show_bio_in_feed: boolean | null;
  verification_status: VerificationStatus;
  // Family plan
  has_children: boolean | null;
  wants_children: WantsChildren | null;
  cares_about_partner_children: CaresAboutPartnerChildren | null;
  // Habits
  smoking: Smoking | null;
  cares_about_partner_smoking: CaresAboutPartnerSmoking | null;
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
  show_bio_in_feed: boolean | null;
  verification_status: VerificationStatus;
  // Family plan
  has_children: boolean | null;
  wants_children: WantsChildren | null;
  cares_about_partner_children: CaresAboutPartnerChildren | null;
  // Habits
  smoking: Smoking | null;
  cares_about_partner_smoking: CaresAboutPartnerSmoking | null;
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
  show_bio_in_feed?: boolean | null;
  // Family plan
  has_children?: boolean | null;
  wants_children?: WantsChildren | null;
  cares_about_partner_children?: CaresAboutPartnerChildren | null;
  // Habits
  smoking?: Smoking | null;
  cares_about_partner_smoking?: CaresAboutPartnerSmoking | null;
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
    input: UpdateUserProfileInput
  ): Promise<UserProfile> {
    try {
      console.log('[SupabaseUserService] ===== UPDATE PROFILE =====');
      console.log('[SupabaseUserService] User ID:', userId);
      console.log('[SupabaseUserService] Input received:', input);
      console.log('[SupabaseUserService] Input keys:', Object.keys(input));
      console.log('[SupabaseUserService] Input values:', JSON.stringify(input));

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
        console.log('[SupabaseUserService] Processing min_age:', input.min_age);
        // Validar que min_age sea un número válido antes de guardar
        if (input.min_age !== null && input.min_age !== undefined) {
          if (
            typeof input.min_age !== 'number' ||
            isNaN(input.min_age) ||
            input.min_age < 18 ||
            input.min_age > 100
          ) {
            throw new InternalError(
              'min_age must be a valid number between 18 and 100'
            );
          }
          updatePayload.min_age = input.min_age;
          console.log(
            '[SupabaseUserService] min_age validated and added to updatePayload:',
            updatePayload.min_age
          );
        } else {
          updatePayload.min_age = null;
          console.log(
            '[SupabaseUserService] min_age is null/undefined, setting to null in updatePayload'
          );
        }
      } else {
        console.log('[SupabaseUserService] min_age NOT in input');
      }
      if ('max_age' in input) {
        console.log('[SupabaseUserService] Processing max_age:', input.max_age);
        // Validar que max_age sea un número válido antes de guardar
        if (input.max_age !== null && input.max_age !== undefined) {
          if (
            typeof input.max_age !== 'number' ||
            isNaN(input.max_age) ||
            input.max_age < 18 ||
            input.max_age > 100
          ) {
            throw new InternalError(
              'max_age must be a valid number between 18 and 100'
            );
          }
          updatePayload.max_age = input.max_age;
          console.log(
            '[SupabaseUserService] max_age validated and added to updatePayload:',
            updatePayload.max_age
          );
        } else {
          updatePayload.max_age = null;
          console.log(
            '[SupabaseUserService] max_age is null/undefined, setting to null in updatePayload'
          );
        }
      } else {
        console.log('[SupabaseUserService] max_age NOT in input');
      }
      if ('bio' in input) {
        updatePayload.bio = input.bio ?? null;
      }
      if ('city' in input) {
        // Validar que city sea un string válido antes de guardar
        if (input.city !== null && input.city !== undefined) {
          if (typeof input.city !== 'string' || input.city.trim() === '') {
            throw new InternalError('city must be a non-empty string');
          }
          updatePayload.city = input.city.trim();
        } else {
          updatePayload.city = null;
        }
      }
      // avatarUrl removed - photos are now stored in user_photos table
      // if ('avatarUrl' in input) {
      //   updatePayload.avatar_url = input.avatarUrl ?? null;
      // }
      if ('show_bio_in_feed' in input) {
        updatePayload.show_bio_in_feed = input.show_bio_in_feed ?? null;
      }
      // Family plan
      if ('has_children' in input) {
        updatePayload.has_children = input.has_children ?? null;
        console.log(
          '[SupabaseUserService] Processing has_children:',
          input.has_children,
          '->',
          updatePayload.has_children
        );
      } else {
        console.log('[SupabaseUserService] has_children NOT in input');
      }
      if ('wants_children' in input) {
        updatePayload.wants_children = input.wants_children ?? null;
        console.log(
          '[SupabaseUserService] Processing wants_children:',
          input.wants_children,
          '->',
          updatePayload.wants_children
        );
      } else {
        console.log('[SupabaseUserService] wants_children NOT in input');
      }
      if ('cares_about_partner_children' in input) {
        updatePayload.cares_about_partner_children =
          input.cares_about_partner_children ?? null;
        console.log(
          '[SupabaseUserService] Processing cares_about_partner_children:',
          input.cares_about_partner_children,
          '->',
          updatePayload.cares_about_partner_children
        );
      } else {
        console.log(
          '[SupabaseUserService] cares_about_partner_children NOT in input'
        );
      }
      // Habits
      if ('smoking' in input) {
        updatePayload.smoking = input.smoking ?? null;
        console.log(
          '[SupabaseUserService] Processing smoking:',
          input.smoking,
          '->',
          updatePayload.smoking
        );
      } else {
        console.log('[SupabaseUserService] smoking NOT in input');
      }
      if ('cares_about_partner_smoking' in input) {
        updatePayload.cares_about_partner_smoking =
          input.cares_about_partner_smoking ?? null;
        console.log(
          '[SupabaseUserService] Processing cares_about_partner_smoking:',
          input.cares_about_partner_smoking,
          '->',
          updatePayload.cares_about_partner_smoking
        );
      } else {
        console.log(
          '[SupabaseUserService] cares_about_partner_smoking NOT in input'
        );
      }

      console.log('[SupabaseUserService] Final updatePayload:', updatePayload);
      console.log(
        '[SupabaseUserService] updatePayload keys:',
        Object.keys(updatePayload)
      );
      console.log(
        '[SupabaseUserService] updatePayload JSON:',
        JSON.stringify(updatePayload)
      );

      if (Object.keys(updatePayload).length === 0) {
        console.log(
          '[SupabaseUserService] WARNING: updatePayload is empty, no fields to update'
        );
        // Get auth user data even if no profile updates
        const authUser = await this.getAuthUser(userId);
        return this.mapRow(profile, authUser);
      }

      console.log(
        '[SupabaseUserService] Executing UPDATE query on users table'
      );
      console.log('[SupabaseUserService] UPDATE SET:', updatePayload);
      console.log('[SupabaseUserService] WHERE id =', userId);

      const { data, error } = await this.client
        .from('users')
        .update(updatePayload)
        .eq('id', userId)
        .select(
          'id, birthDate, gender, looking_for, min_age, max_age, bio, city, show_bio_in_feed, verification_status, has_children, wants_children, cares_about_partner_children, smoking, cares_about_partner_smoking'
        )
        .single();

      if (error) {
        console.error('[SupabaseUserService] UPDATE query failed:', {
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
      } else {
        console.log('[SupabaseUserService] UPDATE query successful');
        console.log('[SupabaseUserService] Updated data returned:', {
          min_age: data?.min_age,
          max_age: data?.max_age,
          has_children: data?.has_children,
          wants_children: data?.wants_children,
          cares_about_partner_children: data?.cares_about_partner_children,
          smoking: data?.smoking,
          cares_about_partner_smoking: data?.cares_about_partner_smoking,
          bioLength: data?.bio?.length ?? 0,
          bioPreview: data?.bio ? data.bio.slice(0, 80) : null,
        });
      }

      if (error) {
        console.error('[SupabaseUserService] updateProfile failed', {
          userId,
          input,
          error,
        });
        throw new InternalError(
          `Failed to update user profile: ${this.formatSupabaseError(error)}`,
          error
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

  async deactivateAccount(userId: string): Promise<void> {
    try {
      await this.markAuthUserAsDeleted(userId);
      await this.hideUserFromFeed(userId);

      const partnerIds = await this.getActiveChatPartnerIds(userId);
      if (partnerIds.size > 0) {
        await this.blockChatPartners(userId, partnerIds);
      }
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }

      throw new InternalError(
        'Unexpected error deactivating user account',
        error
      );
    }
  }

  private async ensureProfileRow(userId: string): Promise<UserProfileRow> {
    const existingProfile = await this.findProfileRow(userId);
    if (existingProfile) {
      // Fix show_bio_in_feed if it's null (should be true by default)
      if (existingProfile.show_bio_in_feed === null) {
        console.warn(
          `[SupabaseUserService] Found user ${userId} with show_bio_in_feed = null. Fixing to true...`
        );
        const { error: updateError } = await this.client
          .from('users')
          .update({ show_bio_in_feed: true })
          .eq('id', userId);

        if (updateError) {
          console.error(
            `[SupabaseUserService] Failed to fix show_bio_in_feed for user ${userId}`,
            updateError
          );
          // Continue anyway, return the profile as-is
        } else {
          // Update the local object to reflect the fix
          existingProfile.show_bio_in_feed = true;
        }
      }
      return existingProfile;
    }

    const defaults = await this.resolveAuthUserDefaults(userId);

    // Use insert instead of upsert to avoid overwriting existing fields
    // If the profile already exists, we would have returned it above
    // This insert should only happen if the profile truly doesn't exist
    const { data, error } = await this.client
      .from('users')
      .insert(defaults)
      .select(
        'id, birthDate, gender, looking_for, min_age, max_age, bio, city, show_bio_in_feed, verification_status, has_children, wants_children, cares_about_partner_children, smoking, cares_about_partner_smoking'
      )
      .single();

    if (error) {
      // If the error is a duplicate key error (user already exists), try to fetch it again
      // This can happen in race conditions where the profile was created between findProfileRow and insert
      if (
        error.code === '23505' ||
        error.message?.includes('duplicate key') ||
        error.message?.includes('already exists')
      ) {
        console.warn(
          `[SupabaseUserService] Profile for user ${userId} was created between findProfileRow and insert. Fetching existing profile...`
        );
        const existingProfile = await this.findProfileRow(userId);
        if (existingProfile) {
          return existingProfile;
        }
      }

      console.error('[SupabaseUserService] ensureProfileRow insert failed', {
        userId,
        defaults,
        error,
      });
      throw new InternalError(
        `Failed to create user profile record: ${this.formatSupabaseError(error)}`,
        error
      );
    }

    if (!data) {
      throw new InternalError('Supabase did not return a profile row');
    }

    // Verify that show_bio_in_feed was set correctly
    if (data.show_bio_in_feed === null) {
      console.warn(
        `[SupabaseUserService] show_bio_in_feed was null after insert for user ${userId}. Fixing...`
      );
      const { error: updateError } = await this.client
        .from('users')
        .update({ show_bio_in_feed: true })
        .eq('id', userId);

      if (updateError) {
        console.error(
          `[SupabaseUserService] Failed to fix show_bio_in_feed after insert for user ${userId}`,
          updateError
        );
      } else {
        // Update the local object to reflect the fix
        (data as UserProfileRow).show_bio_in_feed = true;
      }
    }

    return data as UserProfileRow;
  }

  private async findProfileRow(userId: string): Promise<UserProfileRow | null> {
    const { data, error } = await this.client
      .from('users')
      .select(
        'id, birthDate, gender, looking_for, min_age, max_age, bio, city, show_bio_in_feed, verification_status, has_children, wants_children, cares_about_partner_children, smoking, cares_about_partner_smoking'
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
        error
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
        error
      );
    }

    const metadata = data?.user?.user_metadata as Record<
      string,
      unknown
    > | null;

    let birthDate: string | null = null;
    if (metadata && typeof metadata.birthDate === 'string') {
      const trimmed = metadata.birthDate.trim();
      // Accept both ISO datetime format (from registration) and date-only format
      if (trimmed.length > 0) {
        birthDate = trimmed;
      }
    }

    const gender = this.normalizeGender(metadata?.gender);

    // Get looking_for from metadata (stored during registration as lookingFor)
    let lookingFor: string | null = null;
    if (metadata && typeof metadata.lookingFor === 'string') {
      const trimmed = metadata.lookingFor.trim();
      if (trimmed.length > 0) {
        lookingFor = trimmed;
      }
    }

    const city =
      metadata && typeof metadata.city === 'string'
        ? metadata.city.trim() || null
        : metadata && typeof metadata.location === 'string'
          ? metadata.location.trim() || null
          : null;

    const bio =
      metadata && typeof metadata.bio === 'string'
        ? metadata.bio.trim() || null
        : null;

    return {
      id: userId,
      // name and email are no longer stored in public.users
      birthDate,
      gender,
      looking_for: lookingFor, // Get from metadata instead of always null
      min_age: null, // These are set during profile update, not registration
      max_age: null, // These are set during profile update, not registration
      bio,
      city,
      show_bio_in_feed: true, // Default to true as per database schema
      verification_status: 'pending',
    };
  }

  /**
   * Obtiene name y email desde auth.users usando service role
   *
   * @param userId - ID del usuario
   * @returns {name, email} - name viene de raw_user_meta_data.display_name, email de auth.users.email
   */
  private async getAuthUser(
    userId: string
  ): Promise<{ name: string; email: string }> {
    const { data, error } = await this.client.auth.admin.getUserById(userId);
    if (error) {
      console.error('[SupabaseUserService] getAuthUser failed', {
        userId,
        error,
      });
      throw new InternalError(
        `Unable to get auth user: ${this.formatSupabaseError(error)}`,
        error
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

  private mapRow(
    row: UserProfileRow,
    authUser: { name: string; email: string }
  ): UserProfile {
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
      avatarUrl: null, // Photos are now stored in user_photos table, not in users.avatar_url
      show_bio_in_feed: row.show_bio_in_feed,
      verification_status: row.verification_status ?? 'pending',
      // Family plan
      has_children: row.has_children ?? null,
      wants_children: row.wants_children ?? null,
      cares_about_partner_children: row.cares_about_partner_children ?? null,
      // Habits
      smoking: row.smoking ?? null,
      cares_about_partner_smoking: row.cares_about_partner_smoking ?? null,
    };
  }

  private async markAuthUserAsDeleted(userId: string): Promise<void> {
    const { error } = await this.client.auth.admin.deleteUser(userId, true);

    if (error) {
      throw new InternalError(
        `Failed to mark auth user as deleted: ${this.formatSupabaseError(error)}`,
        error
      );
    }
  }

  private async hideUserFromFeed(userId: string): Promise<void> {
    const { error } = await this.client
      .from('users')
      .update({ show_bio_in_feed: false })
      .eq('id', userId);

    if (error) {
      throw new InternalError(
        `Failed to hide user from feed: ${this.formatSupabaseError(error)}`,
        error
      );
    }
  }

  private async getActiveChatPartnerIds(userId: string): Promise<Set<string>> {
    const partnerIds = new Set<string>();

    const { data: chatRows, error: chatsError } = await this.client
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', userId);

    if (chatsError) {
      throw new InternalError(
        `Failed to fetch chat participations: ${this.formatSupabaseError(chatsError)}`,
        chatsError
      );
    }

    const chatIds =
      chatRows
        ?.map((row: { chat_id: string }) => row.chat_id)
        .filter(Boolean) ?? [];

    if (chatIds.length === 0) {
      return partnerIds;
    }

    const { data: participantRows, error: participantsError } =
      await this.client
        .from('chat_participants')
        .select('chat_id, user_id')
        .in('chat_id', chatIds);

    if (participantsError) {
      throw new InternalError(
        `Failed to resolve chat participants: ${this.formatSupabaseError(participantsError)}`,
        participantsError
      );
    }

    for (const row of participantRows ?? []) {
      if (row?.user_id && row.user_id !== userId) {
        partnerIds.add(row.user_id);
      }
    }

    return partnerIds;
  }

  private async blockChatPartners(
    userId: string,
    partnerIds: Set<string>
  ): Promise<void> {
    if (partnerIds.size === 0) {
      return;
    }

    const rows = Array.from(partnerIds).map((partnerId) => ({
      blocker_id: userId,
      blocked_id: partnerId,
    }));

    const { error } = await this.client.from('blocked_users').upsert(rows, {
      onConflict: 'blocker_id,blocked_id',
      ignoreDuplicates: true,
    });

    if (error) {
      throw new InternalError(
        `Failed to block chat partners: ${this.formatSupabaseError(error)}`,
        error
      );
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
    mimeType: string
  ): Promise<string> {
    try {
      const AVATAR_BUCKET = 'avatars';

      // Step 1: Generate unique filename: {userId}_{timestamp}.jpg
      const timestamp = Date.now();
      const extension = mimeType === 'image/png' ? 'png' : 'jpg';
      const fileName = `${userId}_${timestamp}.${extension}`;
      const filePath = `${userId}/${fileName}`;

      console.log(
        `[SupabaseUserService] Uploading avatar: ${filePath}, Size: ${Math.round(buffer.length / 1024)}KB`
      );

      // Step 2: Upload new avatar to Supabase Storage
      const { error } = await this.client.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: true, // Allow overwriting
        });

      if (error) {
        console.error(
          '[SupabaseUserService] Error uploading to Supabase Storage:',
          error
        );
        throw new InternalError(
          `Failed to upload avatar: ${this.formatSupabaseError(error)}`,
          error
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
      // NOTE: avatar_url column has been removed from users table
      // Photos are now stored in user_photos table instead
      // This method may be deprecated in favor of UserPhotoService
      // const { error: updateError } = await this.client
      //   .from('users')
      //   .update({ avatar_url: avatarUrl })
      //   .eq('id', userId);

      // if (updateError) {
      //   console.error(
      //     '[SupabaseUserService] Error updating avatar_url in database:',
      //     updateError
      //   );
      //   throw new InternalError(
      //     `Failed to update user avatar: ${this.formatSupabaseError(updateError)}`,
      //     updateError
      //   );
      // }

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
  private async deleteUserAvatars(
    userId: string,
    excludeFilePath: string
  ): Promise<void> {
    try {
      const AVATAR_BUCKET = 'avatars';

      // List all files in the user's folder
      const { data: files, error: listError } = await this.client.storage
        .from(AVATAR_BUCKET)
        .list(userId);

      if (listError) {
        console.warn(
          `[SupabaseUserService] Could not list files for user ${userId}:`,
          listError
        );
        return; // Continue even if we can't list files
      }

      if (!files || files.length === 0) {
        console.log(
          `[SupabaseUserService] No existing avatars found for user ${userId}`
        );
        return;
      }

      // Filter out the newly uploaded file
      const filesToDelete = files.filter((file) => {
        const filePath = `${userId}/${file.name}`;
        return filePath !== excludeFilePath;
      });

      if (filesToDelete.length === 0) {
        console.log(
          `[SupabaseUserService] No old avatars to delete for user ${userId}`
        );
        return;
      }

      // Create array of file paths to delete
      const filePaths = filesToDelete.map((file) => `${userId}/${file.name}`);

      console.log(
        `[SupabaseUserService] Deleting ${filePaths.length} old avatar(s) for user ${userId}:`,
        filePaths
      );

      // Delete old files
      const { error: deleteError } = await this.client.storage
        .from(AVATAR_BUCKET)
        .remove(filePaths);

      if (deleteError) {
        console.warn(
          `[SupabaseUserService] Error deleting old avatars for user ${userId}:`,
          deleteError
        );
        // Don't throw error - cleanup failure shouldn't break the upload
      } else {
        console.log(
          `[SupabaseUserService] Successfully deleted ${filePaths.length} old avatar(s) for user ${userId}`
        );
      }
    } catch (error) {
      console.warn(
        `[SupabaseUserService] Unexpected error deleting old avatars for user ${userId}:`,
        error
      );
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
        'SupabaseUserService requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
      );
    }

    return {
      url,
      serviceRoleKey,
    };
  }
}
