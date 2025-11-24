import { Match, CreateMatch } from '../entities/Match';
import { Result } from '../Result';
import { DomainError } from '../errors/DomainError';

export interface MatchRepository {
  create(match: CreateMatch): Promise<Result<Match, DomainError>>;
  findByUserId(userId: string): Promise<Result<Match[], DomainError>>;
  findById(id: string): Promise<Result<Match, DomainError>>;
  existsBetweenUsers(
    userId1: string,
    userId2: string
  ): Promise<Result<boolean, DomainError>>;
  delete(matchId: string): Promise<Result<void, DomainError>>;
  updateActiveChatsCountForUsers(userIds: string[]): Promise<void>;
  getActiveChatsCount(userIds: string[]): Promise<Map<string, number>>;
}
