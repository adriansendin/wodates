import { ApiClient } from './apiClient';
import { Message } from '../../domain/entities/Message';
import { Result } from '../../domain/Result';
import { DomainError } from '../../domain/errors/DomainError';

export interface MessagesResponse {
  messages: Message[];
  pagination: {
    limit: number;
    before?: string;
    hasMore: boolean;
  };
}

export interface SendMessageRequest {
  content: string;
}

export class ChatApi {
  constructor(private apiClient: ApiClient) {}

  async getMessages(
    matchId: string,
    limit: number = 50,
    before?: string,
    token?: string
  ): Promise<Result<MessagesResponse, DomainError>> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(before && { before }),
    });

    return this.apiClient.get(`/chats/${matchId}/messages?${params}`, token);
  }

  async sendMessage(
    matchId: string,
    message: SendMessageRequest,
    token: string
  ): Promise<Result<{ message: Message }, DomainError>> {
    return this.apiClient.post(`/chats/${matchId}/messages`, message, token);
  }
}
