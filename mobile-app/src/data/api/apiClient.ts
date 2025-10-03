import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { Result, success, failure } from '../../domain/Result';
import { DomainError, NetworkError, UnauthorizedError } from '../../domain/errors/DomainError';

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
        if (error.response?.status === 401) {
          throw new UnauthorizedError('Unauthorized');
        }
        if (!error.response) {
          throw new NetworkError('Network error');
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

  async post<T>(url: string, data?: unknown, token?: string): Promise<Result<T, DomainError>> {
    try {
      const response: AxiosResponse<T> = await this.client.post(url, data, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return success(response.data);
    } catch (error) {
      return failure(this.handleError(error));
    }
  }

  async put<T>(url: string, data?: unknown, token?: string): Promise<Result<T, DomainError>> {
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
      if (error.response?.status === 401) {
        return new UnauthorizedError('Unauthorized');
      }
      if (error.response?.status === 404) {
        return new DomainError('Not found');
      }
      if (error.response?.status >= 500) {
        return new DomainError('Server error');
      }
      return new DomainError(error.message);
    }
    
    return new NetworkError('Unknown error');
  }
}
