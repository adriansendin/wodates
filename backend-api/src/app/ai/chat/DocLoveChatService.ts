import { Result, success, failure } from '../../../domain/Result';
import { DomainError, InternalError } from '../../../domain/errors/DomainError';
import { Message } from '../../../domain/entities/Message';
import { MessageRepository } from '../../../domain/repositories/MessageRepository';
import { MatchRepository } from '../../../domain/repositories/MatchRepository';
import { UserRepository } from '../../../domain/repositories/UserRepository';
import { DocLoveHelper } from '../../services/doc-love-helper';
import { ChatMessage } from '../core/ChatModel';
import { AIConfig } from '../ai-settings';
import { AiServiceChatClient } from '../clients/AiServiceChatClient';

/**
 * DocLoveChatService - Orchestrates Doc Love online chat
 *
 * This service handles real-time chat conversations with Doc Love.
 * It builds prompts, calls ai-service HTTP API, and persists bot replies.
 *
 * This is part of the ai/chat layer, focused on online chat orchestration.
 */
export class DocLoveChatService {
  private readonly aiServiceChatClient: AiServiceChatClient;

  constructor(
    private docLoveHelper: DocLoveHelper,
    private messageRepository: MessageRepository,
    private matchRepository: MatchRepository,
    private userRepository?: UserRepository,
    private logger?: any
  ) {
    this.aiServiceChatClient = new AiServiceChatClient(
      undefined, // Use default from AIConfig
      undefined, // Use default timeout
      logger
    );
    if (this.logger) {
      this.logger.info('DocLoveChatService: Using ai-service for chat generation');
    }
  }

  /**
   * Detects if a match/conversation is with Doc Love
   */
  async isDocLoveConversation(
    matchId: string
  ): Promise<Result<boolean, DomainError>> {
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
          error
        )
      );
    }
  }

  /**
   * Generates and saves an AI response from Doc Love
   *
   * This is the main method called when a user sends a message to Doc Love.
   */
  async generateAndSaveReply(
    matchId: string,
    userId: string,
    userMessage: Message
  ): Promise<Result<Message, DomainError>> {
    try {
      if (this.logger) {
        this.logger.debug(
          { matchId, userId, messageId: userMessage.id },
          'Starting Doc Love reply generation'
        );
      }

      const docLoveId = await this.docLoveHelper.getDocLoveUserId();

      if (userId === docLoveId) {
        if (this.logger) {
          this.logger.warn(
            { matchId, userId },
            'Attempted to generate reply from Doc Love to itself'
          );
        }
        return failure(
          new InternalError(
            'Cannot generate Doc Love reply: sender is Doc Love'
          )
        );
      }

      // Get conversation history
      const historyResult = await this.getConversationHistory(
        matchId,
        AIConfig.context.conversationHistoryLimit
      );
      if (!historyResult.success) {
        return failure(historyResult.error);
      }

      const conversationHistory = historyResult.data;

      // Get user context (optional)
      const userContext = AIConfig.context.includeUserContext
        ? await this.getUserContext(userId)
        : undefined;

      // Get active matches (optional)
      const activeMatches = AIConfig.context.includeActiveMatches
        ? await this.getActiveMatches(userId, docLoveId)
        : [];

      // Log before calling LLM
      if (this.logger) {
        this.logger.info(
          {
            matchId,
            userId,
            provider: 'ai-service',
            model: 'ai-service',
            historyLength: conversationHistory.length,
            userContextIncluded: !!userContext,
            activeMatchesCount: activeMatches.length,
          },
          'Calling ai-service to generate Doc Love response'
        );
      }

      // Use ai-service HTTP client
      const systemPrompt = this.buildSystemPrompt(userContext, activeMatches);
      const messages = this.buildMessages(conversationHistory, userMessage.content);

      const aiServiceResponse = await this.aiServiceChatClient.generateChat({
        messages,
        system: systemPrompt,
      });

      const chatResponse = {
        content: aiServiceResponse.content,
        provider: 'ai-service',
        model: 'ai-service',
      };

      if (this.logger) {
        this.logger.info(
          {
            matchId,
            userId,
            responseLength: chatResponse.content.length,
            provider: chatResponse.provider,
            model: chatResponse.model,
          },
          'Doc Love chat response generated'
        );
      }

      // Save AI response as a message from Doc Love
      const saveResult = await this.messageRepository.create({
        matchId,
        senderId: docLoveId,
        content: chatResponse.content,
      });

      if (!saveResult.success) {
        return failure(saveResult.error);
      }

      if (this.logger) {
        this.logger.info(
          { matchId, messageId: saveResult.data.id },
          'Doc Love reply saved successfully'
        );
      }

      return success(saveResult.data);
    } catch (error) {
      if (this.logger) {
        this.logger.error(
          { matchId, userId, error },
          'Unexpected error in generateAndSaveReply'
        );
      }
      return failure(
        new InternalError('Failed to generate and save Doc Love reply', error)
      );
    }
  }

  /**
   * Gets conversation history formatted for ai-service
   */
  private async getConversationHistory(
    matchId: string,
    limit: number = 20
  ): Promise<Result<ChatMessage[], DomainError>> {
    try {
      const messagesResult = await this.messageRepository.findByMatchId(
        matchId,
        limit
      );
      if (!messagesResult.success) {
        return failure(messagesResult.error);
      }

      const docLoveId = await this.docLoveHelper.getDocLoveUserId();

      const history: ChatMessage[] = messagesResult.data
        .reverse()
        .map((msg) => ({
          role: msg.senderId === docLoveId ? 'assistant' : 'user',
          content: msg.content,
        }));

      return success(history);
    } catch (error) {
      return failure(
        new InternalError('Failed to get conversation history', error)
      );
    }
  }

  /**
   * Gets user context for chat (optional)
   */
  private async getUserContext(
    userId: string
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
        ...(user.name && { name: user.name }),
        ...(user.bio && { bio: user.bio }),
      };
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Gets active matches for the user (excluding Doc Love)
   */
  private async getActiveMatches(
    userId: string,
    docLoveId: string
  ): Promise<
    Array<{
      matchId: string;
      otherUserName: string;
      lastMessage?: string;
    }>
  > {
    try {
      const matchesResult = await this.matchRepository.findByUserId(userId);
      if (!matchesResult.success) {
        return [];
      }

      const matches = matchesResult.data.filter(
        (match) =>
          match.userId1 !== docLoveId &&
          match.userId2 !== docLoveId &&
          (match.userId1 === userId || match.userId2 === userId)
      );

      const limitedMatches = matches.slice(0, 3);

      const activeMatches = await Promise.all(
        limitedMatches.map(async (match) => {
          const otherUserId =
            match.userId1 === userId ? match.userId2 : match.userId1;

          const messagesResult = await this.messageRepository.findByMatchId(
            match.id,
            1
          );

          let lastMessage: string | undefined;
          if (
            messagesResult.success &&
            messagesResult.data.length > 0 &&
            messagesResult.data[0]
          ) {
            lastMessage = messagesResult.data[0].content;
          }

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
            ...(lastMessage && { lastMessage }),
          };
        })
      );

      return activeMatches;
    } catch (error) {
      return [];
    }
  }

  /**
   * Builds system prompt for ai-service
   * Includes system instructions, user context, and active matches
   */
  private buildSystemPrompt(
    userContext?: { name?: string; bio?: string },
    activeMatches?: Array<{
      matchId: string;
      otherUserName: string;
      lastMessage?: string;
    }>
  ): string {
    let systemPrompt = `${AIConfig.prompt.systemInstructions}\n\n`;

    if (userContext?.name) {
      systemPrompt += `El usuario se llama ${userContext.name}.\n`;
    }

    if (userContext?.bio) {
      systemPrompt += `Su bio dice: "${userContext.bio}"\n`;
    }

    if (activeMatches && activeMatches.length > 0) {
      systemPrompt += `\nActualmente tiene ${activeMatches.length} conversación(es) activa(s):\n`;
      for (const match of activeMatches.slice(0, 3)) {
        systemPrompt += `- Con ${match.otherUserName}`;
        if (match.lastMessage) {
          systemPrompt += `: último mensaje sobre "${match.lastMessage.substring(0, 50)}..."`;
        }
        systemPrompt += '\n';
      }
    }

    return systemPrompt;
  }

  /**
   * Builds messages array for ai-service
   * Includes conversation history and last user message
   */
  private buildMessages(
    conversationHistory: ChatMessage[],
    lastUserMessage: string
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add conversation history
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      });
    }

    // Add last user message if not already in history
    const lastHistoryMessage = conversationHistory[conversationHistory.length - 1];
    const isLastMessageInHistory =
      lastHistoryMessage &&
      lastHistoryMessage.role === 'user' &&
      lastHistoryMessage.content === lastUserMessage;

    if (!isLastMessageInHistory && lastUserMessage) {
      messages.push({
        role: 'user',
        content: lastUserMessage,
      });
    }

    return messages;
  }
}
