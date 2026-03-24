import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { UserPhotoApi } from '../../../data/api/userPhotoApi';
import { ApiClient } from '../../../data/api/apiClient';
import { UserPhoto } from '../../../domain/models/UserPhoto';
import { Result } from '../../../domain/Result';
import { DomainError, ServerError } from '../../../domain/errors/DomainError';
import { useAuthStore } from '../../../domain/stores/authStore';
import { getApiUrl } from '../../../utils/apiConfig';

const MAX_IMAGE_SIZE_KB = 500;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_KB * 1024;

/** content:// URIs often have no file extension; OkHttp multipart needs a sensible name/type. */
function androidMultipartFile(uri: string): {
  uri: string;
  name: string;
  type: string;
} {
  const raw = uri.split('/').pop()?.split('?')[0] ?? 'photo.jpg';
  const name = /\.[a-zA-Z0-9]{2,5}$/.test(raw) ? raw : `${raw}.jpg`;
  const ext = /\.(\w+)$/.exec(name)?.[1]?.toLowerCase() ?? 'jpg';
  const type =
    ext === 'png'
      ? 'image/png'
      : ext === 'webp'
        ? 'image/webp'
        : 'image/jpeg';
  return { uri, name, type };
}

export function useUserPhotos(userId: string | null) {
  const [photos, setPhotos] = useState<UserPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingMain, setIsSettingMain] = useState(false);
  const { tokens } = useAuthStore();

  const apiClient = useMemo(() => new ApiClient(getApiUrl()), []);
  const photoApi = useMemo(() => new UserPhotoApi(apiClient), [apiClient]);
  const photoApiRef = useRef(photoApi);
  photoApiRef.current = photoApi;

  const loadPhotos = useCallback(async () => {
    if (!userId || !tokens?.accessToken) {
      console.log(
        '[useUserPhotos] Skipping loadPhotos - missing userId or token'
      );
      return;
    }

    console.log('[useUserPhotos] Loading photos for user:', userId);
    setIsLoading(true);
    setError(null);

    try {
      const result = await photoApiRef.current.listUserPhotos(
        tokens.accessToken
      );
      console.log(
        '[useUserPhotos] Photos loaded:',
        result.success ? `${result.data.length} photos` : 'failed',
        result
      );
      if (result.success) {
        console.log(
          '[useUserPhotos] Setting photos:',
          result.data.map((p) => ({
            id: p.id,
            is_main: p.is_main,
            position: p.position,
          }))
        );
        setPhotos(result.data);
      } else {
        setError(result.error.message);
      }
    } catch (err) {
      setError('Failed to load photos');
      console.error('[useUserPhotos] Error loading photos:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, tokens?.accessToken]);

  const loadPhotosRef = useRef(loadPhotos);
  loadPhotosRef.current = loadPhotos;

  useEffect(() => {
    if (userId && tokens?.accessToken) {
      loadPhotosRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tokens?.accessToken]);

  const uploadPhoto = useCallback(
    async (imageUri: string): Promise<Result<UserPhoto, DomainError>> => {
      console.log(
        '[useUserPhotos] uploadPhoto called with imageUri:',
        imageUri
      );

      if (!userId || !tokens?.accessToken) {
        console.error('[useUserPhotos] Missing userId or token:', {
          userId,
          hasToken: !!tokens?.accessToken,
        });
        return {
          success: false,
          error: new ServerError('User ID or token required'),
        } as Result<UserPhoto, DomainError>;
      }

      setIsUploading(true);
      setError(null);

      try {
        console.log(
          '[useUserPhotos] Creating FormData, Platform.OS:',
          Platform.OS,
          'imageUri length:',
          imageUri?.length || 0
        );
        const formData = new FormData();
        if (Platform.OS === 'web') {
          const webFile = await prepareWebUploadFile(imageUri);
          const blobSizeKB = Math.round(webFile.blob.size / 1024);
          console.log('[useUserPhotos] Web file ready for upload:', {
            mimeType: webFile.mimeType,
            sizeKB: blobSizeKB,
            filename: webFile.filename,
          });

          // Check if image exceeds 500KB limit
          const MAX_SIZE_BYTES = 500 * 1024; // 500KB
          if (webFile.blob.size > MAX_SIZE_BYTES) {
            console.warn(
              `[useUserPhotos] WARNING: Image size (${blobSizeKB}KB) exceeds 500KB limit!`
            );
            console.warn(
              '[useUserPhotos] Compression should have been applied but image is still too large.'
            );
            console.warn(
              '[useUserPhotos] This may cause upload to fail if bucket has size restrictions.'
            );
          }

          const file = new File([webFile.blob], webFile.filename, {
            type: webFile.mimeType,
          });
          formData.append('file', file);
        } else {
          const { uri, name, type } = androidMultipartFile(imageUri);
          // @ts-expect-error - FormData in React Native accepts this format
          formData.append('file', {
            uri,
            type,
            name,
          });
          console.log('[useUserPhotos] FormData created for React Native:', {
            uri,
            type,
            filename: name,
          });
        }

        console.log('[useUserPhotos] Calling photoApi.addUserPhoto...');
        const result = await photoApiRef.current.addUserPhoto(
          formData,
          tokens.accessToken
        );
        console.log('[useUserPhotos] photoApi.addUserPhoto result:', result);

        if (result.success) {
          console.log('[useUserPhotos] Upload successful, reloading photos...');
          await loadPhotosRef.current();
        } else {
          console.error('[useUserPhotos] Upload failed:', result.error);
          setError(result.error.message);
        }
        return result;
      } catch (err) {
        console.error('[useUserPhotos] Exception in uploadPhoto:', err);
        const error = new ServerError('Failed to upload photo');
        setError(error.message);
        return {
          success: false,
          error,
        } as Result<UserPhoto, DomainError>;
      } finally {
        setIsUploading(false);
      }
    },
    [userId, tokens?.accessToken]
  );

  const deletePhoto = useCallback(
    async (photoId: string): Promise<Result<void, DomainError>> => {
      if (!userId || !tokens?.accessToken) {
        return {
          success: false,
          error: new ServerError('User ID or token required'),
        } as Result<void, DomainError>;
      }

      setIsDeleting(true);
      setError(null);

      try {
        const result = await photoApiRef.current.deleteUserPhoto(
          photoId,
          tokens.accessToken
        );
        if (result.success) {
          await loadPhotosRef.current();
        } else {
          setError(result.error.message);
        }
        return result;
      } catch (err) {
        const error = new ServerError('Failed to delete photo');
        setError(error.message);
        return {
          success: false,
          error,
        } as Result<void, DomainError>;
      } finally {
        setIsDeleting(false);
      }
    },
    [userId, tokens?.accessToken]
  );

  const setMainPhoto = useCallback(
    async (photoId: string): Promise<Result<UserPhoto, DomainError>> => {
      if (!userId || !tokens?.accessToken) {
        return {
          success: false,
          error: new ServerError('User ID or token required'),
        } as Result<UserPhoto, DomainError>;
      }

      setIsSettingMain(true);
      setError(null);

      try {
        const result = await photoApiRef.current.setMainPhoto(
          photoId,
          tokens.accessToken
        );
        if (result.success) {
          await loadPhotosRef.current();
        } else {
          setError(result.error.message);
        }
        return result;
      } catch (err) {
        const error = new ServerError('Failed to set main photo');
        setError(error.message);
        return {
          success: false,
          error,
        } as Result<UserPhoto, DomainError>;
      } finally {
        setIsSettingMain(false);
      }
    },
    [userId, tokens?.accessToken]
  );

  return {
    photos,
    isLoading,
    error,
    isUploading,
    isDeleting,
    isSettingMain,
    uploadPhoto,
    deletePhoto,
    setMainPhoto,
    refreshPhotos: loadPhotos,
  };
}

/**
 * Converts a data URI to a Blob object
 * @param uri - The data URI to convert
 * @returns {Blob} The converted blob
 */
function buildBlobFromDataUri(uri: string): Blob {
  const commaIndex = uri.indexOf(',');
  const meta = uri.substring(5, commaIndex); // skip "data:"
  const base64 = uri.substring(commaIndex + 1);
  const isBase64 = meta.endsWith(';base64');
  const mime = meta.replace(';base64', '') || 'image/jpeg';
  const binary = isBase64 ? atob(base64) : decodeURIComponent(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

async function prepareWebUploadFile(imageUri: string): Promise<{
  blob: Blob;
  mimeType: string;
  filename: string;
}> {
  console.log('[useUserPhotos] Preparing web upload file from URI:', imageUri);
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isChromeIOS = /CriOS/i.test(ua);
  let blob: Blob;

  try {
    if (imageUri.startsWith('data:')) {
      console.log(
        '[useUserPhotos] Detected data URI, converting locally (no fetch)'
      );
      blob = buildBlobFromDataUri(imageUri);
    } else {
      const response = await fetch(imageUri);
      if (!response.ok) {
        console.error('[useUserPhotos] Fetch failed for imageUri', {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
        });
        throw new Error(
          `Failed to fetch image: ${response.status} ${response.statusText}`
        );
      }
      blob = await response.blob();
      console.log('[useUserPhotos] Fetched blob from URI', {
        sizeKB: Math.round(blob.size / 1024),
        type: blob.type,
      });
    }
  } catch (fetchError) {
    console.error(
      '[useUserPhotos] Error fetching/converting image URI for upload:',
      fetchError
    );
    throw fetchError;
  }

  console.log(
    '[useUserPhotos] Initial blob size:',
    Math.round(blob.size / 1024),
    'KB'
  );

  blob = await compressImageIfNeeded(blob, imageUri, isChromeIOS);

  const mimeType = (blob.type || 'image/jpeg').toLowerCase();

  const filename =
    mimeType === 'image/png'
      ? 'photo.png'
      : mimeType.includes('heic')
        ? 'photo.heic'
        : 'photo.jpg';

  console.log('[useUserPhotos] Final upload file prepared:', {
    sizeKB: Math.round(blob.size / 1024),
    mimeType,
    filename,
  });

  return { blob, mimeType, filename };
}

// Compression function matching mobile native logic
async function compressImageIfNeeded(
  blob: Blob,
  imageUri: string,
  isChromeIOS: boolean
): Promise<Blob> {
  try {
    if (blob.size <= MAX_IMAGE_SIZE_BYTES) {
      console.log('[useUserPhotos] Image size OK, no compression needed');
      return blob;
    }

    console.log(
      `[useUserPhotos] Image size: ${Math.round(blob.size / 1024)}KB, compressing...`
    );

    const mimeType = (blob.type || 'image/jpeg').toLowerCase();
    const isHeicLike =
      mimeType.includes('heic') ||
      mimeType.includes('heif') ||
      mimeType === 'application/octet-stream' ||
      mimeType === '';

    // Handle HEIC conversion first if needed
    if (isHeicLike && !isChromeIOS) {
      console.log('[useUserPhotos] Converting HEIC to JPEG before compression');
      try {
        const converted = await ImageManipulator.manipulateAsync(
          imageUri,
          [], // no resize here, only format conversion
          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
        );
        // Handle data URIs correctly
        if (converted.uri.startsWith('data:')) {
          console.log(
            '[useUserPhotos] Converted result is data URI, converting to blob...'
          );
          blob = buildBlobFromDataUri(converted.uri);
        } else {
          const convertedResponse = await fetch(converted.uri);
          blob = await convertedResponse.blob();
        }
        console.log(
          '[useUserPhotos] HEIC conversion completed, new size (KB):',
          Math.round(blob.size / 1024)
        );
      } catch (conversionError) {
        console.error(
          '[useUserPhotos] Failed to convert HEIC to JPEG, continuing with original',
          conversionError
        );
      }
    }

    // Apply compression if still too large
    if (blob.size <= MAX_IMAGE_SIZE_BYTES) {
      return blob;
    }

    let quality = 0.8;
    let compressedBlob = blob;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        const result = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: 800 } }],
          { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
        );

        // Handle data URIs correctly (ImageManipulator returns data URIs in web)
        // fetch() can fail with data URIs in Chrome iOS, so we convert directly
        if (result.uri.startsWith('data:')) {
          console.log(
            '[useUserPhotos] Compressed result is data URI, converting to blob...'
          );
          compressedBlob = buildBlobFromDataUri(result.uri);
        } else {
          const compressedResponse = await fetch(result.uri);
          compressedBlob = await compressedResponse.blob();
        }

        const compressedSizeKB = Math.round(compressedBlob.size / 1024);
        console.log(
          `[useUserPhotos] Compression attempt ${attempts + 1}: Quality ${quality.toFixed(2)}, Size: ${compressedSizeKB}KB`
        );

        if (compressedBlob.size <= MAX_IMAGE_SIZE_BYTES) {
          console.log(
            `[useUserPhotos] ✓ Compression successful: ${compressedSizeKB}KB`
          );
          return compressedBlob;
        }

        quality -= 0.15;
        attempts++;

        if (quality < 0.1) {
          console.log(
            `[useUserPhotos] ⚠ Could not compress below ${MAX_IMAGE_SIZE_KB}KB. Using best result: ${compressedSizeKB}KB`
          );
          return compressedBlob;
        }
      } catch (error) {
        console.error(
          `[useUserPhotos] Compression attempt ${attempts + 1} failed:`,
          error
        );
        quality -= 0.15;
        attempts++;
        if (attempts >= maxAttempts) {
          console.error(
            '[useUserPhotos] All compression attempts failed, using original blob'
          );
          return blob;
        }
      }
    }

    return compressedBlob;
  } catch (error) {
    console.error('[useUserPhotos] Compression error:', error);
    return blob; // Return original if compression fails
  }
}
