import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Platform } from 'react-native';
import { Result, success, failure } from '../../domain/Result';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  ServerError,
  UnauthorizedError,
  UnexpectedError,
  ValidationError,
} from '../../domain/errors/DomainError';

/** Multipart uploads (emulator / slow I/O) can exceed the default 10s client timeout. */
const FORM_DATA_UPLOAD_TIMEOUT_MS = 120_000;

/** Axios uses this when the response body has no usable message — never show it to users. */
const AXIOS_GENERIC_STATUS_MESSAGE = /^Request failed with status code \d+$/i;

export class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      // Don't set Content-Type by default - we'll set it per request
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (!error.response) {
          const message =
            axios.isAxiosError(error) && error.code === 'ECONNABORTED'
              ? 'Request timed out'
              : axios.isAxiosError(error) && error.message
                ? error.message
                : 'Network error';
          throw new NetworkError(message);
        }

        if (error.response.status === 401) {
          const message =
            typeof error.response.data === 'object' &&
            error.response.data !== null &&
            'message' in error.response.data
              ? String(
                  (error.response.data as { message?: unknown }).message ??
                    'Unauthorized'
                )
              : 'Unauthorized';

          throw new UnauthorizedError(message);
        }

        throw error;
      }
    );
  }

  async get<T>(
    url: string,
    token?: string,
    timeout?: number
  ): Promise<Result<T, DomainError>> {
    try {
      const response: AxiosResponse<T> = await this.client.get(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        timeout: timeout,
      });
      return success(response.data);
    } catch (error) {
      return failure(this.handleError(error));
    }
  }

  async post<T>(
    url: string,
    data?: unknown,
    token?: string,
    signal?: AbortSignal
  ): Promise<Result<T, DomainError>> {
    // Axios + React Native FormData (file/content URIs) often fails with a generic
    // "Network Error". Native fetch uses the RN networking stack correctly.
    if (
      data instanceof FormData &&
      Platform.OS !== 'web'
    ) {
      return this.postFormDataNative<T>(url, data, token, signal);
    }

    try {
      const fullUrl = `${this.client.defaults.baseURL}${url}`;
      console.log(`[ApiClient] POST ${fullUrl}`, {
        data: data ? '***' : undefined,
        isFormData: data instanceof FormData,
      });

      const headers: Record<string, string | undefined> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      if (data instanceof FormData) {
        headers['Content-Type'] = undefined;
      } else {
        headers['Content-Type'] = 'application/json';
      }

      const extraConfig: AxiosRequestConfig =
        data instanceof FormData
          ? {
              timeout: FORM_DATA_UPLOAD_TIMEOUT_MS,
              maxBodyLength: Infinity,
              maxContentLength: Infinity,
            }
          : {};

      const response: AxiosResponse<T> = await this.client.post(url, data, {
        headers,
        signal,
        ...extraConfig,
      });
      return success(response.data);
    } catch (error) {
      const fullUrl = `${this.client.defaults.baseURL}${url}`;
      if (axios.isAxiosError(error)) {
        const errorDetails = {
          message: error.message,
          code: error.code,
          response: error.response
            ? {
                status: error.response.status,
                data: error.response.data,
              }
            : 'No response',
          request: error.request
            ? 'Request made but no response'
            : 'No request made',
          timeout:
            error.code === 'ECONNABORTED' ? 'Request timeout' : undefined,
          networkError:
            error.code === 'ERR_NETWORK'
              ? 'Network error - check firewall/network'
              : undefined,
        };
        console.error(`[ApiClient] POST ${fullUrl} failed:`, errorDetails);

        if (!error.response && !error.request) {
          console.error(
            `[ApiClient] TROUBLESHOOTING: Request never left the device. Check:`
          );
          console.error(
            `  - Backend is running on ${this.client.defaults.baseURL}`
          );
          console.error(`  - Firewall allows connections on port 3000`);
          console.error(`  - iPhone and computer are on the same WiFi network`);
          const baseURL = this.client.defaults.baseURL;
          if (baseURL) {
            const ipAddress = baseURL.replace('http://', '').split(':')[0];
            console.error(`  - IP address ${ipAddress} is reachable`);
          }
        }
      } else {
        console.error(`[ApiClient] POST ${fullUrl} failed:`, error);
      }
      return failure(this.handleError(error));
    }
  }

  /**
   * Multipart POST for native: avoids Axios + RN FormData issues (generic "Network Error").
   */
  private async postFormDataNative<T>(
    url: string,
    formData: FormData,
    token?: string,
    signal?: AbortSignal
  ): Promise<Result<T, DomainError>> {
    const fullUrl = `${this.client.defaults.baseURL}${url}`;
    console.log(`[ApiClient] POST (fetch/native) ${fullUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      FORM_DATA_UPLOAD_TIMEOUT_MS
    );

    const onExternalAbort = () => controller.abort();
    if (signal) {
      signal.addEventListener('abort', onExternalAbort);
    }

    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(fullUrl, {
        method: 'POST',
        body: formData,
        headers,
        signal: controller.signal,
      });

      const text = await res.text();
      let body: unknown = {};
      if (text) {
        try {
          body = JSON.parse(text) as unknown;
        } catch {
          body = { raw: text };
        }
      }

      if (res.ok) {
        return success(body as T);
      }

      return failure(this.domainErrorFromHttpResponse(res.status, body));
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return failure(new NetworkError('Request timed out'));
      }
      console.error(`[ApiClient] POST (fetch/native) ${fullUrl} failed:`, error);
      return failure(
        new NetworkError(
          error instanceof Error ? error.message : 'Network error'
        )
      );
    } finally {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  private domainErrorFromHttpResponse(
    status: number,
    body: unknown
  ): DomainError {
    const message = this.messageFromErrorBody(
      body,
      this.defaultHttpErrorMessage(status)
    );

    if (status === 400) {
      const details =
        typeof body === 'object' && body !== null && 'details' in body
          ? (body as { details: unknown }).details
          : undefined;
      return new ValidationError(message, details);
    }
    if (status === 401) {
      return new UnauthorizedError(message);
    }
    if (status === 403) {
      return new ForbiddenError(message);
    }
    if (status === 404) {
      return new NotFoundError(message);
    }
    if (status === 409) {
      return new ConflictError(message);
    }
    if (status === 429) {
      return new UnexpectedError(message);
    }
    if (status >= 500) {
      return new ServerError(message);
    }
    return new UnexpectedError(message);
  }

  private messageFromErrorBody(body: unknown, fallback: string): string {
    if (
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      (body as { message?: unknown }).message != null
    ) {
      return String((body as { message: unknown }).message);
    }
    return fallback;
  }

  private isGenericAxiosStatusMessage(message: string | undefined): boolean {
    return (
      message !== undefined && AXIOS_GENERIC_STATUS_MESSAGE.test(message.trim())
    );
  }

  /** Short English fallback for DomainError.message when the transport gives no API message. */
  private defaultHttpErrorMessage(status: number): string {
    if (status === 400) return 'Invalid request';
    if (status === 401) return 'Unauthorized';
    if (status === 403) return 'Forbidden';
    if (status === 404) return 'Not found';
    if (status === 409) return 'Conflict';
    if (status === 429) return 'Too many requests';
    if (status >= 500) return 'Service unavailable';
    return 'Unexpected response';
  }

  async put<T>(
    url: string,
    data?: unknown,
    token?: string
  ): Promise<Result<T, DomainError>> {
    try {
      const headers: Record<string, string | undefined> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      headers['Content-Type'] = 'application/json';

      console.log(`[ApiClient] PUT ${this.client.defaults.baseURL}${url}`, {
        hasData: !!data,
        dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
        dataStringified: data ? JSON.stringify(data) : undefined,
      });

      const response: AxiosResponse<T> = await this.client.put(url, data, {
        headers,
      });
      return success(response.data);
    } catch (error) {
      return failure(this.handleError(error));
    }
  }

  async delete<T>(
    url: string,
    token?: string
  ): Promise<Result<T, DomainError>> {
    try {
      const response: AxiosResponse<T> = await this.client.delete(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return success(response.data);
    } catch (error) {
      return failure(this.handleError(error));
    }
  }

  private handleError(error: unknown): DomainError {
    if (error instanceof DomainError) {
      return error;
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const rawMessage =
        typeof error.response?.data === 'object' &&
        error.response?.data !== null &&
        'message' in error.response.data
          ? String(
              (error.response.data as { message?: unknown }).message ??
                error.message
            )
          : error.message;

      const message = this.isGenericAxiosStatusMessage(rawMessage)
        ? undefined
        : rawMessage;

      if (!status) {
        const netMsg =
          message && !this.isGenericAxiosStatusMessage(message)
            ? message
            : 'Network error';
        return new NetworkError(netMsg);
      }

      const fallback = this.defaultHttpErrorMessage(status);

      if (status === 400) {
        const details =
          typeof error.response?.data === 'object' &&
          error.response?.data !== null &&
          'details' in error.response.data
            ? error.response.data.details
            : undefined;
        return new ValidationError(message ?? fallback, details);
      }
      if (status === 401) {
        return new UnauthorizedError(message ?? fallback);
      }
      if (status === 403) {
        return new ForbiddenError(message ?? fallback);
      }
      if (status === 404) {
        return new NotFoundError(message ?? fallback);
      }
      if (status === 409) {
        return new ConflictError(message ?? fallback);
      }
      if (status === 429) {
        return new UnexpectedError(message ?? fallback);
      }
      if (status >= 500) {
        return new ServerError(message ?? fallback);
      }

      return new UnexpectedError(message ?? fallback);
    }

    return new NetworkError('Unknown error');
  }
}
