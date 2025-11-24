import { randomUUID } from 'crypto';
import { success, failure, type Result } from '../../../domain/Result';
import type { MessageRepository } from '../../../domain/repositories/MessageRepository';
import type { CreateMessage, Message } from '../../../domain/entities/Message';
import type { DomainError } from '../../../domain/errors/DomainError';
import { NotFoundError } from '../../../domain/errors/DomainError';

export class InMemoryMessageRepository implements MessageRepository {
  private messages: Message[] = [];

  reset(): void {
    this.messages = [];
  }

  async create(data: CreateMessage): Promise<Result<Message, DomainError>> {
    const message: Message = {
      id: randomUUID(),
      matchId: data.matchId,
      senderId: data.senderId,
      content: data.content,
      createdAt: new Date().toISOString(),
      profileProcessedAt: null,
    };

    this.messages.push(message);
    this.messages.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return success(message);
  }

  async findByMatchId(
    matchId: string,
    limit: number,
    before?: string
  ): Promise<Result<Message[], DomainError>> {
    let beforeTimestamp: string | undefined;

    if (before) {
      const beforeResult = await this.findById(before);
      if (beforeResult.success) {
        beforeTimestamp = beforeResult.data.createdAt;
      }
    }

    const filtered = this.messages
      .filter((message) => message.matchId === matchId)
      .filter((message) =>
        beforeTimestamp ? message.createdAt < beforeTimestamp : true
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);

    return success(filtered);
  }

  async findById(id: string): Promise<Result<Message, DomainError>> {
    const message = this.messages.find((item) => item.id === id);
    if (!message) {
      return failure(new NotFoundError('Message not found'));
    }

    return success(message);
  }

  async findUnprocessedBySenderId(
    senderId: string,
    limit: number = 100
  ): Promise<Result<Message[], DomainError>> {
    const unprocessed = this.messages
      .filter(
        (msg) =>
          msg.senderId === senderId &&
          (msg.profileProcessedAt === null ||
            msg.profileProcessedAt === undefined)
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit);

    return success(unprocessed);
  }

  async markAsProcessed(messageId: string): Promise<Result<void, DomainError>> {
    const message = this.messages.find((msg) => msg.id === messageId);
    if (!message) {
      return failure(new NotFoundError('Message not found'));
    }

    message.profileProcessedAt = new Date().toISOString();
    return success(undefined);
  }

  async markManyAsProcessed(
    messageIds: string[]
  ): Promise<Result<void, DomainError>> {
    if (messageIds.length === 0) {
      return success(undefined);
    }

    const now = new Date().toISOString();

    for (const messageId of messageIds) {
      const message = this.messages.find((msg) => msg.id === messageId);
      if (message) {
        message.profileProcessedAt = now;
      }
    }

    // Note: We don't fail if some messages aren't found, we just process the ones that exist
    return success(undefined);
  }
}
