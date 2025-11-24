import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../../domain/entities/User';
import { AuthTokens } from '../../domain/entities/Auth';
import { Result, success, failure } from '../../domain/Result';
import {
  DomainError,
  NotFoundError,
  ServerError,
} from '../../domain/errors/DomainError';

const USER_KEY = '@wodates_user';
const TOKENS_KEY = '@wodates_tokens';

export class AsyncStorageAuthRepository {
  async saveUser(user: User): Promise<Result<void, DomainError>> {
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      return success(undefined);
    } catch (error) {
      return failure(new ServerError('Failed to save user', error));
    }
  }

  async getUser(): Promise<Result<User, DomainError>> {
    try {
      const userJson = await AsyncStorage.getItem(USER_KEY);
      if (!userJson) {
        return failure(new NotFoundError('User not found'));
      }

      const user = JSON.parse(userJson) as User;
      return success(user);
    } catch (error) {
      return failure(new ServerError('Failed to get user', error));
    }
  }

  async saveTokens(tokens: AuthTokens): Promise<Result<void, DomainError>> {
    try {
      await AsyncStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
      return success(undefined);
    } catch (error) {
      return failure(new ServerError('Failed to save tokens', error));
    }
  }

  async getTokens(): Promise<Result<AuthTokens, DomainError>> {
    try {
      const tokensJson = await AsyncStorage.getItem(TOKENS_KEY);
      if (!tokensJson) {
        return failure(new NotFoundError('Tokens not found'));
      }

      const tokens = JSON.parse(tokensJson) as AuthTokens;
      return success(tokens);
    } catch (error) {
      return failure(new ServerError('Failed to get tokens', error));
    }
  }

  async clearAuth(): Promise<Result<void, DomainError>> {
    try {
      await AsyncStorage.multiRemove([USER_KEY, TOKENS_KEY]);
      return success(undefined);
    } catch (error) {
      return failure(new ServerError('Failed to clear auth', error));
    }
  }
}
