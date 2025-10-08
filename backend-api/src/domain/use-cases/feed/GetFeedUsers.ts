import { User } from '../../entities/User';
import { Result, success, failure } from '../../Result';
import { DomainError, NotFoundError } from '../../errors/DomainError';
import { UserRepository } from '../../repositories/UserRepository';
import { LikeRepository } from '../../repositories/LikeRepository';
import { PassRepository } from '../../repositories/PassRepository';
import { PreferencesRepository } from '../../repositories/PreferencesRepository';

export class GetFeedUsers {
  constructor(
    private userRepository: UserRepository,
    private likeRepository: LikeRepository,
    private passRepository: PassRepository,
    private preferencesRepository: PreferencesRepository
  ) {}

  async execute(
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<Result<User[], DomainError>> {
    // Get user preferences
    const preferencesResult = await this.preferencesRepository.findByUserId(userId);
    if (isFailure(preferencesResult)) {
      return failure(new NotFoundError('User preferences not found'));
    }

    const preferences = preferencesResult.data;

    // Get users that match preferences
    const feedUsersResult = await this.userRepository.findFeedUsers(userId, limit, offset);
    if (isFailure(feedUsersResult)) {
      return feedUsersResult;
    }

    let feedUsers = feedUsersResult.data;

    // Filter out users already liked or passed
    const filteredUsers: User[] = [];
    
    for (const user of feedUsers) {
      if (user.id === userId) {
        continue;
      }
      const hasLikedResult = await this.likeRepository.hasLiked(userId, user.id);
      const hasPassedResult = await this.passRepository.hasPassed(userId, user.id);
      
      if (isSuccess(hasLikedResult) && hasLikedResult.data) continue;
      if (isSuccess(hasPassedResult) && hasPassedResult.data) continue;
      
      // Apply age filter
      const userAge = this.calculateAge(user.birthDate);
      if (userAge < preferences.ageMin || userAge > preferences.ageMax) continue;
      
      // Apply gender filter
      if (!preferences.genderFilter.includes(user.gender)) continue;
      
      filteredUsers.push(user);
    }

    return success(filteredUsers);
  }

  private calculateAge(birthDate: string): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }
}

function isFailure<T, E>(result: Result<T, E>): result is import('../../Result').Failure<E> {
  return !result.success;
}

function isSuccess<T, E>(result: Result<T, E>): result is import('../../Result').Success<T> {
  return result.success;
}
