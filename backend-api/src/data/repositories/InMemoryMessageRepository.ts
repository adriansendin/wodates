import { Message, CreateMessage } from '../../domain/entities/Message';
import { Result, success, failure } from '../../domain/Result';
import { DomainError, NotFoundError } from '../../domain/errors/DomainError';
import { MessageRepository } from '../../domain/repositories/MessageRepository';

export class InMemoryMessageRepository implements MessageRepository {
  private messages: Map<string, Message> = new Map();
  private matchMessages: Map<string, string[]> = new Map(); // matchId -> Array of message IDs (ordered by creation)

  async create(messageData: CreateMessage): Promise<Result<Message, DomainError>> {
    const id = this.generateId();
    const now = new Date().toISOString();
    
    const message: Message = {
      id,
      ...messageData,
      createdAt: now,
    };

    this.messages.set(id, message);
    
    // Update match messages index
    if (!this.matchMessages.has(messageData.matchId)) {
      this.matchMessages.set(messageData.matchId, []);
    }
    this.matchMessages.get(messageData.matchId)!.push(id);
    
    return success(message);
  }

  async findByMatchId(matchId: string, limit: number, before?: string): Promise<Result<Message[], DomainError>> {
    const messageIds = this.matchMessages.get(matchId);
    if (!messageIds) {
      return success([]);
    }

    let messages = messageIds
      .map(id => this.messages.get(id))
      .filter((message): message is Message => message !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply 'before' filter if provided
    if (before) {
      const beforeIndex = messages.findIndex(msg => msg.id === before);
      if (beforeIndex !== -1) {
        messages = messages.slice(beforeIndex + 1);
      }
    }

    // Apply limit
    messages = messages.slice(0, limit);

    return success(messages);
  }

  async findById(id: string): Promise<Result<Message, DomainError>> {
    const message = this.messages.get(id);
    if (!message) {
      return failure(new NotFoundError('Message not found'));
    }

    return success(message);
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
