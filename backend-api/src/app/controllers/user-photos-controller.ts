import { FastifyRequest, FastifyReply } from 'fastify';
import { UserPhotoService } from '../services/user-photo-service';
import {
  UnauthorizedError,
  ValidationError,
} from '../../domain/errors/DomainError';

export class UserPhotosController {
  constructor(private readonly photoService: UserPhotoService) {}

  async listUserPhotos(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user;
      if (!authUser) {
        throw new UnauthorizedError('Missing authenticated user');
      }

      const result = await this.photoService.listUserPhotos(authUser.id);

      if (!result.success) {
        return reply.status(result.error.statusCode).send({
          error: result.error.code,
          message: result.error.message,
        });
      }

      return reply.send({ photos: result.data });
    } catch (error) {
      return this.handleError(reply, error);
    }
  }

  async addUserPhoto(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user;
      if (!authUser) {
        throw new UnauthorizedError('Missing authenticated user');
      }

      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          error: 'MISSING_FILE',
          message: 'No file provided. Please upload an image.',
        });
      }

      const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/heic',
        'image/heif',
      ];
      if (!allowedMimeTypes.includes(data.mimetype)) {
        return reply.status(400).send({
          error: 'INVALID_FILE_TYPE',
          message: 'Only JPEG, PNG or HEIC images are allowed.',
        });
      }

      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
      if (data.file.bytesRead > MAX_FILE_SIZE) {
        return reply.status(400).send({
          error: 'FILE_TOO_LARGE',
          message: 'File size must be less than 5MB.',
        });
      }

      const buffer = await data.toBuffer();

      const result = await this.photoService.addUserPhoto(
        authUser.id,
        buffer,
        data.mimetype
      );

      if (!result.success) {
        return reply.status(result.error.statusCode).send({
          error: result.error.code,
          message: result.error.message,
        });
      }

      return reply.send({ photo: result.data });
    } catch (error) {
      return this.handleError(reply, error);
    }
  }

  async setMainPhoto(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user;
      if (!authUser) {
        throw new UnauthorizedError('Missing authenticated user');
      }

      const { photoId } = request.params as { photoId: string };

      if (!photoId) {
        return reply.status(400).send({
          error: 'MISSING_PHOTO_ID',
          message: 'Photo ID is required.',
        });
      }

      const result = await this.photoService.setMainPhoto(authUser.id, photoId);

      if (!result.success) {
        return reply.status(result.error.statusCode).send({
          error: result.error.code,
          message: result.error.message,
        });
      }

      return reply.send({ photo: result.data });
    } catch (error) {
      return this.handleError(reply, error);
    }
  }

  async deleteUserPhoto(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user;
      if (!authUser) {
        throw new UnauthorizedError('Missing authenticated user');
      }

      const { photoId } = request.params as { photoId: string };

      if (!photoId) {
        return reply.status(400).send({
          error: 'MISSING_PHOTO_ID',
          message: 'Photo ID is required.',
        });
      }

      const result = await this.photoService.deleteUserPhoto(
        authUser.id,
        photoId
      );

      if (!result.success) {
        return reply.status(result.error.statusCode).send({
          error: result.error.code,
          message: result.error.message,
        });
      }

      return reply.send({ message: 'Photo deleted successfully' });
    } catch (error) {
      return this.handleError(reply, error);
    }
  }

  private handleError(reply: FastifyReply, error: unknown) {
    if (error instanceof ValidationError) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    }

    if (error instanceof UnauthorizedError) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: error.message,
      });
    }

    console.error('[UserPhotosController] Unexpected error:', error);
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  }
}
