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
import { VerificationStatus } from '../../domain/entities/UserProfile';
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
  let originalSizeKB = 0;

  try {
    console.log('[ImageService] compressImageIfNeeded called with URI:', uri);

    // Get file info to check size
    console.log('[ImageService] Fetching blob to check size...');
    const response = await fetch(uri);

    if (!response.ok) {
      console.error(
        '[ImageService] Failed to fetch blob, status:',
        response.status,
        response.statusText
      );
      throw new Error(
        `Failed to fetch image: ${response.status} ${response.statusText}`
      );
    }

    const blob = await response.blob();
    originalSizeKB = Math.round(blob.size / 1024);

    console.log(
      `[ImageService] Original image size: ${originalSizeKB}KB, limit: ${MAX_IMAGE_SIZE_KB}KB, type: ${blob.type}`
    );

    if (blob.size <= MAX_IMAGE_SIZE_BYTES) {
      console.log(
        '[ImageService] Image is already within size limit, no compression needed'
      );
      return uri; // Image is already small enough
    }
  } catch (error) {
    console.error('[ImageService] Error checking image size:', error);
    // If we can't check the size, return the original URI and let the upload handle it
    console.warn(
      '[ImageService] Returning original URI due to error, compression skipped'
    );
    return uri;
  }

  console.log(
    `[ImageService] Image size: ${originalSizeKB}KB exceeds ${MAX_IMAGE_SIZE_KB}KB limit, compressing...`
  );

  // Start with quality 0.7 and reduce more aggressively
  let quality = 0.7;
  let compressedUri = uri;
  let attempts = 0;
  const maxAttempts = 6; // Increased attempts

  while (attempts < maxAttempts) {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }], // Resize to max width 800px
        { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
      );

      const compressedResponse = await fetch(result.uri);
      const compressedBlob = await compressedResponse.blob();
      const compressedSizeKB = Math.round(compressedBlob.size / 1024);

      console.log(
        `[ImageService] Attempt ${attempts + 1}: Quality ${quality.toFixed(2)}, Size: ${compressedSizeKB}KB (${originalSizeKB}KB → ${compressedSizeKB}KB)`
      );

      if (compressedBlob.size <= MAX_IMAGE_SIZE_BYTES) {
        compressedUri = result.uri;
        console.log(
          `[ImageService] ✓ Compression successful: ${compressedSizeKB}KB (reduced from ${originalSizeKB}KB)`
        );
        break;
      }

      // Reduce quality more aggressively
      quality -= 0.2;
      attempts++;

      if (quality < 0.1) {
        const finalSizeKB = Math.round(compressedBlob.size / 1024);
        console.warn(
          `[ImageService] ⚠ Could not compress image below ${MAX_IMAGE_SIZE_KB}KB. Best result: ${finalSizeKB}KB`
        );
        compressedUri = result.uri; // Use the best we could get
        break;
      }
    } catch (error) {
      console.error(
        `[ImageService] Compression attempt ${attempts + 1} failed:`,
        error
      );
      // If compression fails, try with lower quality
      quality -= 0.2;
      attempts++;
      if (attempts >= maxAttempts) {
        console.error(
          '[ImageService] All compression attempts failed, using original'
        );
        return uri; // Return original if all attempts fail
      }
    }
  }

  // Final verification
  const finalResponse = await fetch(compressedUri);
  const finalBlob = await finalResponse.blob();
  const finalSizeKB = Math.round(finalBlob.size / 1024);
  console.log(`[ImageService] Final compressed image size: ${finalSizeKB}KB`);

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
 * @param useCamera - If true, use camera capture attribute for mobile web
 * @returns {Promise<string | null>} Image URI or null if cancelled
 */
async function pickImageFromWeb(
  useCamera: boolean = false
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    console.log(
      '[ImageService] pickImageFromWeb called, useCamera:',
      useCamera
    );

    const userAgent =
      typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isChromeIOS = /CriOS/i.test(userAgent);
    const isSecure =
      (typeof window !== 'undefined' && window.isSecureContext) ||
      (typeof location !== 'undefined' &&
        (location.protocol === 'https:' || location.hostname === 'localhost'));

    // Chrome en iOS bloquea cámara/capture en orígenes no seguros. Forzamos galería.
    const shouldDisableCapture = useCamera && isChromeIOS && !isSecure;
    if (shouldDisableCapture) {
      console.warn(
        '[ImageService] Capture disabled on Chrome iOS without HTTPS/localhost. Falling back to gallery picker.'
      );
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    // For mobile web, use capture attribute to access camera directly
    if (useCamera && !shouldDisableCapture) {
      input.capture = 'environment'; // Use back camera
      console.log('[ImageService] Using camera capture for mobile web');
    }

    let resolved = false;

    const cleanup = () => {
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    };

    input.onchange = async (event) => {
      console.log('[ImageService] File input onChange event fired');

      if (resolved) {
        console.warn(
          '[ImageService] onChange called after promise was already resolved'
        );
        return;
      }

      try {
        const file = (event.target as HTMLInputElement).files?.[0];
        console.log(
          '[ImageService] File from input:',
          file
            ? {
                name: file.name,
                size: Math.round(file.size / 1024) + 'KB',
                type: file.type,
                lastModified: new Date(file.lastModified).toISOString(),
              }
            : 'null'
        );

        if (file) {
          const sizeKB = Math.round(file.size / 1024);
          console.log('[ImageService] Reading file...', {
            name: file.name,
            sizeKB,
            type: file.type,
            isChromeIOS,
          });

          const reader = new FileReader();

          reader.onload = async () => {
            try {
              const dataUri = reader.result as string;
              console.log(
                '[ImageService] FileReader onload, data URI length:',
                dataUri?.length || 0
              );
              let finalUri = dataUri;

              if (isChromeIOS) {
                console.log(
                  '[ImageService] Chrome iOS detected, skipping compression and returning data URI directly'
                );
              } else {
                try {
                  console.log(
                    '[ImageService] Starting image compression from data URL...'
                  );
                  finalUri = await compressImageIfNeeded(dataUri);
                  console.log(
                    '[ImageService] Image compression completed, compressed URI:',
                    finalUri
                  );
                } catch (compressionError) {
                  // If compression fails, fall back to the original data URL
                  console.error(
                    '[ImageService] Compression failed, using original data URI:',
                    compressionError
                  );
                  finalUri = dataUri;
                }
              }

              resolved = true;
              cleanup();
              resolve(finalUri);
            } catch (readError) {
              console.error(
                '[ImageService] Error processing file reader result:',
                readError
              );
              resolved = true;
              cleanup();
              reject(readError);
            }
          };

          reader.onerror = (readError) => {
            console.error('[ImageService] FileReader error:', readError);
            if (!resolved) {
              resolved = true;
              cleanup();
              reject(readError);
            }
          };

          reader.readAsDataURL(file);
        } else {
          console.log('[ImageService] No file selected, user cancelled');
          resolved = true;
          cleanup();
          resolve(null);
        }
      } catch (error) {
        console.error('[ImageService] Error in onChange handler:', error);
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(error);
        }
      }
    };

    input.onerror = (error) => {
      console.error('[ImageService] Error with file input:', error);
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(null);
      }
    };

    // Add input to DOM temporarily (some browsers require this)
    input.style.display = 'none';
    document.body.appendChild(input);

    console.log('[ImageService] Clicking file input...');
    console.log('[ImageService] Awaiting user interaction (camera/gallery)...');
    input.click();

    // Cleanup after a delay if nothing happened (fallback)
    setTimeout(() => {
      if (!resolved) {
        console.warn(
          '[ImageService] File input timeout - no response after 5 seconds'
        );
        // Don't resolve here, let the user interaction complete
      }
    }, 5000);
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
      const uri = await pickImageFromWeb(false); // false = gallery, not camera
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
      // For web (including mobile web), use file input with camera capture attribute
      console.log(
        '[ImageService] takePictureWithCamera called on web, using camera capture'
      );
      try {
        const uri = await pickImageFromWeb(true); // true = use camera, may fallback to gallery
        if (!uri) {
          console.log('[ImageService] User cancelled camera capture');
          return success(null);
        }
        console.log(
          '[ImageService] Camera capture successful, URI length:',
          uri.length
        );
        return success(uri);
      } catch (error) {
        console.error(
          '[ImageService] Error in pickImageFromWeb for camera, falling back to gallery:',
          error
        );
        try {
          const fallbackUri = await pickImageFromWeb(false);
          if (!fallbackUri) {
            console.log(
              '[ImageService] User cancelled gallery fallback after camera error'
            );
            return success(null);
          }
          return success(fallbackUri);
        } catch (fallbackError) {
          console.error(
            '[ImageService] Gallery fallback also failed:',
            fallbackError
          );
          return failure(
            new CameraError(
              'Error al tomar la foto. Inténtalo de nuevo.',
              fallbackError instanceof Error
                ? fallbackError
                : new Error(String(fallbackError))
            )
          );
        }
      }
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

type VerificationUploadResponse = {
  verification_status: VerificationStatus;
  request_id?: string;
  created_at?: string;
};

/**
 * Uploads a selfie for profile verification
 */
export async function uploadVerificationSelfie(
  imageUri: string
): Promise<Result<VerificationUploadResponse, DomainError>> {
  try {
    console.log('[ImageService] Uploading verification selfie:', imageUri);

    const tokens = useAuthStore.getState().tokens;
    if (!tokens?.accessToken) {
      return failure(new UploadError('No authentication token available'));
    }

    const formData = new FormData();

    if (Platform.OS === 'web') {
      if (imageUri.startsWith('blob:')) {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const mimeType = blob.type || 'image/jpeg';
        const filename = `verification.${mimeType === 'image/png' ? 'png' : 'jpg'}`;
        const file = new File([blob], filename, { type: mimeType });
        formData.append('file', file);
      } else {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const mimeType = blob.type || 'image/jpeg';
        const filename = `verification.${mimeType === 'image/png' ? 'png' : 'jpg'}`;
        const file = new File([blob], filename, { type: mimeType });
        formData.append('file', file);
      }
    } else {
      const filename = imageUri.split('/').pop() || 'verification.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      // @ts-expect-error - React Native FormData typing
      formData.append('file', {
        uri: imageUri,
        type: type,
        name: filename,
      });
    }

    const response = await axios.post(
      `${API_URL}/users/me/verification`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      }
    );

    return success(response.data as VerificationUploadResponse);
  } catch (error: unknown) {
    console.error('[ImageService] Error uploading verification selfie:', error);

    if (axios.isAxiosError(error) && error.response) {
      const message =
        error.response.data?.message ||
        'Error al subir la selfie de verificación.';
      return failure(new UploadError(message, error));
    }

    return failure(
      new UploadError(
        'Error inesperado al subir la selfie de verificación.',
        error instanceof Error ? error : new Error(String(error))
      )
    );
  }
}
