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
    token: string,
  ): Promise<Result<UserProfile, DomainError>> {
    return this.apiClient.put<UserProfile>('/users/me', input, token);
  }
}
