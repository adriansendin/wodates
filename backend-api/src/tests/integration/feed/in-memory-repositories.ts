import { randomUUID } from 'crypto';
import {
  success,
  failure,
  Result,
} from '../../../domain/Result';
import {
  DomainError,
  InternalError,
  NotFoundError,
} from '../../../domain/errors/DomainError';
import {
  UserRepository,
} from '../../../domain/repositories/UserRepository';
import {
  PreferencesRepository,
} from '../../../domain/repositories/PreferencesRepository';
import {
  User,
  CreateUser,
  UpdateUser,
} from '../../../domain/entities/User';
import {
  Preferences,
  CreatePreferences,
  UpdatePreferences,
} from '../../../domain/entities/Preferences';

export class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, User>();
  private emailIndex = new Map<string, string>();

  seed(user: User): void {
    this.users.set(user.id, user);
    this.emailIndex.set(user.email.toLowerCase(), user.id);
  }

  reset(): void {
    this.users.clear();
    this.emailIndex.clear();
  }

  async findById(id: string): Promise<Result<User, DomainError>> {
    const user = this.users.get(id);

    if (!user) {
      return failure(new NotFoundError('User not found'));
    }

    return success(user);
  }

  async findByEmail(email: string): Promise<Result<User, DomainError>> {
    const id = this.emailIndex.get(email.toLowerCase());
    if (!id) {
      return failure(new NotFoundError('User not found'));
    }

    const user = this.users.get(id);
    if (!user) {
      return failure(new NotFoundError('User not found'));
    }

    return success(user);
  }

  async create(data: CreateUser): Promise<Result<User, DomainError>> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const user: User = {
      id,
      email: `user.${id}@example.test`,
      name: `Generated User ${this.users.size + 1}`,
      birthDate: data.birthDate,
      gender: data.gender,
      bio: data.bio,
      photoUrl: data.photoUrl,
      location: data.location,
      createdAt: now,
      updatedAt: now,
    };

    this.seed(user);
    return success(user);
  }

  async update(id: string, data: UpdateUser): Promise<Result<User, DomainError>> {
    const existing = this.users.get(id);

    if (!existing) {
      return failure(new NotFoundError('User not found'));
    }

    const updated: User = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    this.seed(updated);
    return success(updated);
  }

  async delete(id: string): Promise<Result<void, DomainError>> {
    const existing = this.users.get(id);

    if (!existing) {
      return failure(new NotFoundError('User not found'));
    }

    this.users.delete(id);
    this.emailIndex.delete(existing.email.toLowerCase());
    return success(undefined);
  }

  async findFeedUsers(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<Result<User[], DomainError>> {
    const candidates = Array.from(this.users.values())
      .filter((user) => user.id !== userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const slice = candidates.slice(offset, offset + limit);
    return success(slice);
  }
}

export class InMemoryPreferencesRepository implements PreferencesRepository {
  private preferences = new Map<string, Preferences>();

  seed(preference: Preferences): void {
    this.preferences.set(preference.userId, preference);
  }

  reset(): void {
    this.preferences.clear();
  }

  async findByUserId(userId: string): Promise<Result<Preferences, DomainError>> {
    const preference = this.preferences.get(userId);

    if (!preference) {
      return failure(new NotFoundError('Preferences not found'));
    }

    return success(preference);
  }

  async create(
    data: CreatePreferences & { userId: string },
  ): Promise<Result<Preferences, DomainError>> {
    const now = new Date().toISOString();
    const preference: Preferences = {
      id: randomUUID(),
      userId: data.userId,
      ageMin: data.ageMin,
      ageMax: data.ageMax,
      genderFilter: data.genderFilter,
      maxDistance: data.maxDistance,
      createdAt: now,
      updatedAt: now,
    };

    this.preferences.set(preference.userId, preference);
    return success(preference);
  }

  async update(
    userId: string,
    data: UpdatePreferences,
  ): Promise<Result<Preferences, DomainError>> {
    const existing = this.preferences.get(userId);

    if (!existing) {
      return failure(new NotFoundError('Preferences not found'));
    }

    const updated: Preferences = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    this.preferences.set(userId, updated);
    return success(updated);
  }
}
