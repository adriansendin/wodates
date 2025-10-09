import { z } from 'zod';
import { ApiClient } from './apiClient';
import { Result, success, failure } from '../../domain/Result';
import { DomainError, ValidationError } from '../../domain/errors/DomainError';
import {
  FeedCandidate,
  FeedCandidateSchema,
} from '../../domain/entities/FeedCandidate';

export interface FeedResponse {
  users: FeedCandidate[];
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

  async getFeed(
    limit: number = 10,
    offset: number = 0,
    token: string,
  ): Promise<Result<FeedResponse, DomainError>> {
    const result = await this.apiClient.get<FeedResponse>(
      `/feed?limit=${limit}&offset=${offset}`,
      token,
    );

    if (!result.success) {
      return result;
    }

    const validation = FeedResponseSchema.safeParse(result.data);
    if (!validation.success) {
      return failure(
        new ValidationError('Invalid feed payload', validation.error),
      );
    }

    return success(validation.data);
  }

  async likeUser(
    targetUserId: string,
    token: string,
  ): Promise<Result<LikeResponse, DomainError>> {
    return this.apiClient.post('/likes', { targetUserId }, token);
  }

  async passUser(
    targetUserId: string,
    token: string,
  ): Promise<Result<PassResponse, DomainError>> {
    return this.apiClient.post('/passes', { targetUserId }, token);
  }
}

const FeedResponseSchema = z.object({
  users: z.array(FeedCandidateSchema),
  pagination: z.object({
    limit: z.number().int().min(1),
    offset: z.number().int().min(0),
    hasMore: z.boolean(),
  }),
});
