import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { InternalError } from '../../domain/errors/DomainError';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

export type ExternalChatFileStatus =
  | 'uploaded'
  | 'processing'
  | 'processed'
  | 'error';

export type CreateExternalChatFileInput = {
  userId: string;
  filePath: string;
  originalFilename?: string;
  fileSize?: number;
  checksum?: string;
  status?: ExternalChatFileStatus;
  metadata?: Record<string, unknown>;
};

export type ExternalChatFile = {
  id: string;
  userId: string;
  filePath: string;
  originalFilename: string | null;
  fileSize: number | null;
  checksum: string | null;
  status: ExternalChatFileStatus;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
};

type ExternalChatFileRow = {
  id: string;
  user_id: string;
  file_path: string;
  original_filename: string | null;
  file_size: number | null;
  checksum: string | null;
  status: ExternalChatFileStatus;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
};

/**
 * Service for managing external chat files
 * Handles CRUD operations for external_chat_files table
 */
export class ExternalChatFilesService {
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
   * Creates a new external chat file record
   */
  async create(input: CreateExternalChatFileInput): Promise<ExternalChatFile> {
    try {
      const { data, error } = await this.client
        .from('external_chat_files')
        .insert({
          user_id: input.userId,
          file_path: input.filePath,
          original_filename: input.originalFilename || null,
          file_size: input.fileSize || null,
          checksum: input.checksum || null,
          status: input.status || 'uploaded',
          metadata: input.metadata || null,
        })
        .select()
        .single<ExternalChatFileRow>();

      if (error) {
        console.error(
          '[ExternalChatFilesService] Error inserting record:',
          error
        );
        throw new InternalError(
          `Failed to create external chat file: ${this.formatSupabaseError(error)}`,
          error
        );
      }

      if (!data) {
        throw new InternalError(
          'Supabase did not return external chat file row'
        );
      }

      return this.mapRowToFile(data);
    } catch (error) {
      if (error instanceof InternalError) {
        throw error;
      }
      throw new InternalError(
        'Unexpected error creating external chat file',
        error
      );
    }
  }

  /**
   * Finds an external chat file by file path
   */
  async findByFilePath(filePath: string): Promise<ExternalChatFile | null> {
    try {
      const { data, error } = await this.client
        .from('external_chat_files')
        .select()
        .eq('file_path', filePath)
        .maybeSingle<ExternalChatFileRow>();

      if (error) {
        console.error(
          '[ExternalChatFilesService] Error querying by file path:',
          error
        );
        throw new InternalError(
          `Failed to query external chat file: ${this.formatSupabaseError(error)}`,
          error
        );
      }

      if (!data) {
        return null;
      }

      return this.mapRowToFile(data);
    } catch (error) {
      if (error instanceof InternalError) {
        throw error;
      }
      throw new InternalError(
        'Unexpected error querying external chat file',
        error
      );
    }
  }

  /**
   * Updates the status of an external chat file
   */
  async updateStatus(
    id: string,
    status: ExternalChatFileStatus,
    errorMessage?: string
  ): Promise<ExternalChatFile> {
    try {
      const updateData: {
        status: ExternalChatFileStatus;
        error_message?: string | null;
        updated_at: string;
        processed_at?: string | null;
      } = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (errorMessage !== undefined) {
        updateData.error_message = errorMessage || null;
      }

      if (status === 'processed') {
        updateData.processed_at = new Date().toISOString();
      }

      const { data, error } = await this.client
        .from('external_chat_files')
        .update(updateData)
        .eq('id', id)
        .select()
        .single<ExternalChatFileRow>();

      if (error) {
        console.error(
          '[ExternalChatFilesService] Error updating status:',
          error
        );
        throw new InternalError(
          `Failed to update external chat file status: ${this.formatSupabaseError(error)}`,
          error
        );
      }

      if (!data) {
        throw new InternalError('External chat file not found');
      }

      return this.mapRowToFile(data);
    } catch (error) {
      if (error instanceof InternalError) {
        throw error;
      }
      throw new InternalError(
        'Unexpected error updating external chat file status',
        error
      );
    }
  }

  private mapRowToFile(row: ExternalChatFileRow): ExternalChatFile {
    return {
      id: row.id,
      userId: row.user_id,
      filePath: row.file_path,
      originalFilename: row.original_filename,
      fileSize: row.file_size,
      checksum: row.checksum,
      status: row.status,
      errorMessage: row.error_message,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      processedAt: row.processed_at,
    };
  }

  private resolveConfig(config?: Partial<SupabaseConfig>): SupabaseConfig {
    const url = config?.url ?? process.env.SUPABASE_URL;
    const serviceRoleKey =
      config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'ExternalChatFilesService requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
      );
    }

    return {
      url,
      serviceRoleKey,
    };
  }

  private formatSupabaseError(error: unknown): string {
    if (error && typeof error === 'object') {
      const message = (error as { message?: unknown }).message;
      const details = (error as { details?: unknown }).details;
      const hint = (error as { hint?: unknown }).hint;

      return [message, details, hint]
        .filter(
          (value): value is string =>
            typeof value === 'string' && value.trim().length > 0
        )
        .join(' | ');
    }

    return typeof error === 'string' ? error : 'Unknown Supabase error';
  }
}
