import axios, { AxiosInstance, AxiosResponse } from 'axios';
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

export class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        // In v0.1, we'll add token from store
        // For now, we'll handle this in the individual API calls
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (!error.response) {
          throw new NetworkError('Network error');
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

  async get<T>(url: string, token?: string): Promise<Result<T, DomainError>> {
    try {
      const response: AxiosResponse<T> = await this.client.get(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return success(response.data);
    } catch (error) {
      return failure(this.handleError(error));
    }
  }

  async post<T>(
    url: string,
    data?: unknown,
    token?: string
  ): Promise<Result<T, DomainError>> {
    try {
      const fullUrl = `${this.client.defaults.baseURL}${url}`;
      console.log(`[ApiClient] POST ${fullUrl}`, {
        data: data ? '***' : undefined,
      });

      const response: AxiosResponse<T> = await this.client.post(url, data, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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

        // Log specific troubleshooting info for network errors
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

  async put<T>(
    url: string,
    data?: unknown,
    token?: string
  ): Promise<Result<T, DomainError>> {
    try {
      const response: AxiosResponse<T> = await this.client.put(url, data, {
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
      const message =
        typeof error.response?.data === 'object' &&
        error.response?.data !== null &&
        'message' in error.response.data
          ? String(
              (error.response.data as { message?: unknown }).message ??
                error.message
            )
          : error.message;

      if (!status) {
        return new NetworkError(message ?? 'Network error');
      }

      if (status === 400) {
        return new ValidationError(message ?? 'Invalid request');
      }
      if (status === 401) {
        return new UnauthorizedError(message ?? 'Unauthorized');
      }
      if (status === 403) {
        return new ForbiddenError(message ?? 'Forbidden');
      }
      if (status === 404) {
        return new NotFoundError(message ?? 'Not found');
      }
      if (status === 409) {
        return new ConflictError(message ?? 'Conflict detected');
      }
      if (status >= 500) {
        return new ServerError(message ?? 'Server error');
      }

      return new UnexpectedError(message ?? 'Unexpected response');
    }

    return new NetworkError('Unknown error');
  }
}
