import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Result, failure, success } from '../../domain/Result';
import {
  DomainError,
  InternalError,
  NotFoundError,
  ValidationError,
} from '../../domain/errors/DomainError';
import { VERIFIED_BUCKET } from './user-verification-service';
import { VerificationStatus } from './supabase-user-service';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type AdminVerificationRequest = {
  id: string;
  user_id: string;
  photo_storage_path: string;
  created_at: string;
};

export type PendingVerification = AdminVerificationRequest & {
  signed_url: string;
};

export type VerificationDecision = {
  request: AdminVerificationRequest;
  verification_status: VerificationStatus;
};

export class AdminVerificationService {
  private readonly client: SupabaseClient;
  private readonly signedUrlTtlSeconds = 60 * 60; // 1 hour

  constructor(config?: Partial<SupabaseConfig>) {
    const resolved = this.resolveConfig(config);
    this.client = createClient(resolved.url, resolved.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  async getNextPending(): Promise<
    Result<PendingVerification | null, DomainError>
  > {
    try {
      const { data, error } = await this.client
        .from('user_verification_requests')
        .select(
          'id, user_id, photo_storage_path, created_at, users!inner(verification_status)'
        )
        .eq('users.verification_status', 'verifying')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        return failure(
          new InternalError(
            `Failed to fetch pending verification: ${this.formatSupabaseError(error)}`,
            error
          )
        );
      }

      if (!data) {
        return success(null);
      }

      const signedUrl = await this.createSignedUrl(data.photo_storage_path);

      return success({
        ...this.mapRow(data as AdminVerificationRequest),
        signed_url: signedUrl,
      });
    } catch (error) {
      if (error instanceof DomainError) {
        return failure(error);
      }
      return failure(
        new InternalError(
          'Unexpected error fetching next verification request',
          error
        )
      );
    }
  }

  async approveRequest(
    requestId: string
  ): Promise<Result<VerificationDecision, DomainError>> {
    return this.updateRequestStatus(requestId, 'verified');
  }

  async rejectRequest(
    requestId: string
  ): Promise<Result<VerificationDecision, DomainError>> {
    return this.updateRequestStatus(requestId, 'rejected');
  }

  private async updateRequestStatus(
    requestId: string,
    newStatus: 'verified' | 'rejected'
  ): Promise<Result<VerificationDecision, DomainError>> {
    if (!requestId) {
      return failure(new ValidationError('Request id is required'));
    }

    try {
      const { data: requestRow, error: requestError } = await this.client
        .from('user_verification_requests')
        .select('id, user_id, photo_storage_path, created_at')
        .eq('id', requestId)
        .maybeSingle();

      if (requestError) {
        return failure(
          new InternalError(
            `Failed to fetch verification request: ${this.formatSupabaseError(requestError)}`,
            requestError
          )
        );
      }

      if (!requestRow) {
        return failure(
          new NotFoundError(
            'Verification request not found or already processed'
          )
        );
      }

      const userStatus: VerificationStatus =
        newStatus === 'verified' ? 'verified' : 'rejected';

      const { error: updateUserError } = await this.client
        .from('users')
        .update({ verification_status: userStatus })
        .eq('id', requestRow.user_id);

      if (updateUserError) {
        return failure(
          new InternalError(
            `Failed to update user verification status: ${this.formatSupabaseError(updateUserError)}`,
            updateUserError
          )
        );
      }

      if (newStatus === 'rejected') {
        const { error: deleteFromStorageError } = await this.client.storage
          .from(VERIFIED_BUCKET)
          .remove([requestRow.photo_storage_path]);

        if (deleteFromStorageError) {
          return failure(
            new InternalError(
              `Failed to delete rejected photo from storage: ${this.formatSupabaseError(deleteFromStorageError)}`,
              deleteFromStorageError
            )
          );
        }
      }

      // Only remove the request row when rejected; keep it when verified
      if (newStatus === 'rejected') {
        const { error: deleteError } = await this.client
          .from('user_verification_requests')
          .delete()
          .eq('user_id', requestRow.user_id);

        if (deleteError) {
          return failure(
            new InternalError(
              `Failed to delete processed verification request: ${this.formatSupabaseError(deleteError)}`,
              deleteError
            )
          );
        }
      }

      return success({
        request: this.mapRow(requestRow as AdminVerificationRequest),
        verification_status: userStatus,
      });
    } catch (error) {
      if (error instanceof DomainError) {
        return failure(error);
      }
      return failure(
        new InternalError(
          'Unexpected error updating verification request',
          error
        )
      );
    }
  }

  private async createSignedUrl(storagePath: string): Promise<string> {
    const { data, error } = await this.client.storage
      .from(VERIFIED_BUCKET)
      .createSignedUrl(storagePath, this.signedUrlTtlSeconds);

    if (error) {
      throw new InternalError(
        `Failed to generate signed URL: ${this.formatSupabaseError(error)}`,
        error
      );
    }

    if (!data?.signedUrl) {
      throw new InternalError('Supabase did not return a signed URL');
    }

    return data.signedUrl;
  }

  private mapRow(row: AdminVerificationRequest): AdminVerificationRequest {
    return {
      id: row.id,
      user_id: row.user_id,
      photo_storage_path: row.photo_storage_path,
      created_at: row.created_at,
    };
  }

  private resolveConfig(config?: Partial<SupabaseConfig>): SupabaseConfig {
    return {
      url: config?.url || process.env.SUPABASE_URL || '',
      serviceRoleKey:
        config?.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
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
