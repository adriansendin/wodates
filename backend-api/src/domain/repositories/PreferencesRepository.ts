import {
  Preferences,
  CreatePreferences,
  UpdatePreferences,
} from '../entities/Preferences';
import { Result } from '../Result';
import { DomainError } from '../errors/DomainError';

export interface PreferencesRepository {
  findByUserId(userId: string): Promise<Result<Preferences, DomainError>>;
  create(
    preferences: CreatePreferences & { userId: string }
  ): Promise<Result<Preferences, DomainError>>;
  update(
    userId: string,
    preferences: UpdatePreferences
  ): Promise<Result<Preferences, DomainError>>;
}
