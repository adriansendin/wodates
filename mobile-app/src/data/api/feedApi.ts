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
  isPotentialMatch?: boolean;
}

export interface PassResponse {
  action: string;
  result: unknown;
}

export interface AffinitySentencesResponse {
  sentences: string[];
}

export class FeedApi {
  constructor(private apiClient: ApiClient) {}

  async getFeed(
    limit: number = 10,
    offset: number = 0,
    token: string
  ): Promise<Result<FeedResponse, DomainError>> {
    const result = await this.apiClient.get<FeedResponse>(
      `/feed?limit=${limit}&offset=${offset}`,
      token
    );

    if (!result.success) {
      return result;
    }

    const parsed = parseFeedPayload(result.data);
    if (!parsed.success) {
      return failure(parsed.error);
    }

    return success(parsed.data);
  }

  async likeUser(
    targetUserId: string,
    token: string,
    signal?: AbortSignal
  ): Promise<Result<LikeResponse, DomainError>> {
    return this.apiClient.post('/likes', { targetUserId }, token, signal);
  }

  async passUser(
    targetUserId: string,
    token: string,
    signal?: AbortSignal
  ): Promise<Result<PassResponse, DomainError>> {
    return this.apiClient.post('/passes', { targetUserId }, token, signal);
  }

  async getAffinitySentences(
    candidateId: string,
    token: string
  ): Promise<Result<AffinitySentencesResponse, DomainError>> {
    return this.apiClient.get<AffinitySentencesResponse>(
      `/feed/affinity-sentences/${candidateId}`,
      token,
      60000 // 60 seconds timeout (matches backend and ai-service)
    );
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

/** Parse envelope + pagination; validate each candidate so one bad row does not empty the whole feed. */
function parseFeedPayload(
  data: unknown
): Result<FeedResponse, ValidationError> {
  const envelope = z
    .object({
      users: z.array(z.unknown()),
      pagination: FeedResponseSchema.shape.pagination,
    })
    .safeParse(data);

  if (!envelope.success) {
    return failure(new ValidationError('Invalid feed payload', envelope.error));
  }

  const validUsers: FeedCandidate[] = [];
  for (const raw of envelope.data.users) {
    const one = FeedCandidateSchema.safeParse(raw);
    if (one.success) {
      validUsers.push(one.data);
    } else if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[FeedApi] Skipping invalid feed candidate', one.error.format());
    }
  }

  return success({
    users: validUsers,
    pagination: envelope.data.pagination,
  });
}
