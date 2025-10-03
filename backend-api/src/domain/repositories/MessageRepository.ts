import { Message, CreateMessage } from '../entities/Message';
import { Result } from '../Result';
import { DomainError } from '../errors/DomainError';

export interface MessageRepository {
  create(message: CreateMessage): Promise<Result<Message, DomainError>>;
  findByMatchId(matchId: string, limit: number, before?: string): Promise<Result<Message[], DomainError>>;
  findById(id: string): Promise<Result<Message, DomainError>>;
}
