import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message } from '../../domain/entities/Message';
import { Result, success, failure } from '../../domain/Result';
import { DomainError, ServerError } from '../../domain/errors/DomainError';

const MESSAGES_KEY = '@wodates_messages';

export class AsyncStorageChatRepository {
  async saveMessages(
    matchId: string,
    messages: Message[]
  ): Promise<Result<void, DomainError>> {
    try {
      const key = `${MESSAGES_KEY}_${matchId}`;
      await AsyncStorage.setItem(key, JSON.stringify(messages));
      return success(undefined);
    } catch (error) {
      return failure(new ServerError('Failed to save messages', error));
    }
  }

  async getMessages(matchId: string): Promise<Result<Message[], DomainError>> {
    try {
      const key = `${MESSAGES_KEY}_${matchId}`;
      const messagesJson = await AsyncStorage.getItem(key);
      if (!messagesJson) {
        return success([]);
      }

      const messages = JSON.parse(messagesJson) as Message[];
      return success(messages);
    } catch (error) {
      return failure(new ServerError('Failed to get messages', error));
    }
  }

  async addMessage(
    matchId: string,
    message: Message
  ): Promise<Result<void, DomainError>> {
    try {
      const existingMessages = await this.getMessages(matchId);
      if (existingMessages.success) {
        const updated = [...existingMessages.data, message];
        return this.saveMessages(matchId, updated);
      } else {
        return this.saveMessages(matchId, [message]);
      }
    } catch (error) {
      return failure(new ServerError('Failed to add message', error));
    }
  }

  async clearMessages(matchId: string): Promise<Result<void, DomainError>> {
    try {
      const key = `${MESSAGES_KEY}_${matchId}`;
      await AsyncStorage.removeItem(key);
      return success(undefined);
    } catch (error) {
      return failure(new ServerError('Failed to clear messages', error));
    }
  }
}
