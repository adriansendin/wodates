import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Result, success, failure } from '../../domain/Result';
import {
  DomainError,
  NotFoundError,
  InternalError,
} from '../../domain/errors/DomainError';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type UserPhotoRow = {
  id: string;
  user_id: string;
  storage_path: string;
  public_url: string;
  is_main: boolean;
  position: number;
  created_at: string;
};

export type UserPhoto = {
  id: string;
  user_id: string;
  storage_path: string;
  public_url: string;
  is_main: boolean;
  position: number;
  created_at: string;
};

export type CreateUserPhotoInput = {
  user_id: string;
  storage_path: string;
  public_url: string;
  is_main: boolean;
  position: number;
};

export type UpdateUserPhotoInput = {
  is_main?: boolean;
  position?: number;
};

export class SupabaseUserPhotoRepository {
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
    try {
      console.log(
        '[SupabaseUserPhotoRepository] Listing photos for user:',
        userId
      );
      const { data, error } = await this.client
        .from('user_photos')
        .select('*')
        .eq('user_id', userId)
        .order('position', { ascending: true });

      if (error) {
        console.error(
          '[SupabaseUserPhotoRepository] Error listing photos:',
          error
        );
        return failure(new InternalError('Failed to list photos', error));
      }

      const photos = (data || []).map((row) => this.mapRow(row));
      console.log(
        '[SupabaseUserPhotoRepository] Found',
        photos.length,
        'photos for user',
        userId
      );
      console.log(
        '[SupabaseUserPhotoRepository] Photo IDs:',
        photos.map((p) => p.id)
      );
      return success(photos);
    } catch (error) {
      console.error('[SupabaseUserPhotoRepository] Unexpected error:', error);
      return failure(
        new InternalError(
          'Unexpected error listing photos',
          error instanceof Error ? error : new Error(String(error))
        )
      );
    }
  }

  async addUserPhoto(
    input: CreateUserPhotoInput
  ): Promise<Result<UserPhoto, DomainError>> {
    try {
      const { data, error } = await this.client
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
        console.error(
          '[SupabaseUserPhotoRepository] Error adding photo:',
          error
        );
        return failure(new InternalError('Failed to add photo', error));
      }

      return success(this.mapRow(data));
    } catch (error) {
      console.error('[SupabaseUserPhotoRepository] Unexpected error:', error);
      return failure(
        new InternalError(
          'Unexpected error adding photo',
          error instanceof Error ? error : new Error(String(error))
        )
      );
    }
  }

  async setMainPhoto(
    userId: string,
    photoId: string
  ): Promise<Result<UserPhoto, DomainError>> {
    try {
      // First, get all photos to understand current state
      const photosResult = await this.listUserPhotos(userId);
      if (!photosResult.success) {
        return failure(photosResult.error);
      }

      const photos = photosResult.data;
      const photoToSetMain = photos.find((p) => p.id === photoId);
      if (!photoToSetMain) {
        return failure(new NotFoundError('Photo not found'));
      }

      // If it's already the main photo, return success
      if (photoToSetMain.is_main) {
        return success(photoToSetMain);
      }

      // Find current main photo (if any) and the photo currently at position 0
      const currentMain = photos.find((p) => p.is_main);
      const photoAtPosition0 = photos.find(
        (p) => p.position === 0 && p.id !== photoId
      );

      // Step 1: Unset all main photos
      if (currentMain) {
        const { error: unsetError } = await this.client
          .from('user_photos')
          .update({ is_main: false })
          .eq('user_id', userId)
          .eq('is_main', true);

        if (unsetError) {
          console.error(
            '[SupabaseUserPhotoRepository] Error unsetting main photos:',
            unsetError
          );
          return failure(
            new InternalError('Failed to unset main photos', unsetError)
          );
        }
      }

      // Step 2: If there's a photo at position 0, move it to a temporary position first
      if (photoAtPosition0) {
        // Find the highest position and use position + 1 as temporary
        const maxPosition = Math.max(...photos.map((p) => p.position));
        const tempPosition = maxPosition + 1;

        const { error: tempError } = await this.client
          .from('user_photos')
          .update({ position: tempPosition })
          .eq('id', photoAtPosition0.id)
          .eq('user_id', userId);

        if (tempError) {
          console.error(
            '[SupabaseUserPhotoRepository] Error moving photo from position 0:',
            tempError
          );
          return failure(
            new InternalError('Failed to free position 0', tempError)
          );
        }
      }

      // Step 3: Set the new main photo at position 0
      const { data, error } = await this.client
        .from('user_photos')
        .update({ is_main: true, position: 0 })
        .eq('id', photoId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error(
          '[SupabaseUserPhotoRepository] Error setting main photo:',
          error
        );
        if (error.code === 'PGRST116') {
          return failure(new NotFoundError('Photo not found'));
        }
        return failure(new InternalError('Failed to set main photo', error));
      }

      // Step 4: Reorder all photos (this will fix positions and move temp position back)
      await this.reorderPositions(userId);

      return success(this.mapRow(data));
    } catch (error) {
      console.error('[SupabaseUserPhotoRepository] Unexpected error:', error);
      return failure(
        new InternalError(
          'Unexpected error setting main photo',
          error instanceof Error ? error : new Error(String(error))
        )
      );
    }
  }

  async deleteUserPhoto(
    userId: string,
    photoId: string
  ): Promise<Result<void, DomainError>> {
    try {
      // Get photo to check if it was main
      const { data: photoData, error: fetchError } = await this.client
        .from('user_photos')
        .select('is_main, storage_path')
        .eq('id', photoId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !photoData) {
        if (fetchError?.code === 'PGRST116') {
          return failure(new NotFoundError('Photo not found'));
        }
        return failure(new InternalError('Failed to fetch photo', fetchError));
      }

      const wasMain = photoData.is_main;

      // Delete from database
      const { error: deleteError } = await this.client
        .from('user_photos')
        .delete()
        .eq('id', photoId)
        .eq('user_id', userId);

      if (deleteError) {
        console.error(
          '[SupabaseUserPhotoRepository] Error deleting photo:',
          deleteError
        );
        return failure(
          new InternalError('Failed to delete photo', deleteError)
        );
      }

      // If it was main, set another as main
      if (wasMain) {
        const photosResult = await this.listUserPhotos(userId);
        if (photosResult.success && photosResult.data.length > 0) {
          const sorted = [...photosResult.data].sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
          );
          const newMain = sorted[0];
          if (newMain) {
            await this.setMainPhoto(userId, newMain.id);
          }
        }
      } else {
        await this.reorderPositions(userId);
      }

      return success(undefined);
    } catch (error) {
      console.error('[SupabaseUserPhotoRepository] Unexpected error:', error);
      return failure(
        new InternalError(
          'Unexpected error deleting photo',
          error instanceof Error ? error : new Error(String(error))
        )
      );
    }
  }

  private async reorderPositions(userId: string): Promise<void> {
    const photosResult = await this.listUserPhotos(userId);
    if (!photosResult.success) {
      return;
    }

    const photos = photosResult.data;
    const mainPhoto = photos.find((p) => p.is_main);
    const otherPhotos = photos
      .filter((p) => !p.is_main)
      .sort((a, b) => {
        // Sort by position first, then by created_at
        if (a.position !== b.position) {
          return a.position - b.position;
        }
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });

    // Update main photo to position 0
    if (mainPhoto && mainPhoto.position !== 0) {
      await this.client
        .from('user_photos')
        .update({ position: 0 })
        .eq('id', mainPhoto.id);
    }

    // Update other photos to positions 1, 2, 3, 4
    await Promise.all(
      otherPhotos.map((photo, index) =>
        this.client
          .from('user_photos')
          .update({ position: index + 1 })
          .eq('id', photo.id)
      )
    );
  }

  private mapRow(row: UserPhotoRow): UserPhoto {
    return {
      id: row.id,
      user_id: row.user_id,
      storage_path: row.storage_path,
      public_url: row.public_url,
      is_main: row.is_main,
      position: row.position,
      created_at: row.created_at,
    };
  }
}
