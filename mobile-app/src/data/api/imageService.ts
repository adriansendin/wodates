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
  let blob: Blob;

  try {
    console.log('[ImageService] compressImageIfNeeded called with URI:', {
      uriType: uri.startsWith('data:')
        ? 'data URI'
        : uri.startsWith('blob:')
          ? 'blob URI'
          : 'other',
      uriLength: uri.length,
      uriPreview: uri.substring(0, 50) + '...',
    });

    // Handle data URIs directly without fetch (fetch can fail with data URIs in Chrome iOS)
    if (uri.startsWith('data:')) {
      console.log(
        '[ImageService] Data URI detected, converting to blob locally...'
      );
      blob = buildBlobFromDataUri(uri);
      originalSizeKB = Math.round(blob.size / 1024);
      console.log(
        `[ImageService] Data URI converted: ${originalSizeKB}KB, limit: ${MAX_IMAGE_SIZE_KB}KB, type: ${blob.type}`
      );
    } else {
      // For blob URIs or other URIs, use fetch
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

      blob = await response.blob();
      originalSizeKB = Math.round(blob.size / 1024);

      console.log(
        `[ImageService] Original image size: ${originalSizeKB}KB, limit: ${MAX_IMAGE_SIZE_KB}KB, type: ${blob.type}`
      );
    }

    if (blob.size <= MAX_IMAGE_SIZE_BYTES) {
      console.log(
        '[ImageService] Image is already within size limit, no compression needed'
      );
      return uri; // Image is already small enough
    }
  } catch (error) {
    console.error('[ImageService] Error checking image size:', error);
    // If we can't check the size, try to compress anyway
    console.warn(
      '[ImageService] Size check failed, will attempt compression anyway'
    );
    // Continue to compression attempt below
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

      // Handle data URIs correctly (ImageManipulator returns data URIs in web)
      // fetch() can fail with data URIs in Chrome iOS, so we convert directly
      let compressedBlob: Blob;
      if (result.uri.startsWith('data:')) {
        console.log(
          '[ImageService] Compressed result is data URI, converting to blob...'
        );
        compressedBlob = buildBlobFromDataUri(result.uri);
      } else {
        const compressedResponse = await fetch(result.uri);
        compressedBlob = await compressedResponse.blob();
      }

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
  let finalBlob: Blob;
  if (compressedUri.startsWith('data:')) {
    console.log(
      '[ImageService] Final verification: compressed URI is data URI, converting to blob...'
    );
    finalBlob = buildBlobFromDataUri(compressedUri);
  } else {
    const finalResponse = await fetch(compressedUri);
    finalBlob = await finalResponse.blob();
  }
  const finalSizeKB = Math.round(finalBlob.size / 1024);
  console.log(`[ImageService] Final compressed image size: ${finalSizeKB}KB`);

  return compressedUri;
}

/**
 * Converts a data URI to a Blob object
 * @param uri - The data URI to convert
 * @returns {Blob} The converted blob
 */
const buildBlobFromDataUri = (uri: string): Blob => {
  try {
    console.log('[ImageService] buildBlobFromDataUri: Starting conversion...');
    console.log('[ImageService] Data URI length:', uri.length);
    console.log(
      '[ImageService] Data URI preview:',
      uri.substring(0, 100) + '...'
    );

    const commaIndex = uri.indexOf(',');
    if (commaIndex === -1) {
      throw new Error('Invalid data URI: no comma found');
    }

    const meta = uri.substring(5, commaIndex); // skip "data:"
    const base64 = uri.substring(commaIndex + 1);
    const isBase64 = meta.endsWith(';base64');
    const mime = meta.replace(';base64', '') || 'image/jpeg';

    console.log('[ImageService] Data URI metadata:', {
      meta: meta,
      mime: mime,
      isBase64: isBase64,
      base64Length: base64.length,
    });

    let binary: string;
    try {
      if (isBase64) {
        console.log('[ImageService] Decoding base64...');
        binary = atob(base64);
      } else {
        console.log('[ImageService] Decoding URI component...');
        binary = decodeURIComponent(base64);
      }
    } catch (decodeError) {
      console.error('[ImageService] Error decoding data URI:', decodeError);
      throw new Error(
        `Failed to decode data URI: ${decodeError instanceof Error ? decodeError.message : String(decodeError)}`
      );
    }

    const len = binary.length;
    console.log('[ImageService] Binary length:', len);

    console.log('[ImageService] Creating Uint8Array...');
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    console.log('[ImageService] Creating Blob...');
    const blob = new Blob([bytes], { type: mime });

    console.log('[ImageService] ✅ Blob created successfully:', {
      size: blob.size,
      sizeKB: Math.round(blob.size / 1024),
      type: blob.type,
    });

    return blob;
  } catch (error) {
    console.error('[ImageService] ❌ Error in buildBlobFromDataUri:', error);
    throw error;
  }
};

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
              const dataUriSizeKB = Math.round(dataUri.length / 1024);
              console.log(
                '[ImageService] FileReader onload, data URI length:',
                dataUri?.length || 0,
                `(${dataUriSizeKB}KB)`
              );
              let finalUri = dataUri;

              // Always apply compression to ensure images don't exceed server limits
              // Chrome iOS was skipping compression, causing "Payload too large" errors
              try {
                console.log(
                  '[ImageService] Starting image compression from data URL...',
                  isChromeIOS ? '(Chrome iOS - compression required)' : ''
                );
                finalUri = await compressImageIfNeeded(dataUri);
                const finalSizeKB = Math.round(finalUri.length / 1024);
                console.log('[ImageService] Image compression completed:', {
                  originalSizeKB: dataUriSizeKB,
                  compressedSizeKB: finalSizeKB,
                  reduction: `${Math.round((1 - finalSizeKB / dataUriSizeKB) * 100)}%`,
                  finalUri: finalUri.substring(0, 50) + '...',
                });
              } catch (compressionError) {
                // If compression fails, check if original is too large
                console.error(
                  '[ImageService] Compression failed, checking original size:',
                  compressionError
                );

                // Check if original exceeds limit (500KB)
                if (dataUriSizeKB > MAX_IMAGE_SIZE_KB) {
                  console.error(
                    `[ImageService] ⚠️ Original image (${dataUriSizeKB}KB) exceeds limit (${MAX_IMAGE_SIZE_KB}KB) and compression failed!`
                  );
                  // Still try to use it, but log a warning
                  // The upload will likely fail with 413 error
                }

                finalUri = dataUri;
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
        new PermissionDeniedError('Photo library permission is required.')
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
        "Couldn't select the image. Please try again.",
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
              "Couldn't take the photo. Please try again.",
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
        new PermissionDeniedError('Camera permission is required.')
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
      new CameraError("Couldn't take the photo. Please try again.", error)
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
        error.response.data?.message ||
        'An error occurred while uploading the image.';
      return failure(new UploadError(message, error));
    }

    return failure(
      new UploadError(
        'Unexpected error while uploading the image. Please try again.',
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
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isChromeIOS = /CriOS/i.test(userAgent);
  const isWeb = Platform.OS === 'web';

  console.log('[ImageService] ===== UPLOAD VERIFICATION SELFIE START =====');
  console.log('[ImageService] Platform:', Platform.OS);
  console.log('[ImageService] User Agent:', userAgent);
  console.log('[ImageService] Is Chrome iOS:', isChromeIOS);
  console.log('[ImageService] Image URI type:', {
    startsWithData: imageUri.startsWith('data:'),
    startsWithBlob: imageUri.startsWith('blob:'),
    uriLength: imageUri.length,
    uriPreview: imageUri.substring(0, 50) + '...',
  });

  try {
    const tokens = useAuthStore.getState().tokens;
    if (!tokens?.accessToken) {
      console.error('[ImageService] ❌ No authentication token available');
      return failure(new UploadError('No authentication token available'));
    }

    console.log('[ImageService] ✅ Token available, creating FormData...');

    const formData = new FormData();

    if (isWeb) {
      let blob: Blob;
      let mimeType: string;

      try {
        if (imageUri.startsWith('data:')) {
          console.log(
            '[ImageService] 📸 Detected data URI, converting to blob...'
          );
          blob = buildBlobFromDataUri(imageUri);
          mimeType = blob.type || 'image/jpeg';
          console.log('[ImageService] ✅ Data URI converted to blob:', {
            blobSize: blob.size,
            blobSizeKB: Math.round(blob.size / 1024),
            mimeType: mimeType,
          });
        } else if (imageUri.startsWith('blob:')) {
          console.log('[ImageService] 📸 Detected blob URI, fetching...');
          const response = await fetch(imageUri);
          if (!response.ok) {
            throw new Error(
              `Failed to fetch blob: ${response.status} ${response.statusText}`
            );
          }
          blob = await response.blob();
          mimeType = blob.type || 'image/jpeg';
          console.log('[ImageService] ✅ Blob fetched:', {
            blobSize: blob.size,
            blobSizeKB: Math.round(blob.size / 1024),
            mimeType: mimeType,
          });
        } else {
          console.log('[ImageService] 📸 Fetching from URI...');
          const response = await fetch(imageUri);
          if (!response.ok) {
            throw new Error(
              `Failed to fetch image: ${response.status} ${response.statusText}`
            );
          }
          blob = await response.blob();
          mimeType = blob.type || 'image/jpeg';
          console.log('[ImageService] ✅ Image fetched:', {
            blobSize: blob.size,
            blobSizeKB: Math.round(blob.size / 1024),
            mimeType: mimeType,
          });
        }

        const filename = `verification.${mimeType === 'image/png' ? 'png' : 'jpg'}`;
        const file = new File([blob], filename, { type: mimeType });
        const fileSizeKB = Math.round(file.size / 1024);

        // Validate file size before upload to prevent 413 errors
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          const errorMessage = `The image is too large (${fileSizeKB} KB). The maximum allowed size is ${MAX_IMAGE_SIZE_KB} KB. Please choose a smaller image or compress it.`;
          console.error('[ImageService] ❌ File too large:', {
            fileSizeKB: fileSizeKB,
            maxSizeKB: MAX_IMAGE_SIZE_KB,
            exceedsBy: `${fileSizeKB - MAX_IMAGE_SIZE_KB}KB`,
          });
          return failure(
            new UploadError(
              errorMessage,
              new Error(
                `File size ${fileSizeKB}KB exceeds limit ${MAX_IMAGE_SIZE_KB}KB`
              )
            )
          );
        }

        formData.append('file', file);

        console.log('[ImageService] ✅ File added to FormData:', {
          filename: filename,
          fileSize: file.size,
          fileSizeKB: fileSizeKB,
          fileType: file.type,
          withinLimit: true,
        });
      } catch (blobError) {
        console.error('[ImageService] ❌ Error creating blob/file:', blobError);
        throw blobError;
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

      console.log('[ImageService] ✅ File added to FormData (React Native):', {
        filename: filename,
        type: type,
        uri: imageUri,
      });
    }

    console.log(
      '[ImageService] 📤 Sending POST request to:',
      `${API_URL}/users/me/verification`
    );
    console.log(
      '[ImageService] FormData entries count:',
      formData instanceof FormData ? 'FormData object created' : 'Unknown'
    );

    // IMPORTANT: Don't set Content-Type manually - let axios set it with boundary
    const headers: Record<string, string> = {
      Authorization: `Bearer ${tokens.accessToken}`,
    };

    console.log('[ImageService] Request headers:', {
      hasAuth: !!headers.Authorization,
      authLength: headers.Authorization?.length || 0,
      note: 'Content-Type will be set automatically by axios',
    });

    const response = await axios.post(
      `${API_URL}/users/me/verification`,
      formData,
      {
        headers,
        // Add timeout and other options
        timeout: 30000, // 30 seconds
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    console.log('[ImageService] ✅ Upload successful!', {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
    });

    return success(response.data as VerificationUploadResponse);
  } catch (error: unknown) {
    console.error('[ImageService] ===== UPLOAD ERROR =====');
    console.error('[ImageService] Error type:', error?.constructor?.name);
    console.error(
      '[ImageService] Error message:',
      error instanceof Error ? error.message : String(error)
    );
    console.error('[ImageService] Full error object:', error);

    if (axios.isAxiosError(error)) {
      console.error('[ImageService] Axios error details:', {
        message: error.message,
        code: error.code,
        response: error.response
          ? {
              status: error.response.status,
              statusText: error.response.statusText,
              data: error.response.data,
              headers: error.response.headers,
            }
          : 'No response',
        request: error.request
          ? {
              method: error.config?.method,
              url: error.config?.url,
              headers: error.config?.headers,
            }
          : 'No request',
        config: {
          method: error.config?.method,
          url: error.config?.url,
          baseURL: error.config?.baseURL,
          timeout: error.config?.timeout,
          headers: error.config?.headers,
        },
      });

      if (error.response) {
        // Handle specific error codes with user-friendly messages
        if (error.response.status === 413) {
          const message =
            'The image is too large. Please choose a smaller image. The maximum allowed size is 500 KB.';
          console.error(
            '[ImageService] ❌ 413 Payload Too Large - Image exceeds server limit'
          );
          return failure(new UploadError(message, error));
        }

        const message =
          error.response.data?.message ||
          `Server error: ${error.response.status} ${error.response.statusText}`;
        return failure(new UploadError(message, error));
      } else if (error.request) {
        const message =
          error.message || 'Network error - no response from server';
        console.error(
          '[ImageService] Network error - request was made but no response received'
        );
        return failure(new UploadError(message, error));
      } else {
        const message = error.message || 'Request setup error';
        return failure(new UploadError(message, error));
      }
    }

    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unexpected error while uploading the verification selfie.';
    console.error('[ImageService] Non-axios error:', errorMessage);

    return failure(
      new UploadError(
        errorMessage,
        error instanceof Error ? error : new Error(String(error))
      )
    );
  } finally {
    console.log('[ImageService] ===== UPLOAD VERIFICATION SELFIE END =====');
  }
}
