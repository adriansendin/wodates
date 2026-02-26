import { ApiClient } from './apiClient';
import {
  UpdateUserProfile,
  UserProfile,
} from '../../domain/entities/UserProfile';
import { Result } from '../../domain/Result';
import { DomainError } from '../../domain/errors/DomainError';

export class ProfileApi {
  constructor(private readonly apiClient: ApiClient) {}

  getProfile(token: string): Promise<Result<UserProfile, DomainError>> {
    return this.apiClient.get<UserProfile>('/users/me', token);
  }

  updateProfile(
    input: UpdateUserProfile,
    token: string
  ): Promise<Result<UserProfile, DomainError>> {
    return this.apiClient.put<UserProfile>('/users/me', input, token);
  }

  deactivateAccount(
    token: string
  ): Promise<Result<{ message: string }, DomainError>> {
    return this.apiClient.post<{ message: string }>(
      '/users/me/deactivate',
      {},
      token
    );
  }

  /** Build AI profile from chat messages (summary, embedding, bio). */
  generateProfile(token: string): Promise<Result<{ summary: string; message: string }, DomainError>> {
    return this.apiClient.post<{ summary: string; message: string }>(
      '/users/me/generate-profile',
      {},
      token
    );
  }
}
