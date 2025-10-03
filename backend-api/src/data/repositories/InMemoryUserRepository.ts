import { User, CreateUser, UpdateUser } from '../../domain/entities/User';
import { Result, success, failure } from '../../domain/Result';
import { DomainError, NotFoundError, ConflictError } from '../../domain/errors/DomainError';
import { UserRepository } from '../../domain/repositories/UserRepository';

export class InMemoryUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();
  private emailIndex: Map<string, string> = new Map();

  async findById(id: string): Promise<Result<User, DomainError>> {
    const user = this.users.get(id);
    if (!user) {
      return failure(new NotFoundError('User not found'));
    }
    return success(user);
  }

  async findByEmail(email: string): Promise<Result<User, DomainError>> {
    const userId = this.emailIndex.get(email);
    if (!userId) {
      return failure(new NotFoundError('User not found'));
    }
    return this.findById(userId);
  }

  async create(userData: CreateUser): Promise<Result<User, DomainError>> {
    const id = this.generateId();
    const now = new Date().toISOString();
    
    const user: User = {
      id,
      ...userData,
      createdAt: now,
      updatedAt: now,
    };

    // Check for email conflict
    if (this.emailIndex.has(user.email)) {
      return failure(new ConflictError('Email already exists'));
    }

    this.users.set(id, user);
    this.emailIndex.set(user.email, id);
    
    return success(user);
  }

  async update(id: string, userData: UpdateUser): Promise<Result<User, DomainError>> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      return failure(new NotFoundError('User not found'));
    }

    // Handle email change
    if (userData.email && userData.email !== existingUser.email) {
      if (this.emailIndex.has(userData.email)) {
        return failure(new ConflictError('Email already exists'));
      }
      this.emailIndex.delete(existingUser.email);
      this.emailIndex.set(userData.email, id);
    }

    const updatedUser: User = {
      ...existingUser,
      ...userData,
      updatedAt: new Date().toISOString(),
    } as User;

    this.users.set(id, updatedUser);
    return success(updatedUser);
  }

  async delete(id: string): Promise<Result<void, DomainError>> {
    const user = this.users.get(id);
    if (!user) {
      return failure(new NotFoundError('User not found'));
    }

    this.users.delete(id);
    this.emailIndex.delete(user.email);
    return success(undefined);
  }

  async findFeedUsers(userId: string, limit: number, offset: number): Promise<Result<User[], DomainError>> {
    const allUsers = Array.from(this.users.values())
      .filter(user => user.id !== userId)
      .slice(offset, offset + limit);
    
    return success(allUsers);
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
