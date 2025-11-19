import { Result, success, failure } from '../../domain/Result';
import { DomainError, InternalError } from '../../domain/errors/DomainError';
import { Message } from '../../domain/entities/Message';
import { MessageRepository } from '../../domain/repositories/MessageRepository';
import { MatchRepository } from '../../domain/repositories/MatchRepository';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { DocLoveHelper } from './doc-love-helper';
import { AIService } from '../ai/AIService';
import {
  IAMessage,
  IAGenerateRequest,
} from '../ai/providers/IAProvider';
import { AIConfig } from '../ai/ai-settings';

/**
 * Service for handling Doc Love AI chatbot functionality
 * 
 * This service:
 * - Detects if a conversation is with Doc Love
 * - Retrieves conversation history
 * - Generates AI responses using AIService
 * - Saves AI responses as messages from Doc Love
 */
export class DocLoveService {
  constructor(
    private docLoveHelper: DocLoveHelper,
    private aiService: AIService,
    private messageRepository: MessageRepository,
    private matchRepository: MatchRepository,
    private userRepository?: UserRepository, // Optional for user context
    private logger?: any, // Optional: logger for debugging
  ) {}

  /**
   * Detects if a match/conversation is with Doc Love
   * 
   * @param matchId - The match ID to check
   * @returns Result indicating if this is a Doc Love conversation
   */
  async isDocLoveConversation(matchId: string): Promise<Result<boolean, DomainError>> {
    try {
      const matchResult = await this.matchRepository.findById(matchId);
      if (!matchResult.success) {
        return failure(matchResult.error);
      }

      const match = matchResult.data;
      const docLoveId = await this.docLoveHelper.getDocLoveUserId();

      const isDocLoveConversation =
        match.userId1 === docLoveId || match.userId2 === docLoveId;

      return success(isDocLoveConversation);
    } catch (error) {
      return failure(
        new InternalError(
          'Failed to check if conversation is with Doc Love',
          error,
        ),
      );
    }
  }

  /**
   * Generates and saves an AI response from Doc Love
   * 
   * @param matchId - The match/conversation ID
   * @param userId - The user who sent the message
   * @param userMessage - The message sent by the user
   * @returns Result containing the generated message from Doc Love
   */
  async generateAndSaveReply(
    matchId: string,
    userId: string,
    userMessage: Message,
  ): Promise<Result<Message, DomainError>> {
    try {
      if (this.logger) {
        this.logger.debug({ matchId, userId, messageId: userMessage.id }, 'Starting Doc Love reply generation');
      }

      // Get Doc Love's user ID
      const docLoveId = await this.docLoveHelper.getDocLoveUserId();

      if (this.logger) {
        this.logger.debug({ docLoveId, userId }, 'Doc Love user ID retrieved');
      }

      // Safety check: Don't generate response if the sender is Doc Love
      // (prevents infinite loops)
      if (userId === docLoveId) {
        if (this.logger) {
          this.logger.warn({ matchId, userId }, 'Attempted to generate reply from Doc Love to itself, preventing infinite loop');
        }
        return failure(
          new InternalError('Cannot generate Doc Love reply: sender is Doc Love'),
        );
      }

      // Get conversation history (using centralized config)
      if (this.logger) {
        this.logger.debug({ matchId }, 'Retrieving conversation history');
      }
      const historyResult = await this.getConversationHistory(
        matchId,
        AIConfig.context.conversationHistoryLimit,
      );
      if (!historyResult.success) {
        if (this.logger) {
          this.logger.error({ matchId, error: historyResult.error }, 'Failed to get conversation history');
        }
        return failure(historyResult.error);
      }

      const conversationHistory = historyResult.data;
      if (this.logger) {
        this.logger.debug({ matchId, historyLength: conversationHistory.length }, 'Conversation history retrieved');
      }

      // Get user context (optional - controlled by centralized config)
      // TODO: Re-enable when performance allows (set AI_INCLUDE_USER_CONTEXT=true in .env)
      const userContext = AIConfig.context.includeUserContext
        ? await this.getUserContext(userId)
        : undefined;

      // Get active matches (optional - controlled by centralized config)
      // TODO: Re-enable when performance allows (set AI_INCLUDE_ACTIVE_MATCHES=true in .env)
      const activeMatches = AIConfig.context.includeActiveMatches
        ? await this.getActiveMatches(userId, docLoveId)
        : [];

      // Build AI request
      const aiRequest: IAGenerateRequest = {
        userId,
        docLoveUserId: docLoveId,
        conversationHistory,
        lastUserMessage: userMessage.content,
        userContext,
        activeMatches,
      };

      if (this.logger) {
        this.logger.info(
          {
            matchId,
            userId,
            historyLength: conversationHistory.length,
            hasUserContext: !!userContext,
            activeMatchesCount: activeMatches.length,
            lastUserMessage: userMessage.content.substring(0, 100) + (userMessage.content.length > 100 ? '...' : ''),
          },
          '4. Mensaje antes de enviarse a LLM de Ollama - Request preparado',
        );
      }

      // Generate AI response
      const aiResponseResult = await this.aiService.generateReply(aiRequest);
      if (!aiResponseResult.success) {
        if (this.logger) {
          this.logger.error(
            { matchId, userId, error: aiResponseResult.error },
            'AI service failed to generate reply',
          );
        }
        return failure(aiResponseResult.error);
      }

      const aiResponse = aiResponseResult.data;
      if (this.logger) {
        this.logger.info(
          {
            matchId,
            userId,
            responseLength: aiResponse.content.length,
            provider: aiResponse.provider,
            model: aiResponse.model,
            responsePreview: aiResponse.content.substring(0, 200) + (aiResponse.content.length > 200 ? '...' : ''),
          },
          '9. DocLoveService - Respuesta de Ollama recibida y procesada',
        );
      }

      // Save AI response as a message from Doc Love
      if (this.logger) {
        this.logger.info(
          { matchId, docLoveId, responseLength: aiResponse.content.length },
          '10. DocLoveService - Guardando respuesta como mensaje en base de datos',
        );
      }
      const saveResult = await this.messageRepository.create({
        matchId,
        senderId: docLoveId,
        content: aiResponse.content,
      });

      if (!saveResult.success) {
        if (this.logger) {
          this.logger.error(
            { matchId, error: saveResult.error },
            'Failed to save AI response message',
          );
        }
        return failure(saveResult.error);
      }

      if (this.logger) {
        this.logger.info(
          { matchId, messageId: saveResult.data.id, contentLength: saveResult.data.content.length },
          '11. DocLoveService - Mensaje de Doc Love guardado exitosamente - Proceso completado',
        );
      }

      return success(saveResult.data);
    } catch (error) {
      if (this.logger) {
        this.logger.error({ matchId, userId, error }, 'Unexpected error in generateAndSaveReply');
      }
      return failure(
        new InternalError('Failed to generate and save Doc Love reply', error),
      );
    }
  }

  /**
   * Gets conversation history formatted for AI
   * 
   * @param matchId - The match/conversation ID
   * @param limit - Maximum number of messages to retrieve
   * @returns Result containing formatted conversation history
   */
  private async getConversationHistory(
    matchId: string,
    limit: number = 20,
  ): Promise<Result<IAMessage[], DomainError>> {
    try {
      // Get messages from repository (most recent first)
      const messagesResult = await this.messageRepository.findByMatchId(
        matchId,
        limit,
      );
      if (!messagesResult.success) {
        return failure(messagesResult.error);
      }

      const docLoveId = await this.docLoveHelper.getDocLoveUserId();

      // Transform to AI format (reverse to chronological order)
      const history: IAMessage[] = messagesResult.data
        .reverse()
        .map((msg) => ({
          role: msg.senderId === docLoveId ? 'assistant' : 'user',
          content: msg.content,
        }));

      return success(history);
    } catch (error) {
      return failure(
        new InternalError('Failed to get conversation history', error),
      );
    }
  }

  /**
   * Gets user context for AI (optional)
   * 
   * @param userId - The user ID
   * @returns User context or undefined if not available
   */
  private async getUserContext(
    userId: string,
  ): Promise<{ name?: string; bio?: string } | undefined> {
    if (!this.userRepository) {
      return undefined;
    }

    try {
      const userResult = await this.userRepository.findById(userId);
      if (!userResult.success) {
        return undefined;
      }

      const user = userResult.data;
      return {
        name: user.name,
        bio: user.bio,
      };
    } catch (error) {
      // Don't fail if we can't get user context
      return undefined;
    }
  }

  /**
   * Gets active matches for the user (excluding Doc Love)
   * 
   * @param userId - The user ID
   * @param docLoveId - Doc Love's user ID (to exclude)
   * @returns Array of active matches (max 3)
   */
  private async getActiveMatches(
    userId: string,
    docLoveId: string,
  ): Promise<
    Array<{
      matchId: string;
      otherUserName: string;
      lastMessage?: string;
    }>
  > {
    try {
      // Get all matches for the user
      const matchesResult = await this.matchRepository.findByUserId(userId);
      if (!matchesResult.success) {
        return [];
      }

      const matches = matchesResult.data.filter(
        (match) =>
          match.userId1 !== docLoveId &&
          match.userId2 !== docLoveId &&
          (match.userId1 === userId || match.userId2 === userId),
      );

      // Limit to 3 matches
      const limitedMatches = matches.slice(0, 3);

      // Get last message for each match
      const activeMatches = await Promise.all(
        limitedMatches.map(async (match) => {
          const otherUserId =
            match.userId1 === userId ? match.userId2 : match.userId1;

          // Get last message
          const messagesResult = await this.messageRepository.findByMatchId(
            match.id,
            1,
          );

          let lastMessage: string | undefined;
          if (messagesResult.success && messagesResult.data.length > 0) {
            lastMessage = messagesResult.data[0].content;
          }

          // Get other user's name (if userRepository is available)
          let otherUserName = 'Usuario';
          if (this.userRepository) {
            const userResult = await this.userRepository.findById(otherUserId);
            if (userResult.success) {
              otherUserName = userResult.data.name;
            }
          }

          return {
            matchId: match.id,
            otherUserName,
            lastMessage,
          };
        }),
      );

      return activeMatches;
    } catch (error) {
      // Don't fail if we can't get active matches
      return [];
    }
  }
}

