import { User, CreateUser, UpdateUser } from '../../domain/entities/User';
import { Result, success, failure } from '../../domain/Result';
import { DomainError, InternalError } from '../../domain/errors/DomainError';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { SupabaseUserService } from '../../app/services/supabase-user-service';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

/**
 * SupabaseUserRepository - Implements UserRepository using SupabaseUserService
 *
 * This is a thin adapter that wraps SupabaseUserService to match the UserRepository interface.
 */
export class SupabaseUserRepository implements UserRepository {
  private readonly userService: SupabaseUserService;

  constructor(config?: Partial<SupabaseConfig>) {
    this.userService = new SupabaseUserService(config);
  }

  async findById(id: string): Promise<Result<User, DomainError>> {
    try {
      const profile = await this.userService.getProfile(id);
      return success(this.mapProfileToUser(profile));
    } catch (error) {
      if (error instanceof DomainError) {
        return failure(error);
      }
      return failure(
        new InternalError('Unexpected error fetching user', error)
      );
    }
  }

  async findByEmail(_email: string): Promise<Result<User, DomainError>> {
    // SupabaseUserService doesn't have findByEmail, so we'll need to implement it
    // For now, return an error
    return failure(
      new InternalError(
        'findByEmail not yet implemented in SupabaseUserRepository'
      )
    );
  }

  async create(_user: CreateUser): Promise<Result<User, DomainError>> {
    // SupabaseUserService doesn't have create, so we'll need to implement it
    // For now, return an error
    return failure(
      new InternalError('create not yet implemented in SupabaseUserRepository')
    );
  }

  async update(
    id: string,
    user: UpdateUser
  ): Promise<Result<User, DomainError>> {
    try {
      const updateInput = this.mapUpdateUserToInput(user);
      const profile = await this.userService.updateProfile(id, updateInput);
      return success(this.mapProfileToUser(profile));
    } catch (error) {
      if (error instanceof DomainError) {
        return failure(error);
      }
      return failure(
        new InternalError('Unexpected error updating user', error)
      );
    }
  }

  async delete(_id: string): Promise<Result<void, DomainError>> {
    // SupabaseUserService doesn't have delete, so we'll need to implement it
    // For now, return an error
    return failure(
      new InternalError('delete not yet implemented in SupabaseUserRepository')
    );
  }

  async findFeedUsers(
    _userId: string,
    _limit: number,
    _offset: number
  ): Promise<Result<User[], DomainError>> {
    // SupabaseUserService doesn't have findFeedUsers, so we'll need to implement it
    // For now, return an error
    return failure(
      new InternalError(
        'findFeedUsers not yet implemented in SupabaseUserRepository'
      )
    );
  }

  private mapProfileToUser(profile: {
    id: string;
    name: string;
    email: string;
    birthDate: string | null;
    gender: string | null;
    looking_for: string | null;
    min_age: number | null;
    max_age: number | null;
    bio: string | null;
    city: string | null;
    show_bio_in_feed: boolean | null;
  }): User {
    // Map to User entity schema
    // User entity requires: id, email, name, birthDate (datetime string), gender, createdAt, updatedAt
    // Optional: bio, photoUrl, location
    const now = new Date().toISOString();

    // Validate gender is one of the allowed values
    const validGender =
      profile.gender &&
      ['male', 'female', 'non_binary'].includes(profile.gender)
        ? (profile.gender as 'male' | 'female' | 'non_binary')
        : 'non_binary'; // Default fallback

    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      birthDate: profile.birthDate || now, // Required field, use now as fallback
      gender: validGender, // Required field
      bio: profile.bio || undefined,
      photoUrl: undefined, // Photo URL now comes from user_photos, not profile
      location: profile.city
        ? {
            city: profile.city,
            country: '', // Not available in profile
            latitude: 0,
            longitude: 0,
          }
        : undefined,
      createdAt: now,
      updatedAt: now,
    };
  }

  private mapUpdateUserToInput(user: UpdateUser): {
    birthDate?: string | null;
    gender?: 'male' | 'female' | 'non_binary' | null;
    looking_for?: 'male' | 'female' | 'both' | null;
    min_age?: number | null;
    max_age?: number | null;
    bio?: string | null;
    city?: string | null;
    show_bio_in_feed?: boolean | null;
  } {
    return {
      birthDate: user.birthDate ?? null,
      gender: user.gender ?? null,
      looking_for: null, // Not in User entity, set to null instead of undefined
      min_age: null, // Not in User entity, set to null instead of undefined
      max_age: null, // Not in User entity, set to null instead of undefined
      bio: user.bio ?? null,
      city: user.location?.city ?? null,
      show_bio_in_feed: null, // Not in User entity, set to null instead of undefined
    };
  }
}
