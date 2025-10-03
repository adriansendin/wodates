import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../../domain/entities/User';
import { Result, success, failure } from '../../domain/Result';
import { DomainError } from '../../domain/errors/DomainError';

const FEED_USERS_KEY = '@wodates_feed_users';
const LIKED_USERS_KEY = '@wodates_liked_users';
const PASSED_USERS_KEY = '@wodates_passed_users';

export class AsyncStorageFeedRepository {
  async saveFeedUsers(users: User[]): Promise<Result<void, DomainError>> {
    try {
      await AsyncStorage.setItem(FEED_USERS_KEY, JSON.stringify(users));
      return success(undefined);
    } catch (error) {
      return failure(new DomainError('Failed to save feed users', error));
    }
  }

  async getFeedUsers(): Promise<Result<User[], DomainError>> {
    try {
      const usersJson = await AsyncStorage.getItem(FEED_USERS_KEY);
      if (!usersJson) {
        return success([]);
      }
      
      const users = JSON.parse(usersJson) as User[];
      return success(users);
    } catch (error) {
      return failure(new DomainError('Failed to get feed users', error));
    }
  }

  async addLikedUser(userId: string): Promise<Result<void, DomainError>> {
    try {
      const likedUsers = await this.getLikedUsers();
      if (likedUsers.success) {
        const updated = [...likedUsers.data, userId];
        await AsyncStorage.setItem(LIKED_USERS_KEY, JSON.stringify(updated));
      } else {
        await AsyncStorage.setItem(LIKED_USERS_KEY, JSON.stringify([userId]));
      }
      return success(undefined);
    } catch (error) {
      return failure(new DomainError('Failed to add liked user', error));
    }
  }

  async getLikedUsers(): Promise<Result<string[], DomainError>> {
    try {
      const likedJson = await AsyncStorage.getItem(LIKED_USERS_KEY);
      if (!likedJson) {
        return success([]);
      }
      
      const likedUsers = JSON.parse(likedJson) as string[];
      return success(likedUsers);
    } catch (error) {
      return failure(new DomainError('Failed to get liked users', error));
    }
  }

  async addPassedUser(userId: string): Promise<Result<void, DomainError>> {
    try {
      const passedUsers = await this.getPassedUsers();
      if (passedUsers.success) {
        const updated = [...passedUsers.data, userId];
        await AsyncStorage.setItem(PASSED_USERS_KEY, JSON.stringify(updated));
      } else {
        await AsyncStorage.setItem(PASSED_USERS_KEY, JSON.stringify([userId]));
      }
      return success(undefined);
    } catch (error) {
      return failure(new DomainError('Failed to add passed user', error));
    }
  }

  async getPassedUsers(): Promise<Result<string[], DomainError>> {
    try {
      const passedJson = await AsyncStorage.getItem(PASSED_USERS_KEY);
      if (!passedJson) {
        return success([]);
      }
      
      const passedUsers = JSON.parse(passedJson) as string[];
      return success(passedUsers);
    } catch (error) {
      return failure(new DomainError('Failed to get passed users', error));
    }
  }

  async clearFeed(): Promise<Result<void, DomainError>> {
    try {
      await AsyncStorage.multiRemove([FEED_USERS_KEY, LIKED_USERS_KEY, PASSED_USERS_KEY]);
      return success(undefined);
    } catch (error) {
      return failure(new DomainError('Failed to clear feed', error));
    }
  }
}
