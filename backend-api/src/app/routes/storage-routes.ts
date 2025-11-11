import { FastifyInstance } from 'fastify';
import { StorageController } from '../controllers/storage-controller';
import { StorageService } from '../services/storage-service';
import { ImportedConversationsController } from '../controllers/imported-conversations-controller';

declare module 'fastify' {
  interface FastifyInstance {
    authMiddleware: any;
  }
}

export async function storageRoutes(fastify: FastifyInstance) {
  const storageService = new StorageService();
  const storageController = new StorageController(storageService);
  const importedConversationsController = new ImportedConversationsController();

  // Upload ZIP file (same pattern as avatar upload)
  fastify.post(
    '/storage/upload-zip',
    {
      schema: {
        description: 'Upload a ZIP file to Supabase Storage',
        tags: ['storage'],
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
        response: {
          200: {
            type: 'object',
            properties: {
              uploadZipPath: { type: 'string' },
              fileSizeBytes: { type: 'number' },
            },
            required: ['uploadZipPath', 'fileSizeBytes'],
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    storageController.uploadZip.bind(storageController),
  );

  // Register uploaded file in imported_conversations
  fastify.post(
    '/storage/register-upload',
    {
      schema: {
        description: 'Register an uploaded ZIP file in imported_conversations table',
        tags: ['storage'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['uploadZipPath', 'fileSizeBytes'],
          properties: {
            uploadZipPath: { type: 'string' },
            fileSizeBytes: { type: 'number' },
            source: { type: 'string', default: 'whatsapp' },
            ingress: { type: 'string', default: 'doclove' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              uploadZipPath: { type: 'string' },
              fileSizeBytes: { type: 'number' },
              uploadedAt: { type: 'string', format: 'date-time' },
            },
            required: ['id', 'uploadZipPath', 'fileSizeBytes', 'uploadedAt'],
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    importedConversationsController.registerUpload.bind(importedConversationsController),
  );
}

