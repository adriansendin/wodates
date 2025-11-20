import { Result, success, failure } from '../../../domain/Result';
import { DomainError, InternalError } from '../../../domain/errors/DomainError';
import { UserProfileSummaryRepository } from '../../../domain/repositories/UserProfileSummaryRepository';
import { MessageRepository } from '../../../domain/repositories/MessageRepository';
import { MatchRepository } from '../../../domain/repositories/MatchRepository';
import { UserRepository } from '../../../domain/repositories/UserRepository';
import { SummarizerModel } from '../core/SummarizerModel';
import { EmbeddingModel } from '../core/EmbeddingModel';
import { DocLoveHelper } from '../../services/doc-love-helper';

/**
 * UserProfileAIService - Builds and maintains user personality summaries
 * 
 * This service is part of the ai/profile layer, focused on long-term memory.
 * It should be called asynchronously (via jobs/cron) to build/update summaries.
 */
export class UserProfileAIService {
  constructor(
    private summarizerModel: SummarizerModel,
    private embeddingModel: EmbeddingModel,
    private summaryRepository: UserProfileSummaryRepository,
    private messageRepository: MessageRepository,
    private matchRepository: MatchRepository,
    private userRepository: UserRepository,
    private docLoveHelper: DocLoveHelper,
    private logger?: any,
  ) {}

  /**
   * Builds or updates a user's personality summary
   * 
   * This method should be called asynchronously (not in request/response path).
   * 
   * @param userId - The user ID to build summary for
   * @param options - Options for what content to include
   */
  async buildOrUpdateSummary(
    userId: string,
    options?: {
      includeDocLoveChats?: boolean;
      includeUserChats?: boolean;
      includeImportedConversations?: boolean;
    },
  ): Promise<Result<void, DomainError>> {
    try {
      if (this.logger) {
        this.logger.info({ userId }, 'Building/updating user profile summary');
      }

      // Get existing summary if any
      const existingSummaryResult = await this.summaryRepository.findByUserId(userId);
      const previousSummary = existingSummaryResult.success && existingSummaryResult.data
        ? existingSummaryResult.data.summary
        : undefined;

      // Get user profile
      const userResult = await this.userRepository.findById(userId);
      if (!userResult.success) {
        return failure(userResult.error);
      }
      const user = userResult.data;

      // Collect content to summarize
      const newContent = {
        docLoveChats: options?.includeDocLoveChats !== false
          ? await this.getDocLoveChats(userId)
          : [],
        userChats: options?.includeUserChats !== false
          ? await this.getUserChats(userId)
          : [],
        importedConversations: options?.includeImportedConversations !== false
          ? await this.getImportedConversations(userId)
          : [],
      };

      // Generate summary using SummarizerModel
      const userProfile: {
        name?: string;
        bio?: string;
        age?: number;
        gender?: string;
      } = {};
      if (user.name) userProfile.name = user.name;
      if (user.bio) userProfile.bio = user.bio;
      if (user.birthDate) userProfile.age = this.calculateAge(user.birthDate);
      if (user.gender) userProfile.gender = user.gender;

      const summaryRequest: {
        previousSummary?: string;
        newContent: {
          docLoveChats: Array<{
            messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>;
          }>;
          userChats: Array<{
            otherUserId: string;
            messages: Array<{ role: 'user'; content: string; timestamp: Date }>;
          }>;
          importedConversations: Array<{
            source: string;
            messages: Array<{ role: 'user'; content: string; timestamp: Date }>;
          }>;
        };
        userProfile?: {
          name?: string;
          bio?: string;
          age?: number;
          gender?: string;
        };
      } = {
        newContent,
      };
      if (previousSummary) {
        summaryRequest.previousSummary = previousSummary;
      }
      if (Object.keys(userProfile).length > 0) {
        summaryRequest.userProfile = userProfile;
      }

      const summaryResponse = await this.summarizerModel.generateSummary(summaryRequest);

      if (this.logger) {
        this.logger.info(
          {
            userId,
            summaryLength: summaryResponse.summary.length,
            provider: summaryResponse.provider,
          },
          'Summary generated successfully',
        );
      }

      // Generate embedding from summary
      const embeddingResponse = await this.embeddingModel.generateEmbedding({
        text: summaryResponse.summary,
      });

      if (this.logger) {
        this.logger.info(
          {
            userId,
            embeddingDimension: embeddingResponse.dimension,
          },
          'Embedding generated successfully',
        );
      }

      // Save summary and embedding
      const upsertResult = await this.summaryRepository.upsert({
        userId,
        summary: summaryResponse.summary,
        embedding: embeddingResponse.embedding,
        provider: summaryResponse.provider,
        ...(summaryResponse.model && { model: summaryResponse.model }),
        dimension: embeddingResponse.dimension,
      });

      if (!upsertResult.success) {
        return failure(upsertResult.error);
      }

      if (this.logger) {
        this.logger.info({ userId }, 'User profile summary saved successfully');
      }

      return success(undefined);
    } catch (error) {
      if (this.logger) {
        this.logger.error({ userId, error }, 'Failed to build/update user profile summary');
      }
      return failure(
        new InternalError('Failed to build/update user profile summary', error),
      );
    }
  }

  /**
   * Gets a user's profile summary (if exists)
   */
  async getSummary(userId: string): Promise<Result<UserProfileSummary | null, DomainError>> {
    const result = await this.summaryRepository.findByUserId(userId);
    return result;
  }

  /**
   * Gets Doc Love chat conversations for a user
   */
  private async getDocLoveChats(userId: string): Promise<Array<{
    messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>;
  }>> {
    try {
      const docLoveId = await this.docLoveHelper.getDocLoveUserId();
      const matchesResult = await this.matchRepository.findByUserId(userId);

      if (!matchesResult.success) {
        return [];
      }

      const docLoveMatches = matchesResult.data.filter(
        (match) => match.userId1 === docLoveId || match.userId2 === docLoveId,
      );

      const chats = await Promise.all(
        docLoveMatches.map(async (match) => {
          const messagesResult = await this.messageRepository.findByMatchId(match.id, 100);
          if (!messagesResult.success) {
            return null;
          }

          return {
            messages: messagesResult.data.map((msg) => ({
              role: (msg.senderId === docLoveId ? 'assistant' : 'user') as 'user' | 'assistant',
              content: msg.content,
              timestamp: new Date(msg.createdAt),
            })),
          };
        }),
      );

      return chats.filter((chat): chat is NonNullable<typeof chat> => chat !== null);
    } catch (error) {
      if (this.logger) {
        this.logger.warn({ userId, error }, 'Failed to get Doc Love chats');
      }
      return [];
    }
  }

  /**
   * Gets user-to-user chat conversations
   */
  private async getUserChats(userId: string): Promise<Array<{
    otherUserId: string;
    messages: Array<{ role: 'user'; content: string; timestamp: Date }>;
  }>> {
    try {
      const docLoveId = await this.docLoveHelper.getDocLoveUserId();
      const matchesResult = await this.matchRepository.findByUserId(userId);

      if (!matchesResult.success) {
        return [];
      }

      const userMatches = matchesResult.data.filter(
        (match) => match.userId1 !== docLoveId && match.userId2 !== docLoveId,
      );

      const chats = await Promise.all(
        userMatches.map(async (match) => {
          const otherUserId = match.userId1 === userId ? match.userId2 : match.userId1;
          const messagesResult = await this.messageRepository.findByMatchId(match.id, 100);
          if (!messagesResult.success) {
            return null;
          }

          return {
            otherUserId,
            messages: messagesResult.data
              .filter((msg) => msg.senderId === userId) // Only user's messages
              .map((msg) => ({
                role: 'user' as const,
                content: msg.content,
                timestamp: new Date(msg.createdAt),
              })),
          };
        }),
      );

      return chats.filter((chat): chat is NonNullable<typeof chat> => chat !== null);
    } catch (error) {
      if (this.logger) {
        this.logger.warn({ userId, error }, 'Failed to get user chats');
      }
      return [];
    }
  }

  /**
   * Gets imported conversations (WhatsApp, etc.)
   * 
   * TODO: Implement when imported_conversations table is available
   */
  private async getImportedConversations(_userId: string): Promise<Array<{
    source: string;
    messages: Array<{ role: 'user'; content: string; timestamp: Date }>;
  }>> {
    // TODO: Query imported_conversations table
    // For now, return empty array
    return [];
  }

  /**
   * Calculates age from birth date
   */
  private calculateAge(birthDate: string): number {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }
}

// Import UserProfileSummary type
import { UserProfileSummary } from '../../../domain/entities/UserProfileSummary';

