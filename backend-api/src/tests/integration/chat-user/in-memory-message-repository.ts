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

  async findUnprocessedByMatchId(
    matchId: string
  ): Promise<Result<Message[], DomainError>> {
    const unprocessed = this.messages
      .filter(
        (msg) =>
          msg.matchId === matchId &&
          (msg.profileProcessedAt === null ||
            msg.profileProcessedAt === undefined)
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return success(unprocessed);
  }

  async findChatFromFirstUnprocessedMessage(
    matchId: string,
    userId: string
  ): Promise<Result<Message[], DomainError>> {
    // Step 0: FIRST check if this user has ANY unprocessed messages written by them
    // If the user hasn't written any new messages, we shouldn't process anything
    const hasUnprocessed = this.messages.some(
      (msg) =>
        msg.matchId === matchId &&
        msg.senderId === userId &&
        (msg.profileProcessedAt === null ||
          msg.profileProcessedAt === undefined)
    );

    // If the user has no unprocessed messages written by them, return empty array
    if (!hasUnprocessed) {
      return success([]);
    }

    // Find the LAST processed message for this user in this match
    // This gives us the cutoff point: we need ALL messages AFTER this point
    const lastProcessed = this.messages
      .filter(
        (msg) =>
          msg.matchId === matchId &&
          msg.senderId === userId &&
          msg.profileProcessedAt !== null &&
          msg.profileProcessedAt !== undefined
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

    let cutoffDate: string | null = null;

    if (lastProcessed) {
      cutoffDate = lastProcessed.createdAt;
    } else {
      // No processed messages found - get the first unprocessed message timestamp
      const firstUnprocessed = this.messages
        .filter(
          (msg) =>
            msg.matchId === matchId &&
            msg.senderId === userId &&
            (msg.profileProcessedAt === null ||
              msg.profileProcessedAt === undefined)
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

      // This should not happen since we already checked above, but handle it anyway
      if (!firstUnprocessed) {
        return success([]);
      }

      cutoffDate = firstUnprocessed.createdAt;
    }

    // Get all messages from the cutoff date onwards (from both users)
    const allMessages = this.messages
      .filter((msg) => msg.matchId === matchId && msg.createdAt >= cutoffDate!)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    // Filter out messages from this user that have already been processed
    // But keep messages from other users even if they have the same timestamp
    const filteredMessages = allMessages.filter((msg) => {
      // If it's a message from this user and it's already processed, exclude it
      if (
        msg.senderId === userId &&
        msg.profileProcessedAt !== null &&
        msg.profileProcessedAt !== undefined
      ) {
        return false;
      }
      // Otherwise, include it (messages from other users or unprocessed messages from this user)
      return true;
    });

    return success(filteredMessages);
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
