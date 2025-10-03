import { Pass, CreatePass } from '../entities/Pass';
import { Result } from '../Result';
import { DomainError } from '../errors/DomainError';

export interface PassRepository {
  create(pass: CreatePass): Promise<Result<Pass, DomainError>>;
  findByUserId(userId: string): Promise<Result<Pass[], DomainError>>;
  hasPassed(userId: string, targetUserId: string): Promise<Result<boolean, DomainError>>;
}
