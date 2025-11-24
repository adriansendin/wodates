import { ApiClient } from './apiClient';
import { Result } from '../../domain/Result';
import { DomainError } from '../../domain/errors/DomainError';

export interface BlockUserRequest {
  blockedUserId: string;
}

export interface BlockUserResponse {
  blocked: boolean;
  blockedUser: {
    blockerId: string;
    blockedId: string;
    createdAt: string;
  };
}

export class BlockApi {
  constructor(private apiClient: ApiClient) {}

  async blockUser(
    matchId: string,
    request: BlockUserRequest,
    token: string
  ): Promise<Result<BlockUserResponse, DomainError>> {
    return this.apiClient.post<BlockUserResponse>(
      `/chats/${matchId}/block`,
      request,
      token
    );
  }
}
