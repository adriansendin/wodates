import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DomainError, InternalError } from '../../domain/errors/DomainError';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

/**
 * Service for managing Supabase Storage operations
 * Handles signed URL generation for secure file uploads
 */
export class StorageService {
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

  /**
   * Uploads a ZIP file to Supabase Storage
   * Uses SERVICE_ROLE_KEY for direct upload (same pattern as avatar upload)
   * @param _userId - The user ID
   * @param buffer - File buffer
   * @param filePath - The file path within the bucket (without bucket name prefix)
   * @returns The storage path of the uploaded file
   */
  async uploadZipFile(
    _userId: string,
    buffer: Buffer,
    filePath: string
  ): Promise<string> {
    try {
      const BUCKET = 'external_chats';

      console.log(
        `[StorageService] Uploading ZIP: ${filePath}, Size: ${Math.round(buffer.length / 1024)}KB`
      );

      // Upload to Supabase Storage
      const { error } = await this.client.storage
        .from(BUCKET)
        .upload(filePath, buffer, {
          contentType: 'application/zip',
          upsert: false, // Don't overwrite existing files
        });

      if (error) {
        console.error(
          '[StorageService] Error uploading to Supabase Storage:',
          error
        );
        throw new InternalError(
          `Failed to upload ZIP file: ${this.formatSupabaseError(error)}`,
          error
        );
      }

      console.log(`[StorageService] Upload successful: ${filePath}`);
      return filePath;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }

      throw new InternalError('Unexpected error uploading ZIP file', error);
    }
  }

  private formatSupabaseError(error: unknown): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }

    return typeof error === 'string' ? error : 'Unknown Supabase error';
  }

  private resolveConfig(config?: Partial<SupabaseConfig>): SupabaseConfig {
    const url = config?.url ?? process.env.SUPABASE_URL;
    const serviceRoleKey =
      config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'StorageService requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
      );
    }

    return {
      url,
      serviceRoleKey,
    };
  }
}
