/**
 * Test helpers and mocks for Process 1 MAIN marking tests
 */

import { Result, success, failure } from '../../src/domain/Result';
import { DomainError, NotFoundError } from '../../src/domain/errors/DomainError';
import { MatchRepository } from '../../src/domain/repositories/MatchRepository';
import { UserRepository } from '../../src/domain/repositories/UserRepository';
import { MessageRepository } from '../../src/domain/repositories/MessageRepository';
import { UserAIProfileRepository } from '../../src/domain/repositories/UserAIProfileRepository';
import { DocLoveHelper } from '../../src/app/services/doc-love-helper';
import { Message } from '../../src/domain/entities/Message';
import { Match } from '../../src/domain/entities/Match';
import { User } from '../../src/domain/entities/User';
import {
  TEST_USER_ID,
  TEST_OTHER_USER_ID,
  TEST_DOC_LOVE_USER_ID,
  TEST_USERS,
  SAMPLE_MESSAGES,
  createTestMatch,
  createConversationMessages,
} from './test-process-1-data';

/**
 * Mock MatchRepository
 */
export class MockMatchRepository implements MatchRepository {
  private matches: Match[] = [];

  constructor() {
    // Initialize with default test matches
    this.matches = [
      {
        id: `match-${TEST_OTHER_USER_ID}`,
        userId1: TEST_USER_ID,
        userId2: TEST_OTHER_USER_ID,
        createdAt: new Date('2024-01-01T09:00:00Z').toISOString(),
      } as Match,
      {
        id: `match-${TEST_DOC_LOVE_USER_ID}`,
        userId1: TEST_USER_ID,
        userId2: TEST_DOC_LOVE_USER_ID,
        createdAt: new Date('2024-01-01T09:00:00Z').toISOString(),
      } as Match,
    ];
  }

  async findByUserId(userId: string): Promise<Result<Match[], DomainError>> {
    const userMatches = this.matches.filter(
      (m) => m.userId1 === userId || m.userId2 === userId
    );
    return success(userMatches);
  }

  async findById(id: string): Promise<Result<Match, DomainError>> {
    const match = this.matches.find((m) => m.id === id);
    if (!match) {
      return failure(new NotFoundError('Match not found'));
    }
    return success(match);
  }

  // Unused methods for this test
  async create(): Promise<Result<Match, DomainError>> {
    throw new Error('Not implemented');
  }
  async existsBetweenUsers(): Promise<Result<boolean, DomainError>> {
    throw new Error('Not implemented');
  }
  async delete(): Promise<Result<void, DomainError>> {
    throw new Error('Not implemented');
  }
  async updateActiveChatsCountForUsers(): Promise<void> {
    throw new Error('Not implemented');
  }
  async getActiveChatsCount(): Promise<Map<string, number>> {
    throw new Error('Not implemented');
  }
}

/**
 * Mock UserRepository
 */
export class MockUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();

  constructor() {
    // Initialize with test users
    Object.values(TEST_USERS).forEach((user) => {
      // Convert to User type with required fields
      const userEntity: User = {
        id: user.id,
        email: `${user.id}@test.com`,
        name: user.name,
        birthDate: user.birthDate ? new Date(user.birthDate).toISOString() : new Date().toISOString(),
        gender: 'male' as const,
        bio: user.bio,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.users.set(user.id, userEntity);
    });
  }

  async findById(userId: string): Promise<Result<User, DomainError>> {
    const user = this.users.get(userId);
    if (!user) {
      return failure(new NotFoundError(`User ${userId} not found`));
    }
    return success(user);
  }

  // Helper to set user name for testing name variations
  setUserName(userId: string, name: string): void {
    const user = this.users.get(userId);
    if (user) {
      user.name = name;
    }
  }

  // Unused methods for this test
  async findByEmail(): Promise<Result<User, DomainError>> {
    throw new Error('Not implemented');
  }
  async create(): Promise<Result<User, DomainError>> {
    throw new Error('Not implemented');
  }
  async update(): Promise<Result<User, DomainError>> {
    throw new Error('Not implemented');
  }
  async delete(): Promise<Result<void, DomainError>> {
    throw new Error('Not implemented');
  }
  async findFeedUsers(): Promise<Result<User[], DomainError>> {
    throw new Error('Not implemented');
  }
}

/**
 * Mock MessageRepository
 */
export class MockMessageRepository implements MessageRepository {
  private messages: Message[] = [];

  constructor() {
    // Initialize with sample messages
    const conversationMessages = createConversationMessages(
      SAMPLE_MESSAGES.mainUserMessages,
      SAMPLE_MESSAGES.otherUserMessages
    );
    this.messages = [
      ...conversationMessages.map((msg) => ({
        id: msg.id,
        matchId: `match-${TEST_OTHER_USER_ID}`,
        senderId: msg.senderId,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
        profileProcessedAt: msg.profileProcessedAt ? msg.profileProcessedAt.toISOString() : null,
      })),
      ...SAMPLE_MESSAGES.docLoveMessages.map((msg) => ({
        id: msg.id,
        matchId: `match-${TEST_DOC_LOVE_USER_ID}`,
        senderId: msg.senderId,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
        profileProcessedAt: msg.profileProcessedAt ? msg.profileProcessedAt.toISOString() : null,
      })),
    ] as Message[];
  }

  async findChatFromFirstUnprocessedMessage(
    matchId: string,
    userId: string
  ): Promise<Result<Message[], DomainError>> {
    // Find all messages for this match
    const matchMessages = this.messages.filter((msg) => msg.matchId === matchId);

    // Find first unprocessed message from the user
    const firstUnprocessedIndex = matchMessages.findIndex(
      (msg) => msg.senderId === userId && msg.profileProcessedAt === null
    );

    if (firstUnprocessedIndex === -1) {
      // No unprocessed messages from user, return empty array
      return success([]);
    }

    // Return all messages from first unprocessed message onwards
    const result = matchMessages.slice(firstUnprocessedIndex);
    return success(result);
  }

  async markManyAsProcessed(messageIds: string[]): Promise<Result<void, DomainError>> {
    this.messages.forEach((msg) => {
      if (messageIds.includes(msg.id)) {
        msg.profileProcessedAt = new Date().toISOString();
      }
    });
    return success(undefined);
  }

  // Helper to add custom messages for testing
  addMessages(messages: Message[]): void {
    this.messages.push(...messages);
  }

  // Helper to set custom messages (replaces all existing messages)
  setMessages(messages: Message[]): void {
    this.messages = messages;
  }

  // Helper to reset messages
  resetMessages(): void {
    this.messages = [];
  }

  // Unused methods for this test
  async create(): Promise<Result<Message, DomainError>> {
    throw new Error('Not implemented');
  }
  async findByMatchId(): Promise<Result<Message[], DomainError>> {
    throw new Error('Not implemented');
  }
  async findById(): Promise<Result<Message, DomainError>> {
    throw new Error('Not implemented');
  }
  async findUnprocessedBySenderId(): Promise<Result<Message[], DomainError>> {
    throw new Error('Not implemented');
  }
  async findUnprocessedByMatchId(): Promise<Result<Message[], DomainError>> {
    throw new Error('Not implemented');
  }
  async markAsProcessed(): Promise<Result<void, DomainError>> {
    throw new Error('Not implemented');
  }
}

/**
 * Mock UserAIProfileRepository
 */
export class MockUserAIProfileRepository implements UserAIProfileRepository {
  private profiles: Map<string, any> = new Map();

  async findByUserId(userId: string): Promise<Result<any, DomainError>> {
    const profile = this.profiles.get(userId) || {
      userId,
      summary: null,
      summaryIncremental: null,
      summaryEmbedding: null,
    };
    return success(profile);
  }

  async upsert(profile: any): Promise<Result<any, DomainError>> {
    this.profiles.set(profile.userId, {
      ...this.profiles.get(profile.userId),
      ...profile,
    });
    return success(this.profiles.get(profile.userId));
  }

  // Helper to get profile for verification
  getProfile(userId: string): any {
    return this.profiles.get(userId);
  }

  // Helper to reset profiles
  resetProfiles(): void {
    this.profiles.clear();
  }

  // Unused methods for this test
  async create(): Promise<Result<any, DomainError>> {
    throw new Error('Not implemented');
  }
  async update(): Promise<Result<any, DomainError>> {
    throw new Error('Not implemented');
  }
}

/**
 * Mock DocLoveHelper
 */
export class MockDocLoveHelper implements Partial<DocLoveHelper> {
  async getDocLoveUserId(): Promise<string> {
    return TEST_DOC_LOVE_USER_ID;
  }
}

/**
 * Mock SummarizerModel that captures the prompt for verification
 */
export class MockSummarizerModel {
  public lastPrompt: string | null = null;
  public lastRequest: any = null;
  public shouldFail: boolean = false;
  public mockSummary: string = 'Mock summary for testing';

  async generateSummary(request: any): Promise<any> {
    this.lastRequest = request;

    if (this.shouldFail) {
      throw new Error('Mock summarizer failed');
    }

    // Build prompt using the same logic as SummarizerModelOllama
    this.lastPrompt = this.buildPrompt(request);

    return {
      summary: this.mockSummary,
      provider: 'mock',
      model: 'mock-model',
    };
  }

  /**
   * Simplified version of SummarizerModelOllama.buildPrompt for testing
   * This mirrors the actual implementation to verify MAIN marking
   */
  private buildPrompt(request: any): string {
    let prompt = '';
    let newInfoSection = '';

    const currentUserName = request.userProfile?.name || 'Usuario';

    // Process userChats
    if (request.newContent?.userChats) {
      newInfoSection += '\nCONVERSACIONES:\n';
      for (const chat of request.newContent.userChats) {
        const otherUserName = chat.otherUserName || 'Otro usuario';
        newInfoSection += `\nConversación con ${otherUserName}:\n`;

        for (const msg of chat.messages) {
          let displayName: string;
          if (msg.senderName) {
            const normalizedSenderName = msg.senderName.trim().toLowerCase();
            const normalizedCurrentUserName = currentUserName.trim().toLowerCase();
            if (normalizedSenderName === normalizedCurrentUserName) {
              displayName = `${msg.senderName} (MAIN)`;
            } else {
              displayName = msg.senderName;
            }
          } else {
            displayName = 'Usuario';
          }
          newInfoSection += `${displayName}: ${msg.content}\n`;
        }
      }
    }

    // Process importedConversations
    if (request.newContent?.importedConversations) {
      newInfoSection += '\nCONVERSACIONES IMPORTADAS:\n';
      for (const conv of request.newContent.importedConversations) {
        newInfoSection += `\n${conv.source}:\n`;
        for (const msg of conv.messages) {
          let displayName: string;
          if (msg.senderName) {
            const normalizedSenderName = msg.senderName.trim().toLowerCase();
            const normalizedCurrentUserName = currentUserName.trim().toLowerCase();
            if (normalizedSenderName === normalizedCurrentUserName) {
              displayName = `${msg.senderName} (MAIN)`;
            } else {
              displayName = msg.senderName;
            }
          } else {
            displayName = 'Usuario';
          }
          newInfoSection += `${displayName}: ${msg.content}\n`;
        }
      }
    }

    prompt += `CONTENIDO A RESUMIR:\n${newInfoSection}`;
    return prompt;
  }

  // Helper to reset mock state
  reset(): void {
    this.lastPrompt = null;
    this.lastRequest = null;
    this.shouldFail = false;
    this.mockSummary = 'Mock summary for testing';
  }
}

