import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  DomainError,
  UnauthorizedError,
} from '../../domain/errors/DomainError';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const RegisterUploadSchema = z.object({
  uploadZipPath: z.string().min(1),
  fileSizeBytes: z.number().int().positive(),
  source: z.string().default('whatsapp'),
  ingress: z.string().default('doclove'),
});

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

/**
 * Controller for managing imported conversations
 */
export class ImportedConversationsController {
  private readonly client: SupabaseClient;

  constructor(config?: Partial<SupabaseConfig>) {
    const url = config?.url ?? process.env.SUPABASE_URL;
    const serviceRoleKey =
      config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'ImportedConversationsController requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
      );
    }

    this.client = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Registers an uploaded ZIP file in the imported_conversations table
   */
  async registerUpload(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user;
      if (!authUser) {
        throw new UnauthorizedError('Missing authenticated user');
      }

      const body = RegisterUploadSchema.parse(request.body ?? {});

      // Validate path format
      const pathPattern = /^external_conversations\/[^/]+\/[^/]+\/upload\.zip$/;
      if (!pathPattern.test(body.uploadZipPath)) {
        return reply.status(400).send({
          error: 'INVALID_PATH',
          message: 'Invalid upload path format.',
        });
      }

      // Extract userId from path and verify it matches the authenticated user
      const pathParts = body.uploadZipPath.split('/');
      const pathUserId = pathParts[1];
      
      if (pathUserId !== authUser.id) {
        return reply.status(403).send({
          error: 'FORBIDDEN',
          message: 'You can only register uploads for your own files.',
        });
      }

      // Insert into imported_conversations table
      const { data, error } = await this.client
        .from('imported_conversations')
        .insert({
          owner_user_id: authUser.id,
          source: body.source,
          ingress: body.ingress,
          upload_zip_path: body.uploadZipPath,
          file_size_bytes: body.fileSizeBytes,
          // uploaded_at will be set by default
        })
        .select()
        .single();

      if (error) {
        console.error('[ImportedConversationsController] Error inserting record:', error);
        
        // Handle unique constraint violation (duplicate upload)
        if (error.code === '23505') {
          return reply.status(409).send({
            error: 'DUPLICATE_UPLOAD',
            message: 'Este archivo ya fue subido anteriormente.',
          });
        }
        
        return reply.status(500).send({
          error: 'DATABASE_ERROR',
          message: 'Failed to register upload',
          details: error.message,
        });
      }

      return reply.send({
        id: data.id,
        uploadZipPath: data.upload_zip_path,
        fileSizeBytes: data.file_size_bytes,
        uploadedAt: data.uploaded_at,
      });
    } catch (error) {
      return this.handleError(reply, error);
    }
  }

  private handleError(reply: FastifyReply, error: unknown) {
    if (error instanceof DomainError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
        details: error.details,
      });
    }

    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: error.errors,
      });
    }

    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Unexpected error processing request',
      details: error instanceof Error ? error.message : error,
    });
  }
}

