import { User, CreateUser } from '../../entities/User';
import { Result, success, failure } from '../../Result';
import { DomainError, ConflictError } from '../../errors/DomainError';
import { UserRepository } from '../../repositories/UserRepository';
import { PreferencesRepository } from '../../repositories/PreferencesRepository';

export class RegisterUser {
  constructor(
    private userRepository: UserRepository,
    private preferencesRepository: PreferencesRepository
  ) {}

  async execute(userData: CreateUser, email: string): Promise<Result<User, DomainError>> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser.success) {
      return failure(new ConflictError('User with this email already exists'));
    }

    // Create user
    const userResult = await this.userRepository.create(userData);
    if (!userResult.success) {
      return userResult;
    }

    const user = userResult.data;

    // Create default preferences
    const preferencesResult = await this.preferencesRepository.create({
      userId: user.id,
      ageMin: 18,
      ageMax: 35,
      genderFilter: ['male', 'female', 'non_binary'],
      maxDistance: 50,
    });

    if (!preferencesResult.success) {
      // If preferences creation fails, we should rollback user creation
      // For now, we'll just log this as the user can update preferences later
      console.error('Failed to create default preferences for user:', user.id);
    }

    return success(user);
  }
}
