import {
  SupabaseUserPhotoRepository,
  UserPhoto,
  CreateUserPhotoInput,
} from '../../data/repositories/SupabaseUserPhotoRepository';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Result, success, failure } from '../../domain/Result';
import {
  DomainError,
  ValidationError,
  InternalError,
} from '../../domain/errors/DomainError';
import sharp from 'sharp';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

const MAX_PHOTOS = 5;
const AVATAR_BUCKET = 'avatars';

export class UserPhotoService {
  private readonly repository: SupabaseUserPhotoRepository;
  private readonly client: SupabaseClient;

  constructor(config?: Partial<SupabaseConfig>) {
    const resolved = this.resolveConfig(config);
    this.repository = new SupabaseUserPhotoRepository(config);
    this.client = createClient(resolved.url, resolved.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  private resolveConfig(config?: Partial<SupabaseConfig>): SupabaseConfig {
    return {
      url: config?.url || process.env.SUPABASE_URL || '',
      serviceRoleKey:
        config?.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    };
  }

  async listUserPhotos(
    userId: string
  ): Promise<Result<UserPhoto[], DomainError>> {
    return this.repository.listUserPhotos(userId);
  }

  async addUserPhoto(
    userId: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<Result<UserPhoto, DomainError>> {
    try {
      // Check max photos
      const photosResult = await this.repository.listUserPhotos(userId);
      if (!photosResult.success) {
        return failure(photosResult.error);
      }

      if (photosResult.data.length >= MAX_PHOTOS) {
        return failure(
          new ValidationError(`Maximum ${MAX_PHOTOS} photos allowed`)
        );
      }

      // Normalize/convert image to a browser-friendly format (JPEG/PNG)
      const { normalizedBuffer, normalizedMimeType } =
        await this.normalizeImageBuffer(buffer, mimeType);

      // Generate filename using same pattern as old avatar upload
      const timestamp = Date.now();
      const extension = normalizedMimeType === 'image/png' ? 'png' : 'jpg';
      const fileName = `${userId}_${timestamp}.${extension}`;
      const storagePath = `${userId}/${fileName}`;

      // Upload to Storage
      const { error: uploadError } = await this.client.storage
        .from(AVATAR_BUCKET)
        .upload(storagePath, normalizedBuffer, {
          contentType: normalizedMimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error('[UserPhotoService] Upload error:', uploadError);
        return failure(
          new InternalError('Failed to upload photo', uploadError)
        );
      }

      // Get public URL
      const { data: publicUrlData } = this.client.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(storagePath);

      if (!publicUrlData?.publicUrl) {
        return failure(new InternalError('Failed to get public URL'));
      }

      // Determine is_main and position
      const isFirstPhoto = photosResult.data.length === 0;
      const position = photosResult.data.length;
      const isMain = isFirstPhoto;

      // Create database record
      const createInput: CreateUserPhotoInput = {
        user_id: userId,
        storage_path: storagePath,
        public_url: publicUrlData.publicUrl,
        is_main: isMain,
        position: position,
      };

      const createResult = await this.repository.addUserPhoto(createInput);
      if (!createResult.success) {
        // Cleanup storage on failure
        await this.client.storage.from(AVATAR_BUCKET).remove([storagePath]);
        return failure(createResult.error);
      }

      return success(createResult.data);
    } catch (error) {
      console.error('[UserPhotoService] Unexpected error:', error);
      return failure(
        new InternalError(
          'Unexpected error adding photo',
          error instanceof Error ? error : new Error(String(error))
        )
      );
    }
  }

  /**
   * Convert HEIC/HEIF or unknown formats to JPEG to keep web compatibility.
   * Also rotates according to EXIF so selfies appear correctly.
   */
  private async normalizeImageBuffer(
    buffer: Buffer,
    mimeType: string
  ): Promise<{ normalizedBuffer: Buffer; normalizedMimeType: string }> {
    const lowerMime = (mimeType || 'image/jpeg').toLowerCase();
    const isHeic = lowerMime.includes('heic') || lowerMime.includes('heif');
    const isPng = lowerMime === 'image/png';

    if (isPng) {
      return { normalizedBuffer: buffer, normalizedMimeType: 'image/png' };
    }

    try {
      const convertedBuffer = await sharp(buffer)
        .rotate() // respect EXIF orientation (common on iPhone selfies)
        .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
        .toBuffer();

      if (isHeic) {
        console.log('[UserPhotoService] Converted HEIC/HEIF upload to JPEG');
      }

      return {
        normalizedBuffer: convertedBuffer,
        normalizedMimeType: 'image/jpeg',
      };
    } catch (error) {
      console.warn(
        '[UserPhotoService] Failed to normalize image buffer, uploading original',
        error
      );
      // Fallback: use original buffer and mime when conversion fails
      const fallbackMime = lowerMime || 'image/jpeg';
      return { normalizedBuffer: buffer, normalizedMimeType: fallbackMime };
    }
  }

  async setMainPhoto(
    userId: string,
    photoId: string
  ): Promise<Result<UserPhoto, DomainError>> {
    return this.repository.setMainPhoto(userId, photoId);
  }

  async deleteUserPhoto(
    userId: string,
    photoId: string
  ): Promise<Result<void, DomainError>> {
    try {
      // Get photo to delete (to get storage_path)
      const photosResult = await this.repository.listUserPhotos(userId);
      if (!photosResult.success) {
        return failure(photosResult.error);
      }

      const photoToDelete = photosResult.data.find((p) => p.id === photoId);
      if (!photoToDelete) {
        return failure(new ValidationError('Photo not found'));
      }

      // Delete from storage
      const { error: storageError } = await this.client.storage
        .from(AVATAR_BUCKET)
        .remove([photoToDelete.storage_path]);

      if (storageError) {
        console.error('[UserPhotoService] Storage delete error:', storageError);
        // Continue with DB deletion even if storage fails
      }

      // Delete from database (repository handles main photo reassignment)
      return this.repository.deleteUserPhoto(userId, photoId);
    } catch (error) {
      console.error('[UserPhotoService] Unexpected error:', error);
      return failure(
        new InternalError(
          'Unexpected error deleting photo',
          error instanceof Error ? error : new Error(String(error))
        )
      );
    }
  }
}
