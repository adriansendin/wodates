import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';
import { useAuthStore } from '../../domain/stores/authStore';
import { Result, success, failure } from '../../domain/Result';
import { DomainError, UploadError } from '../../domain/errors/DomainError';
import { getApiUrl } from '../../utils/apiConfig';

const API_URL = getApiUrl();
const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500 KB
const ALLOWED_MIME_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
];

/**
 * Validates a ZIP file
 * @param file - The file to validate
 * @returns Error message if invalid, null if valid
 */
function validateZipFile(
  file: DocumentPicker.DocumentPickerAsset
): string | null {
  // Check MIME type (accept multiple ZIP MIME types)
  if (file.mimeType && !ALLOWED_MIME_TYPES.includes(file.mimeType)) {
    return 'Archivo no válido (debe ser .zip)';
  }

  // Check file size
  if (file.size && file.size > MAX_FILE_SIZE_BYTES) {
    return 'Máximo permitido: 500 KB';
  }

  // Check file extension (fallback if MIME type is not available)
  if (!file.mimeType && file.name) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'zip') {
      return 'Archivo no válido (debe ser .zip)';
    }
  }

  return null;
}

/**
 * Picks a ZIP file from the device
 * @returns {Promise<Result<DocumentPicker.DocumentPickerAsset | null, DomainError>>}
 */
export async function pickZipFile(): Promise<
  Result<DocumentPicker.DocumentPickerAsset | null, DomainError>
> {
  try {
    console.log('[ZipUploadService] Picking ZIP file, Platform:', Platform.OS);
    const result = await DocumentPicker.getDocumentAsync({
      type: Platform.OS === 'web' ? ['application/zip'] : ['application/zip'],
      copyToCacheDirectory: true,
    });

    console.log('[ZipUploadService] DocumentPicker result:', {
      canceled: result.canceled,
      assetsCount: result.assets?.length,
    });

    if (result.canceled) {
      console.log('[ZipUploadService] User canceled file pick');
      return success(null);
    }

    const file = result.assets[0];
    console.log('[ZipUploadService] Selected file:', {
      name: file.name,
      size: file.size,
      mimeType: file.mimeType,
      uri: file.uri?.substring(0, 50) + '...',
    });

    // Validate file
    const validationError = validateZipFile(file);
    if (validationError) {
      console.error('[ZipUploadService] Validation failed:', validationError);
      return failure(new UploadError(validationError));
    }

    console.log('[ZipUploadService] File validation passed');
    return success(file);
  } catch (error) {
    console.error('[ZipUploadService] Error picking ZIP file:', error);
    return failure(
      new UploadError(
        'Error al seleccionar el archivo. Inténtalo de nuevo.',
        error
      )
    );
  }
}

/**
 * Uploads a ZIP file to the backend API, which handles Supabase Storage upload
 * Same pattern as avatar upload
 * @param file - The ZIP file to upload
 * @returns {Promise<Result<{ uploadZipPath: string; fileSizeBytes: number }, DomainError>>}
 */
async function uploadZipToBackend(
  file: DocumentPicker.DocumentPickerAsset
): Promise<
  Result<{ uploadZipPath: string; fileSizeBytes: number }, DomainError>
> {
  try {
    console.log(
      '[ZipUploadService] Starting upload to backend, Platform:',
      Platform.OS
    );
    const tokens = useAuthStore.getState().tokens;
    if (!tokens?.accessToken) {
      console.error('[ZipUploadService] No auth token available');
      return failure(new UploadError('No authentication token available'));
    }

    // Create FormData with the ZIP file
    const formData = new FormData();

    if (Platform.OS === 'web') {
      console.log(
        '[ZipUploadService] Web platform - processing file URI:',
        file.uri?.substring(0, 50)
      );
      // On web, handle blob URLs or file URIs
      try {
        if (file.uri.startsWith('blob:')) {
          console.log('[ZipUploadService] Fetching blob URL...');
          // Fetch the blob URL to get the Blob
          const response = await fetch(file.uri);
          const blob = await response.blob();
          console.log('[ZipUploadService] Blob fetched:', {
            size: blob.size,
            type: blob.type,
          });
          const fileObj = new File([blob], file.name || 'upload.zip', {
            type: 'application/zip',
          });
          formData.append('file', fileObj);
        } else {
          console.log('[ZipUploadService] Fetching file URI...');
          // Try to fetch as file
          const response = await fetch(file.uri);
          const blob = await response.blob();
          console.log('[ZipUploadService] File fetched:', {
            size: blob.size,
            type: blob.type,
          });
          const fileObj = new File([blob], file.name || 'upload.zip', {
            type: 'application/zip',
          });
          formData.append('file', fileObj);
        }
        console.log('[ZipUploadService] File added to FormData');
      } catch (fetchError) {
        console.error(
          '[ZipUploadService] Error fetching file for web upload:',
          fetchError
        );
        // Fallback: try to use file object directly if available (some DocumentPicker implementations expose it)
        if ((file as any).file instanceof File) {
          console.log('[ZipUploadService] Using file object directly');
          formData.append('file', (file as any).file);
        } else {
          console.error(
            '[ZipUploadService] No file object available, throwing error'
          );
          throw new UploadError('No se pudo acceder al archivo para subir.');
        }
      }
    } else {
      console.log(
        '[ZipUploadService] React Native platform - using URI format'
      );
      // In React Native, provide file info in specific format
      const filename = file.name || 'upload.zip';
      // @ts-expect-error - FormData in React Native accepts this format
      formData.append('file', {
        uri: file.uri,
        type: 'application/zip',
        name: filename,
      });
    }

    console.log(
      '[ZipUploadService] Sending POST request to:',
      `${API_URL}/storage/upload-zip`
    );
    // Upload to backend API endpoint
    const response = await axios.post(
      `${API_URL}/storage/upload-zip`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      }
    );

    console.log('[ZipUploadService] Upload successful:', response.data);
    return success({
      uploadZipPath: response.data.uploadZipPath,
      fileSizeBytes: response.data.fileSizeBytes,
    });
  } catch (error: any) {
    console.error('[ZipUploadService] Error uploading ZIP:', error);
    console.error('[ZipUploadService] Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    if (error.response) {
      const message =
        error.response.data?.message || 'Error al subir el archivo.';
      return failure(new UploadError(message, error));
    }

    return failure(
      new UploadError(
        'Error inesperado al subir el archivo. Inténtalo de nuevo.',
        error
      )
    );
  }
}

/**
 * Registers the uploaded file in the imported_conversations table
 * @param uploadZipPath - The path of the uploaded file
 * @param fileSizeBytes - The size of the file in bytes
 * @returns {Promise<Result<void, DomainError>>}
 */
async function registerUpload(
  uploadZipPath: string,
  fileSizeBytes: number
): Promise<Result<void, DomainError>> {
  try {
    const tokens = useAuthStore.getState().tokens;
    if (!tokens?.accessToken) {
      return failure(new UploadError('No authentication token available'));
    }

    await axios.post(
      `${API_URL}/storage/register-upload`,
      {
        uploadZipPath,
        fileSizeBytes,
        source: 'whatsapp',
        ingress: 'doclove',
      },
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return success(undefined);
  } catch (error: any) {
    console.error('[ZipUploadService] Error registering upload:', error);

    if (error.response) {
      const message =
        error.response.data?.message || 'No se pudo registrar la subida.';
      return failure(new UploadError(message, error));
    }

    return failure(
      new UploadError(
        'Error inesperado al registrar la subida. Inténtalo de nuevo.',
        error
      )
    );
  }
}

/**
 * Uploads a ZIP file to Supabase Storage via backend
 * @param file - The ZIP file to upload
 * @returns {Promise<Result<string, DomainError>>} Result with success message or error
 */
export async function uploadZipFile(
  file: DocumentPicker.DocumentPickerAsset
): Promise<Result<string, DomainError>> {
  try {
    // Step 1: Upload file to backend (backend uploads to Supabase Storage)
    const uploadResult = await uploadZipToBackend(file);
    if (!uploadResult.success) {
      return failure(uploadResult.error);
    }

    const { uploadZipPath, fileSizeBytes } = uploadResult.data;

    // Step 2: Register upload in database
    const registerResult = await registerUpload(uploadZipPath, fileSizeBytes);
    if (!registerResult.success) {
      // Note: File is already uploaded, but registration failed
      // We still return success since the file is in storage
      console.warn(
        '[ZipUploadService] File uploaded but registration failed:',
        registerResult.error
      );
    }

    return success('Subido con éxito.');
  } catch (error) {
    console.error(
      '[ZipUploadService] Unexpected error uploading ZIP file:',
      error
    );
    return failure(
      new UploadError(
        'Error inesperado al subir el archivo. Inténtalo de nuevo.',
        error
      )
    );
  }
}
