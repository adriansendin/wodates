import { Preferences, CreatePreferences, UpdatePreferences } from '../../domain/entities/Preferences';
import { Result, success, failure } from '../../domain/Result';
import { DomainError, NotFoundError } from '../../domain/errors/DomainError';
import { PreferencesRepository } from '../../domain/repositories/PreferencesRepository';

export class InMemoryPreferencesRepository implements PreferencesRepository {
  private preferences: Map<string, Preferences> = new Map();
  private userPreferences: Map<string, string> = new Map(); // userId -> preferencesId

  async findByUserId(userId: string): Promise<Result<Preferences, DomainError>> {
    const preferencesId = this.userPreferences.get(userId);
    if (!preferencesId) {
      return failure(new NotFoundError('Preferences not found'));
    }

    const preferences = this.preferences.get(preferencesId);
    if (!preferences) {
      return failure(new NotFoundError('Preferences not found'));
    }

    return success(preferences);
  }

  async create(preferencesData: CreatePreferences & { userId: string }): Promise<Result<Preferences, DomainError>> {
    const id = this.generateId();
    const now = new Date().toISOString();
    
    const preferences: Preferences = {
      id,
      userId: preferencesData.userId,
      ageMin: preferencesData.ageMin ?? 18,
      ageMax: preferencesData.ageMax ?? 35,
      genderFilter:
        preferencesData.genderFilter ?? [
          'male',
          'female',
          'non_binary',
          'other',
          'prefer_not_to_say',
        ],
      maxDistance: preferencesData.maxDistance ?? 50,
      createdAt: now,
      updatedAt: now,
    };

    this.preferences.set(id, preferences);
    this.userPreferences.set(preferencesData.userId, id);
    
    return success(preferences);
  }

  async update(userId: string, preferencesData: UpdatePreferences): Promise<Result<Preferences, DomainError>> {
    const preferencesId = this.userPreferences.get(userId);
    if (!preferencesId) {
      return failure(new NotFoundError('Preferences not found'));
    }

    const existingPreferences = this.preferences.get(preferencesId);
    if (!existingPreferences) {
      return failure(new NotFoundError('Preferences not found'));
    }

    const updatedPreferences: Preferences = {
      ...existingPreferences,
      ...preferencesData,
      updatedAt: new Date().toISOString(),
    } as Preferences;

    this.preferences.set(preferencesId, updatedPreferences);
    return success(updatedPreferences);
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
