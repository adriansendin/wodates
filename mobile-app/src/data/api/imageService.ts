import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { getSupabaseClient } from './supabaseClient';
import { Result } from '../../domain/Result';
import { DomainError } from '../../domain/errors/DomainError';

const MAX_IMAGE_SIZE_KB = 500;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_KB * 1024;
const AVATAR_BUCKET = 'avatars';

/**
 * Compresses an image if it exceeds the maximum size
 * @param uri - The URI of the image to compress
 * @returns {Promise<string>} The URI of the compressed image
 */
async function compressImageIfNeeded(uri: string): Promise<string> {
  // Get file info to check size
  const response = await fetch(uri);
  const blob = await response.blob();
  
  if (blob.size <= MAX_IMAGE_SIZE_BYTES) {
    return uri; // Image is already small enough
  }

  console.log(`[ImageService] Image size: ${Math.round(blob.size / 1024)}KB, compressing...`);

  // Start with quality 0.8 and reduce if needed
  let quality = 0.8;
  let compressedUri = uri;
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }], // Resize to max width 800px
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );

    const compressedResponse = await fetch(result.uri);
    const compressedBlob = await compressedResponse.blob();

    console.log(`[ImageService] Attempt ${attempts + 1}: Quality ${quality}, Size: ${Math.round(compressedBlob.size / 1024)}KB`);

    if (compressedBlob.size <= MAX_IMAGE_SIZE_BYTES) {
      compressedUri = result.uri;
      console.log(`[ImageService] Compression successful: ${Math.round(compressedBlob.size / 1024)}KB`);
      break;
    }

    quality -= 0.15;
    attempts++;

    if (quality < 0.1) {
      console.warn('[ImageService] Could not compress image below 500KB');
      compressedUri = result.uri; // Use the best we could get
      break;
    }
  }

  return compressedUri;
}

/**
 * Requests camera roll permissions
 * @returns {Promise<boolean>} True if permission granted, false otherwise
 */
async function requestMediaLibraryPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

/**
 * Requests camera permissions
 * @returns {Promise<boolean>} True if permission granted, false otherwise
 */
async function requestCameraPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

/**
 * Picks an image from web file input
 * @returns {Promise<string | null>} Image URI or null if cancelled
 */
async function pickImageFromWeb(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        const uri = URL.createObjectURL(file);
        const compressedUri = await compressImageIfNeeded(uri);
        resolve(compressedUri);
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}

/**
 * Picks an image from the device gallery
 * @returns {Promise<Result<string, DomainError>>} Result with image URI or error
 */
export async function pickImageFromGallery(): Promise<Result<string | null, DomainError>> {
  try {
    // Check if running on web
    if (Platform.OS === 'web') {
      const uri = await pickImageFromWeb();
      return Result.ok(uri);
    }

    const hasPermission = await requestMediaLibraryPermissions();
    
    if (!hasPermission) {
      return Result.fail({
        code: 'PERMISSION_DENIED',
        message: 'Se necesitan permisos para acceder a la galería de fotos.',
      });
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (result.canceled) {
      return Result.ok(null);
    }

    const imageUri = result.assets[0].uri;
    const compressedUri = await compressImageIfNeeded(imageUri);

    return Result.ok(compressedUri);
  } catch (error) {
    console.error('[ImageService] Error picking image from gallery:', error);
    return Result.fail({
      code: 'IMAGE_PICKER_ERROR',
      message: 'Error al seleccionar la imagen. Inténtalo de nuevo.',
    });
  }
}

/**
 * Takes a photo using the device camera
 * @returns {Promise<Result<string, DomainError>>} Result with image URI or error
 */
export async function takePictureWithCamera(): Promise<Result<string | null, DomainError>> {
  try {
    // Check if running on web
    if (Platform.OS === 'web') {
      // For web, we'll use the same file picker but with a different message
      const uri = await pickImageFromWeb();
      return Result.ok(uri);
    }

    const hasPermission = await requestCameraPermissions();
    
    if (!hasPermission) {
      return Result.fail({
        code: 'PERMISSION_DENIED',
        message: 'Se necesitan permisos para acceder a la cámara.',
      });
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (result.canceled) {
      return Result.ok(null);
    }

    const imageUri = result.assets[0].uri;
    const compressedUri = await compressImageIfNeeded(imageUri);

    return Result.ok(compressedUri);
  } catch (error) {
    console.error('[ImageService] Error taking picture with camera:', error);
    return Result.fail({
      code: 'CAMERA_ERROR',
      message: 'Error al tomar la foto. Inténtalo de nuevo.',
    });
  }
}

/**
 * Uploads an image to Supabase Storage and returns the public URL
 * @param imageUri - The local URI of the image to upload
 * @param userId - The ID of the user uploading the image
 * @returns {Promise<Result<string, DomainError>>} Result with public URL or error
 */
export async function uploadAvatarToSupabase(
  imageUri: string,
  userId: string
): Promise<Result<string, DomainError>> {
  try {
    const supabase = getSupabaseClient();

    // Convert image URI to blob
    const response = await fetch(imageUri);
    const blob = await response.blob();

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = 'jpg';
    const fileName = `${userId}_${timestamp}.${fileExtension}`;
    const filePath = `${userId}/${fileName}`;

    console.log(`[ImageService] Uploading avatar: ${filePath}, Size: ${Math.round(blob.size / 1024)}KB`);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.error('[ImageService] Error uploading to Supabase:', error);
      return Result.fail({
        code: 'UPLOAD_ERROR',
        message: `Error al subir la imagen: ${error.message}`,
      });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(filePath);

    if (!publicUrlData?.publicUrl) {
      return Result.fail({
        code: 'URL_ERROR',
        message: 'No se pudo obtener la URL pública de la imagen.',
      });
    }

    console.log(`[ImageService] Upload successful: ${publicUrlData.publicUrl}`);

    return Result.ok(publicUrlData.publicUrl);
  } catch (error) {
    console.error('[ImageService] Unexpected error uploading avatar:', error);
    return Result.fail({
      code: 'UPLOAD_ERROR',
      message: 'Error inesperado al subir la imagen. Inténtalo de nuevo.',
    });
  }
}

/**
 * Deletes an avatar from Supabase Storage
 * @param avatarUrl - The public URL of the avatar to delete
 * @returns {Promise<Result<void, DomainError>>} Result indicating success or error
 */
export async function deleteAvatarFromSupabase(
  avatarUrl: string
): Promise<Result<void, DomainError>> {
  try {
    const supabase = getSupabaseClient();

    // Extract file path from public URL
    const url = new URL(avatarUrl);
    const pathParts = url.pathname.split(`${AVATAR_BUCKET}/`);
    
    if (pathParts.length < 2) {
      return Result.fail({
        code: 'INVALID_URL',
        message: 'URL de avatar inválida.',
      });
    }

    const filePath = pathParts[1];

    console.log(`[ImageService] Deleting avatar: ${filePath}`);

    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('[ImageService] Error deleting from Supabase:', error);
      return Result.fail({
        code: 'DELETE_ERROR',
        message: `Error al eliminar la imagen: ${error.message}`,
      });
    }

    console.log(`[ImageService] Delete successful`);
    return Result.ok(undefined);
  } catch (error) {
    console.error('[ImageService] Unexpected error deleting avatar:', error);
    return Result.fail({
      code: 'DELETE_ERROR',
      message: 'Error inesperado al eliminar la imagen.',
    });
  }
}

