import { ApiClient } from './apiClient';
import { User } from '../../domain/entities/User';
import { LoginRequest, RegisterRequest } from '../../domain/entities/Auth';
import { Result } from '../../domain/Result';
import { DomainError } from '../../domain/errors/DomainError';

export class AuthApi {
  constructor(private apiClient: ApiClient) {}

  async login(
    credentials: LoginRequest
  ): Promise<Result<{ user: User; token: string }, DomainError>> {
    return this.apiClient.post('/auth/login', credentials);
  }

  async register(
    userData: RegisterRequest
  ): Promise<Result<{ user: User; token: string }, DomainError>> {
    return this.apiClient.post('/auth/register', userData);
  }

  async refresh(
    token: string
  ): Promise<Result<{ token: string }, DomainError>> {
    return this.apiClient.post('/auth/refresh', {}, token);
  }

  async logout(
    token: string
  ): Promise<Result<{ message: string }, DomainError>> {
    return this.apiClient.post('/auth/logout', {}, token);
  }

  async checkEmail(
    email: string
  ): Promise<Result<{ exists: boolean; email: string }, DomainError>> {
    return this.apiClient.post('/auth/check-email', { email });
  }
}
