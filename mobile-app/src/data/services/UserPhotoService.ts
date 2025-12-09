import { Result, success, failure } from '../../domain/Result';
import {
  DomainError,
  ValidationError,
  ServerError,
} from '../../domain/errors/DomainError';
import { UserPhotoRepository } from '../repositories/UserPhotoRepository';
import { getSupabaseClient } from '../api/supabaseClient';
import { UserPhoto, CreateUserPhotoInput } from '../../domain/models/UserPhoto';
import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

const MAX_PHOTOS = 5;
const AVATAR_BUCKET = 'avatars';
const MAX_IMAGE_SIZE_KB = 500;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_KB * 1024;

export class UserPhotoService {
  private repository: UserPhotoRepository;

  constructor() {
    this.repository = new UserPhotoRepository();
  }

  /**
   * Get all photos for a user
   */
  async getUserPhotos(
    userId: string
  ): Promise<Result<UserPhoto[], DomainError>> {
    return this.repository.getUserPhotos(userId);
  }

  /**
   * Upload a photo to Supabase Storage and create a record
   */
  async uploadPhoto(
    userId: string,
    imageUri: string
  ): Promise<Result<UserPhoto, DomainError>> {
    try {
      // Step 1: Validate user has less than MAX_PHOTOS
      const photosResult = await this.repository.getUserPhotos(userId);
      if (!photosResult.success) {
        return failure(photosResult.error);
      }

      const existingPhotos = photosResult.data;
      if (existingPhotos.length >= MAX_PHOTOS) {
        return failure(
          new ValidationError(`Maximum ${MAX_PHOTOS} photos allowed`)
        );
      }

      // Step 2: Compress image if needed
      const compressedUri = await this.compressImageIfNeeded(imageUri);

      // Step 3: Convert to blob/buffer for upload
      const blob = await this.uriToBlob(compressedUri);

      // Step 4: Generate unique filename
      // Use a simple UUID-like generator for React Native compatibility
      const photoId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const fileName = `${photoId}.jpg`;
      const storagePath = `${userId}/${fileName}`;

      // Step 5: Upload to Supabase Storage
      const supabase = getSupabaseClient();
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(storagePath, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error('[UserPhotoService] Upload error:', uploadError);
        return failure(new ServerError('Failed to upload photo', uploadError));
      }

      // Step 6: Get public URL
      const { data: urlData } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(storagePath);

      if (!urlData?.publicUrl) {
        return failure(new ServerError('Failed to get public URL'));
      }

      // Step 7: Determine position and is_main
      const isFirstPhoto = existingPhotos.length === 0;
      const position = existingPhotos.length;
      const isMain = isFirstPhoto;

      // Step 8: Create database record
      const createInput: CreateUserPhotoInput = {
        user_id: userId,
        storage_path: storagePath,
        public_url: urlData.publicUrl,
        is_main: isMain,
        position: position,
      };

      const createResult = await this.repository.createPhoto(createInput);
      if (!createResult.success) {
        // Cleanup: delete uploaded file if DB insert fails
        await supabase.storage.from(AVATAR_BUCKET).remove([storagePath]);
        return failure(createResult.error);
      }

      return success(createResult.data);
    } catch (error) {
      console.error('[UserPhotoService] Unexpected error:', error);
      return failure(
        new ServerError(
          'Unexpected error uploading photo',
          error instanceof Error ? error : new Error(String(error))
        )
      );
    }
  }

  /**
   * Delete a photo
   */
  async deletePhoto(
    userId: string,
    photoId: string
  ): Promise<Result<void, DomainError>> {
    try {
      // Step 1: Get photo to delete
      const photosResult = await this.repository.getUserPhotos(userId);
      if (!photosResult.success) {
        return failure(photosResult.error);
      }

      const photoToDelete = photosResult.data.find((p) => p.id === photoId);
      if (!photoToDelete) {
        return failure(new ValidationError('Photo not found'));
      }

      const wasMain = photoToDelete.is_main;

      // Step 2: Delete from storage
      const supabase = getSupabaseClient();
      const { error: storageError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .remove([photoToDelete.storage_path]);

      if (storageError) {
        console.error('[UserPhotoService] Storage delete error:', storageError);
        // Continue with DB deletion even if storage fails
      }

      // Step 3: Delete from database
      const deleteResult = await this.repository.deletePhoto(photoId);
      if (!deleteResult.success) {
        return failure(deleteResult.error);
      }

      // Step 4: If deleted photo was main, set next oldest as main
      if (wasMain) {
        const remainingPhotosResult =
          await this.repository.getUserPhotos(userId);
        if (
          remainingPhotosResult.success &&
          remainingPhotosResult.data.length > 0
        ) {
          // Sort by created_at and pick the oldest
          const sorted = [...remainingPhotosResult.data].sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
          );
          const newMainPhoto = sorted[0];

          // Update to be main and move to position 0
          await this.setMainPhoto(userId, newMainPhoto.id);
        }
      } else {
        // Reorder positions after deletion
        await this.reorderPositions(userId);
      }

      return success(undefined);
    } catch (error) {
      console.error('[UserPhotoService] Unexpected error:', error);
      return failure(
        new ServerError(
          'Unexpected error deleting photo',
          error instanceof Error ? error : new Error(String(error))
        )
      );
    }
  }

  /**
   * Set a photo as main and reorder others
   */
  async setMainPhoto(
    userId: string,
    photoId: string
  ): Promise<Result<UserPhoto, DomainError>> {
    try {
      // Step 1: Get all photos
      const photosResult = await this.repository.getUserPhotos(userId);
      if (!photosResult.success) {
        return failure(photosResult.error);
      }

      const photoToSetMain = photosResult.data.find((p) => p.id === photoId);
      if (!photoToSetMain) {
        return failure(new ValidationError('Photo not found'));
      }

      // Step 2: Unset current main photo
      const currentMain = photosResult.data.find((p) => p.is_main);
      if (currentMain && currentMain.id !== photoId) {
        await this.repository.updatePhoto(currentMain.id, { is_main: false });
      }

      // Step 3: Set new main photo
      const updateResult = await this.repository.updatePhoto(photoId, {
        is_main: true,
        position: 0,
      });

      if (!updateResult.success) {
        return failure(updateResult.error);
      }

      // Step 4: Reorder remaining photos
      await this.reorderPositions(userId);

      return success(updateResult.data);
    } catch (error) {
      console.error('[UserPhotoService] Unexpected error:', error);
      return failure(
        new ServerError(
          'Unexpected error setting main photo',
          error instanceof Error ? error : new Error(String(error))
        )
      );
    }
  }

  /**
   * Reorder photo positions after deletion or main change
   */
  private async reorderPositions(userId: string): Promise<void> {
    const photosResult = await this.repository.getUserPhotos(userId);
    if (!photosResult.success) {
      return;
    }

    const photos = photosResult.data;
    const mainPhoto = photos.find((p) => p.is_main);
    const otherPhotos = photos.filter((p) => !p.is_main);

    // Update positions: main is 0, others are 1, 2, 3, 4
    if (mainPhoto) {
      await this.repository.updatePhoto(mainPhoto.id, { position: 0 });
    }

    otherPhotos.forEach((photo, index) => {
      this.repository.updatePhoto(photo.id, { position: index + 1 });
    });
  }

  /**
   * Compress image if it exceeds max size
   */
  private async compressImageIfNeeded(uri: string): Promise<string> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();

      if (blob.size <= MAX_IMAGE_SIZE_BYTES) {
        return uri;
      }

      console.log(
        `[UserPhotoService] Image size: ${Math.round(blob.size / 1024)}KB, compressing...`
      );

      let quality = 0.8;
      let compressedUri = uri;
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        const result = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 800 } }],
          { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
        );

        const compressedResponse = await fetch(result.uri);
        const compressedBlob = await compressedResponse.blob();

        if (compressedBlob.size <= MAX_IMAGE_SIZE_BYTES) {
          compressedUri = result.uri;
          break;
        }

        quality -= 0.15;
        attempts++;

        if (quality < 0.1) {
          compressedUri = result.uri;
          break;
        }
      }

      return compressedUri;
    } catch (error) {
      console.error('[UserPhotoService] Compression error:', error);
      return uri; // Return original if compression fails
    }
  }

  /**
   * Convert URI to blob for upload
   */
  private async uriToBlob(uri: string): Promise<Blob> {
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      return await response.blob();
    } else {
      // React Native: convert file URI to blob
      const response = await fetch(uri);
      return await response.blob();
    }
  }
}
