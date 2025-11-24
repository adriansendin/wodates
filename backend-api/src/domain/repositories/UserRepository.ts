import { User, CreateUser, UpdateUser } from '../entities/User';
import { Result } from '../Result';
import { DomainError } from '../errors/DomainError';

export interface UserRepository {
  findById(id: string): Promise<Result<User, DomainError>>;
  findByEmail(email: string): Promise<Result<User, DomainError>>;
  create(user: CreateUser): Promise<Result<User, DomainError>>;
  update(id: string, user: UpdateUser): Promise<Result<User, DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;
  findFeedUsers(
    userId: string,
    limit: number,
    offset: number
  ): Promise<Result<User[], DomainError>>;
}
