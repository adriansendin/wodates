import { ApiClient } from './apiClient';
import { User } from '../../domain/entities/User';
import { Result } from '../../domain/Result';
import { DomainError } from '../../domain/errors/DomainError';

export interface FeedResponse {
  users: User[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface LikeResponse {
  action: string;
  result: unknown;
  isMatch: boolean;
}

export interface PassResponse {
  action: string;
  result: unknown;
}

export class FeedApi {
  constructor(private apiClient: ApiClient) {}

  async getFeed(limit: number = 10, offset: number = 0, token: string): Promise<Result<FeedResponse, DomainError>> {
    return this.apiClient.get(`/feed?limit=${limit}&offset=${offset}`, token);
  }

  async likeUser(targetUserId: string, token: string): Promise<Result<LikeResponse, DomainError>> {
    return this.apiClient.post('/likes', { targetUserId }, token);
  }

  async passUser(targetUserId: string, token: string): Promise<Result<PassResponse, DomainError>> {
    return this.apiClient.post('/passes', { targetUserId }, token);
  }
}
