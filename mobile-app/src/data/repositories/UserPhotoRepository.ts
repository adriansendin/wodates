import { getSupabaseClient } from '../api/supabaseClient';
import { Result, success, failure } from '../../domain/Result';
import {
  DomainError,
  NotFoundError,
  ServerError,
} from '../../domain/errors/DomainError';
import {
  UserPhoto,
  CreateUserPhotoInput,
  UpdateUserPhotoInput,
} from '../../domain/models/UserPhoto';

export class UserPhotoRepository {
  /**
   * Get all photos for a user, ordered by position
   */
  async getUserPhotos(
    userId: string
  ): Promise<Result<UserPhoto[], DomainError>> {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('user_photos')
        .select('*')
        .eq('user_id', userId)
        .order('position', { ascending: true });

      if (error) {
        console.error('[UserPhotoRepository] Error fetching photos:', error);
        return failure(new ServerError('Failed to fetch photos', error));
      }

      // Validate data with schema
      const photos = data.map((photo) => ({
        id: photo.id,
        user_id: photo.user_id,
        storage_path: photo.storage_path,
        public_url: photo.public_url,
        is_main: photo.is_main,
        position: photo.position,
        created_at: photo.created_at,
      }));

      return success(photos);
    } catch (error) {
      console.error('[UserPhotoRepository] Unexpected error:', error);
      return failure(
        new ServerError(
          'Unexpected error fetching photos',
          error instanceof Error ? error : new Error(String(error))
        )
      );
    }
  }

  /**
   * Create a new user photo
   */
  async createPhoto(
    input: CreateUserPhotoInput
  ): Promise<Result<UserPhoto, DomainError>> {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('user_photos')
        .insert({
          user_id: input.user_id,
          storage_path: input.storage_path,
          public_url: input.public_url,
          is_main: input.is_main,
          position: input.position,
        })
        .select()
        .single();

      if (error) {
        console.error('[UserPhotoRepository] Error creating photo:', error);
        return failure(new ServerError('Failed to create photo', error));
      }

      const photo: UserPhoto = {
        id: data.id,
        user_id: data.user_id,
        storage_path: data.storage_path,
        public_url: data.public_url,
        is_main: data.is_main,
        position: data.position,
        created_at: data.created_at,
      };

      return success(photo);
    } catch (error) {
      console.error('[UserPhotoRepository] Unexpected error:', error);
      return failure(
        new ServerError(
          'Unexpected error creating photo',
          error instanceof Error ? error : new Error(String(error))
        )
      );
    }
  }

  /**
   * Update a user photo
   */
  async updatePhoto(
    photoId: string,
    input: UpdateUserPhotoInput
  ): Promise<Result<UserPhoto, DomainError>> {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('user_photos')
        .update(input)
        .eq('id', photoId)
        .select()
        .single();

      if (error) {
        console.error('[UserPhotoRepository] Error updating photo:', error);
        if (error.code === 'PGRST116') {
          return failure(new NotFoundError('Photo not found'));
        }
        return failure(new ServerError('Failed to update photo', error));
      }

      const photo: UserPhoto = {
        id: data.id,
        user_id: data.user_id,
        storage_path: data.storage_path,
        public_url: data.public_url,
        is_main: data.is_main,
        position: data.position,
        created_at: data.created_at,
      };

      return success(photo);
    } catch (error) {
      console.error('[UserPhotoRepository] Unexpected error:', error);
      return failure(
        new ServerError(
          'Unexpected error updating photo',
          error instanceof Error ? error : new Error(String(error))
        )
      );
    }
  }

  /**
   * Delete a user photo
   */
  async deletePhoto(photoId: string): Promise<Result<void, DomainError>> {
    try {
      const supabase = getSupabaseClient();

      const { error } = await supabase
        .from('user_photos')
        .delete()
        .eq('id', photoId);

      if (error) {
        console.error('[UserPhotoRepository] Error deleting photo:', error);
        if (error.code === 'PGRST116') {
          return failure(new NotFoundError('Photo not found'));
        }
        return failure(new ServerError('Failed to delete photo', error));
      }

      return success(undefined);
    } catch (error) {
      console.error('[UserPhotoRepository] Unexpected error:', error);
      return failure(
        new ServerError(
          'Unexpected error deleting photo',
          error instanceof Error ? error : new Error(String(error))
        )
      );
    }
  }
}
