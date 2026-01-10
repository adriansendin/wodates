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
    return 'Invalid file (must be a .zip)';
  }

  // Check file size
  if (file.size && file.size > MAX_FILE_SIZE_BYTES) {
    return 'Maximum size allowed: 500 KB.\nDo not upload multimedia content.';
  }

  // Check file extension (fallback if MIME type is not available)
  if (!file.mimeType && file.name) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'zip') {
      return 'Invalid file (must be a .zip)';
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
        "Couldn't select the file. Please try again.",
        error
      )
    );
  }
}

/**
 * Uploads a ZIP file to the backend API, which handles Supabase Storage upload
 * and automatically registers it in external_chat_files table
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
        interface FileWithFile extends DocumentPicker.DocumentPickerAsset {
          file?: File;
        }
        const fileWithFile = file as FileWithFile;
        if (fileWithFile.file instanceof File) {
          console.log('[ZipUploadService] Using file object directly');
          formData.append('file', fileWithFile.file);
        } else {
          console.error(
            '[ZipUploadService] No file object available, throwing error'
          );
          throw new UploadError("Couldn't access the file for upload.");
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
    // Backend now returns id and createdAt, but we keep the same return structure for compatibility
    return success({
      uploadZipPath: response.data.uploadZipPath,
      fileSizeBytes: response.data.fileSizeBytes,
    });
  } catch (error: unknown) {
    console.error('[ZipUploadService] Error uploading ZIP:', error);

    if (axios.isAxiosError(error)) {
      console.error('[ZipUploadService] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      if (error.response) {
        const message =
          error.response.data?.message || 'An error occurred while uploading the file.';
        return failure(new UploadError(message, error));
      }
    }

    return failure(
      new UploadError(
        'Unexpected error while uploading the file. Please try again.',
        error instanceof Error ? error : new Error(String(error))
      )
    );
  }
}

/**
 * Uploads a ZIP file to Supabase Storage via backend
 * @param file - The ZIP file to upload
 * @returns {Promise<Result<string, DomainError>>} Result with success message or error
 */
/**
 * Uploads a ZIP file to Supabase Storage via backend
 * The backend automatically registers the file in external_chat_files table
 * @param file - The ZIP file to upload
 * @returns {Promise<Result<string, DomainError>>} Result with success message or error
 */
export async function uploadZipFile(
  file: DocumentPicker.DocumentPickerAsset
): Promise<Result<string, DomainError>> {
  try {
    // Upload file to backend (backend uploads to Supabase Storage and registers in external_chat_files)
    const uploadResult = await uploadZipToBackend(file);
    if (!uploadResult.success) {
      return failure(uploadResult.error);
    }

    return success('Uploaded successfully.');
  } catch (error) {
    console.error(
      '[ZipUploadService] Unexpected error uploading ZIP file:',
      error
    );
    return failure(
      new UploadError(
        'Unexpected error while uploading the file. Please try again.',
        error
      )
    );
  }
}
