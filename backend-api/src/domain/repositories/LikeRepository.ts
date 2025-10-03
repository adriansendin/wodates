import { Like, CreateLike } from '../entities/Like';
import { Result } from '../Result';
import { DomainError } from '../errors/DomainError';

export interface LikeRepository {
  create(like: CreateLike): Promise<Result<Like, DomainError>>;
  findByUserId(userId: string): Promise<Result<Like[], DomainError>>;
  findByUserAndTarget(userId: string, targetUserId: string): Promise<Result<Like, DomainError>>;
  hasLiked(userId: string, targetUserId: string): Promise<Result<boolean, DomainError>>;
}
