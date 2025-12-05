import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import axios from 'axios';
import { useAuthStore } from '../../domain/stores/authStore';
import { Result, success, failure } from '../../domain/Result';
import {
  DomainError,
  PermissionDeniedError,
  ImagePickerError,
  CameraError,
  UploadError,
} from '../../domain/errors/DomainError';
import { getApiUrl } from '../../utils/apiConfig';

const API_URL = getApiUrl();

const MAX_IMAGE_SIZE_KB = 500;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_KB * 1024;

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

  console.log(
    `[ImageService] Image size: ${Math.round(blob.size / 1024)}KB, compressing...`
  );

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

    console.log(
      `[ImageService] Attempt ${attempts + 1}: Quality ${quality}, Size: ${Math.round(compressedBlob.size / 1024)}KB`
    );

    if (compressedBlob.size <= MAX_IMAGE_SIZE_BYTES) {
      compressedUri = result.uri;
      console.log(
        `[ImageService] Compression successful: ${Math.round(compressedBlob.size / 1024)}KB`
      );
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
 * Note: Only allows selecting a single image (no multiple selection)
 * @returns {Promise<Result<string, DomainError>>} Result with image URI or error
 */
export async function pickImageFromGallery(): Promise<
  Result<string | null, DomainError>
> {
  try {
    // Check if running on web
    if (Platform.OS === 'web') {
      const uri = await pickImageFromWeb();
      return success(uri);
    }

    const hasPermission = await requestMediaLibraryPermissions();

    if (!hasPermission) {
      return failure(
        new PermissionDeniedError(
          'Se necesitan permisos para acceder a la galería de fotos.'
        )
      );
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      // mediaTypes: ['images'],
      allowsEditing: true,
      allowsMultipleSelection: false,
      aspect: [1, 1],
      quality: 1,
    });

    if (result.canceled) {
      return success(null);
    }

    const imageUri = result.assets[0].uri;
    const compressedUri = await compressImageIfNeeded(imageUri);

    return success(compressedUri);
  } catch (error) {
    console.error('[ImageService] Error picking image from gallery:', error);
    return failure(
      new ImagePickerError(
        'Error al seleccionar la imagen. Inténtalo de nuevo.',
        error
      )
    );
  }
}

/**
 * Takes a photo using the device camera
 * @returns {Promise<Result<string, DomainError>>} Result with image URI or error
 */
export async function takePictureWithCamera(): Promise<
  Result<string | null, DomainError>
> {
  try {
    // Check if running on web
    if (Platform.OS === 'web') {
      // For web, we'll use the same file picker but with a different message
      const uri = await pickImageFromWeb();
      return success(uri);
    }

    const hasPermission = await requestCameraPermissions();

    if (!hasPermission) {
      return failure(
        new PermissionDeniedError(
          'Se necesitan permisos para acceder a la cámara.'
        )
      );
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (result.canceled) {
      return success(null);
    }

    const imageUri = result.assets[0].uri;
    const compressedUri = await compressImageIfNeeded(imageUri);

    return success(compressedUri);
  } catch (error) {
    console.error('[ImageService] Error taking picture with camera:', error);
    return failure(
      new CameraError('Error al tomar la foto. Inténtalo de nuevo.', error)
    );
  }
}

/**
 * Uploads an image to the backend API, which handles Supabase Storage upload
 * @param imageUri - The local URI of the image to upload
 * @returns {Promise<Result<string, DomainError>>} Result with public URL or error
 */
export async function uploadAvatarToBackend(
  imageUri: string
): Promise<Result<string, DomainError>> {
  try {
    console.log('[ImageService] Uploading avatar via backend:', imageUri);

    // Get auth token from store
    const tokens = useAuthStore.getState().tokens;
    if (!tokens?.accessToken) {
      return failure(new UploadError('No authentication token available'));
    }

    // Create FormData with the image file
    const formData = new FormData();

    if (Platform.OS === 'web') {
      // On web, blob URLs need to be converted to File/Blob objects
      if (imageUri.startsWith('blob:')) {
        // Fetch the blob URL to get the Blob
        const response = await fetch(imageUri);
        const blob = await response.blob();

        // Determine MIME type from blob or default to jpeg
        const mimeType = blob.type || 'image/jpeg';

        // Create a File object from the Blob
        const filename = `avatar.${mimeType === 'image/png' ? 'png' : 'jpg'}`;
        const file = new File([blob], filename, { type: mimeType });

        // Append File object to FormData (standard web format)
        formData.append('file', file);
      } else {
        // If it's not a blob URL, try to fetch it as a file
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const mimeType = blob.type || 'image/jpeg';
        const filename = `avatar.${mimeType === 'image/png' ? 'png' : 'jpg'}`;
        const file = new File([blob], filename, { type: mimeType });
        formData.append('file', file);
      }
    } else {
      // In React Native, we need to provide file info in a specific format
      const filename = imageUri.split('/').pop() || 'avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      // @ts-expect-error - FormData in React Native accepts this format
      formData.append('file', {
        uri: imageUri,
        type: type,
        name: filename,
      });
    }

    // Upload to backend API endpoint using axios directly
    const response = await axios.post(`${API_URL}/users/me/avatar`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    const { avatarUrl } = response.data;
    console.log('[ImageService] Upload successful:', avatarUrl);

    return success(avatarUrl);
  } catch (error: unknown) {
    console.error('[ImageService] Unexpected error uploading avatar:', error);

    // Handle axios error format
    if (axios.isAxiosError(error) && error.response) {
      const message =
        error.response.data?.message || 'Error al subir la imagen.';
      return failure(new UploadError(message, error));
    }

    return failure(
      new UploadError(
        'Error inesperado al subir la imagen. Inténtalo de nuevo.',
        error instanceof Error ? error : new Error(String(error))
      )
    );
  }
}
