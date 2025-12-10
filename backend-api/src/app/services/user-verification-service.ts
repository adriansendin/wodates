import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Result, failure, success } from '../../domain/Result';
import {
  DomainError,
  InternalError,
  ValidationError,
} from '../../domain/errors/DomainError';
import { VerificationStatus } from './supabase-user-service';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type UserVerificationRequestRow = {
  id: string;
  user_id: string;
  photo_storage_path: string;
  created_at: string;
};

export type UserVerificationRequest = {
  id: string;
  user_id: string;
  photo_storage_path: string;
  created_at: string;
};

type CreateVerificationResult = {
  request: UserVerificationRequest;
  verification_status: VerificationStatus;
};

export const VERIFIED_BUCKET = 'verified_photo';
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
] as const;

export class UserVerificationService {
  private readonly client: SupabaseClient;

  constructor(config?: Partial<SupabaseConfig>) {
    const resolved = this.resolveConfig(config);
    this.client = createClient(resolved.url, resolved.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  async createRequest(
    userId: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<Result<CreateVerificationResult, DomainError>> {
    try {
      const currentStatus = await this.getUserVerificationStatus(userId);
      if (currentStatus === 'verifying') {
        return failure(
          new ValidationError('Verification is already pending for this user.')
        );
      }
      if (currentStatus === 'verified') {
        return failure(
          new ValidationError(
            'User is already verified and cannot submit again.'
          )
        );
      }

      const cleanupResult = await this.cleanupExistingRequests(userId);
      if (!cleanupResult.success) {
        return failure(cleanupResult.error);
      }

      if (
        !ALLOWED_MIME_TYPES.includes(
          mimeType as (typeof ALLOWED_MIME_TYPES)[number]
        )
      ) {
        return failure(
          new ValidationError(
            'Only JPEG, PNG or HEIC images are allowed for verification.'
          )
        );
      }

      const extension = this.resolveExtension(mimeType);
      const timestamp = Date.now();
      const storagePath = `${userId}/${userId}_${timestamp}.${extension}`;

      const { error: uploadError } = await this.client.storage
        .from(VERIFIED_BUCKET)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        return failure(
          new InternalError(
            `Failed to upload verification photo: ${this.formatSupabaseError(uploadError)}`,
            uploadError
          )
        );
      }

      const { data, error } = await this.client
        .from('user_verification_requests')
        .insert({
          user_id: userId,
          photo_storage_path: storagePath,
        })
        .select()
        .single();

      if (error) {
        return failure(
          new InternalError(
            `Failed to create verification request: ${this.formatSupabaseError(error)}`,
            error
          )
        );
      }

      const { error: updateStatusError } = await this.client
        .from('users')
        .update({ verification_status: 'verifying' })
        .eq('id', userId);

      if (updateStatusError) {
        return failure(
          new InternalError(
            `Failed to update user verification status: ${this.formatSupabaseError(updateStatusError)}`,
            updateStatusError
          )
        );
      }

      return success({
        request: this.mapRow(data as UserVerificationRequestRow),
        verification_status: 'verifying',
      });
    } catch (error) {
      return failure(
        new InternalError(
          'Unexpected error creating verification request',
          error instanceof Error ? error : new Error(String(error))
        )
      );
    }
  }

  private async cleanupExistingRequests(
    userId: string
  ): Promise<Result<void, DomainError>> {
    const { data, error } = await this.client
      .from('user_verification_requests')
      .select('id, photo_storage_path')
      .eq('user_id', userId);

    if (error) {
      return failure(
        new InternalError(
          `Failed to fetch existing verification requests: ${this.formatSupabaseError(error)}`,
          error
        )
      );
    }

    if (!data || data.length === 0) {
      return success(undefined);
    }

    const paths = data
      .map((row) => row.photo_storage_path)
      .filter((p): p is string => Boolean(p));

    if (paths.length > 0) {
      const { error: removeError } = await this.client.storage
        .from(VERIFIED_BUCKET)
        .remove(paths);

      if (removeError) {
        return failure(
          new InternalError(
            `Failed to delete previous verification photos: ${this.formatSupabaseError(removeError)}`,
            removeError
          )
        );
      }
    }

    const { error: deleteRowsError } = await this.client
      .from('user_verification_requests')
      .delete()
      .eq('user_id', userId);

    if (deleteRowsError) {
      return failure(
        new InternalError(
          `Failed to delete previous verification requests: ${this.formatSupabaseError(deleteRowsError)}`,
          deleteRowsError
        )
      );
    }

    return success(undefined);
  }

  private async getUserVerificationStatus(
    userId: string
  ): Promise<VerificationStatus> {
    const { data, error } = await this.client
      .from('users')
      .select('verification_status')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw new InternalError(
        `Failed to fetch user verification status: ${this.formatSupabaseError(error)}`,
        error
      );
    }

    return (data?.verification_status as VerificationStatus) ?? 'pending';
  }

  private resolveExtension(mimeType: string): string {
    if (mimeType === 'image/png') {
      return 'png';
    }
    if (mimeType === 'image/heic' || mimeType === 'image/heif') {
      return 'heic';
    }
    return 'jpg';
  }

  private resolveConfig(config?: Partial<SupabaseConfig>): SupabaseConfig {
    return {
      url: config?.url || process.env.SUPABASE_URL || '',
      serviceRoleKey:
        config?.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    };
  }

  private mapRow(row: UserVerificationRequestRow): UserVerificationRequest {
    return {
      id: row.id,
      user_id: row.user_id,
      photo_storage_path: row.photo_storage_path,
      created_at: row.created_at,
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
