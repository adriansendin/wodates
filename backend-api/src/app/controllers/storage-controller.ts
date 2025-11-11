import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  DomainError,
  UnauthorizedError,
} from '../../domain/errors/DomainError';
import { StorageService } from '../services/storage-service';

export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Uploads a ZIP file to Supabase Storage
   * Handles multipart/form-data with a single ZIP file
   * Same pattern as avatar upload
   */
  async uploadZip(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user;
      if (!authUser) {
        throw new UnauthorizedError('Missing authenticated user');
      }

      // Get file from multipart request
      const data = await request.file();
      
      if (!data) {
        return reply.status(400).send({
          error: 'MISSING_FILE',
          message: 'No file provided. Please upload a ZIP file.',
        });
      }

      // Validate file type (only ZIP)
      if (data.mimetype !== 'application/zip') {
        return reply.status(400).send({
          error: 'INVALID_FILE_TYPE',
          message: 'Only ZIP files are allowed.',
        });
      }

      // Validate file size (max 500KB)
      const MAX_FILE_SIZE = 500 * 1024; // 500KB
      if (data.file.bytesRead > MAX_FILE_SIZE) {
        return reply.status(400).send({
          error: 'FILE_TOO_LARGE',
          message: 'File size must be less than 500 KB.',
        });
      }

      // Convert stream to buffer
      const buffer = await data.toBuffer();

      // Generate unique file path
      const uuid = crypto.randomUUID();
      const filePath = `external_conversations/${authUser.id}/${uuid}/upload.zip`;

      // Upload to Supabase Storage
      const uploadedPath = await this.storageService.uploadZipFile(
        authUser.id,
        buffer,
        filePath,
      );

      return reply.send({
        uploadZipPath: uploadedPath,
        fileSizeBytes: buffer.length,
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

