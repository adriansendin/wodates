import { Result, success, failure } from '../../Result';
import { DomainError, InternalError } from '../../errors/DomainError';
import { GetAllUserChats, ProcessedChatSummary } from './GetAllUserChats';
import { UserAIProfileRepository } from '../../repositories/UserAIProfileRepository';
import { UserRepository } from '../../repositories/UserRepository';
import { AiServiceProfileClient } from '../../../app/ai/clients/AiServiceProfileClient';

/**
 * GenerateUserProfileFromChats - Generates or updates user profile from unprocessed chats
 *
 * This use case:
 * 1. Gets all unprocessed chats for the user (using GetAllUserChats)
 * 2. Retrieves existing profile (if any)
 * 3. Transforms chat data to ai-service format
 * 4. Calls ai-service to generate/update profile summary
 * 5. Saves the updated profile to user_ai_profiles table
 *
 * Note: Messages are NOT marked as processed - they are only read for analysis.
 */
export class GenerateUserProfileFromChats {
  private readonly aiServiceProfileClient: AiServiceProfileClient;

  constructor(
    private getAllUserChats: GetAllUserChats,
    private userAIProfileRepository: UserAIProfileRepository,
    private userRepository: UserRepository,
    private logger?: any
  ) {
    this.aiServiceProfileClient = new AiServiceProfileClient(
      undefined, // Use default from AIConfig
      undefined, // Use default timeout
      logger
    );
    if (this.logger && typeof this.logger.info === 'function') {
      this.logger.info('GenerateUserProfileFromChats: Using ai-service for profile generation');
    }
  }

  async execute(userId: string): Promise<Result<string, DomainError>> {
    try {
      // Step 1: Get all unprocessed chats
      if (this.logger) {
        this.logger.info(
          { userId },
          'Generating user profile from chats - fetching unprocessed chats'
        );
      }

      const chatsResult = await this.getAllUserChats.execute(userId);
      if (!chatsResult.success) {
        return failure(chatsResult.error);
      }

      const chats = chatsResult.data;

      // If no chats with unprocessed messages, return early
      if (chats.length === 0) {
        if (this.logger) {
          this.logger.info(
            { userId },
            'No unprocessed chats found - nothing to analyze'
          );
        }
        return success('No unprocessed chats to analyze');
      }

      // Step 2: Get existing profile
      const existingProfileResult =
        await this.userAIProfileRepository.findByUserId(userId);
      if (!existingProfileResult.success) {
        return failure(existingProfileResult.error);
      }

      // Step 3: Get user information for context
      const userResult = await this.userRepository.findById(userId);
      if (!userResult.success) {
        return failure(userResult.error);
      }

      const user = userResult.data;

      // Step 4: Transform chats to ai-service format and generate profile
      if (this.logger) {
        this.logger.info(
          {
            userId,
            chatsCount: chats.length,
          },
          'Calling ai-service to generate profile summary'
        );
      }

      const conversations = this.transformToAiServiceConversations(
        chats,
        user.name || 'Usuario'
      );

      const aiServiceResponse = await this.aiServiceProfileClient.generateProfile({
        conversations,
        main_user_marker: '(MAIN)',
      });

      const summaryResponse = {
        summary: aiServiceResponse.profile,
        provider: 'ai-service',
        model: 'ai-service',
      };

      // Step 5: Save incremental summary (plain text)
      const upsertResult = await this.userAIProfileRepository.upsert({
        userId,
        summaryIncremental: summaryResponse.summary,
        summaryEmbedding: null,
      });

      if (!upsertResult.success) {
        return failure(upsertResult.error);
      }

      if (this.logger) {
        this.logger.info(
          {
            userId,
            summaryLength: summaryResponse.summary.length,
            provider: summaryResponse.provider,
            model: summaryResponse.model,
          },
          'Incremental summary generated and saved successfully'
        );
      }

      // Step 6: Merge summaries if consolidated summary exists
      const profileAfterIncremental = upsertResult.data;
      const consolidatedSummary = profileAfterIncremental.summary;
      const incrementalSummary = profileAfterIncremental.summaryIncremental;

      if (consolidatedSummary && incrementalSummary) {
        // Both summaries exist - merge them using ai-service
        if (this.logger) {
          this.logger.info(
            { userId },
            'Merging consolidated summary with incremental summary'
          );
        }

        let mergeResult: Result<string, DomainError>;
        try {
          const aiServiceResponse = await this.aiServiceProfileClient.mergeProfiles({
            consolidated_profile: consolidatedSummary,
            incremental_profile: incrementalSummary,
          });

          mergeResult = success(aiServiceResponse.merged_profile);
        } catch (error) {
          mergeResult = failure(
            new InternalError(
              'Failed to merge profiles via ai-service',
              error instanceof Error ? error : new Error(String(error))
            )
          );
        }

        if (!mergeResult.success) {
          // Log error but don't fail - incremental summary is already saved
          if (this.logger) {
            this.logger.error(
              { userId, error: mergeResult.error },
              'Failed to merge summaries, incremental summary saved but merge skipped'
            );
          }
          return success(summaryResponse.summary);
        }

        // Save merged summary and clear incremental
        const finalUpsertResult = await this.userAIProfileRepository.upsert({
          userId,
          summary: mergeResult.data,
          summaryIncremental: null,
          summaryEmbedding: null,
        });

        if (!finalUpsertResult.success) {
          if (this.logger) {
            this.logger.error(
              { userId, error: finalUpsertResult.error },
              'Failed to save merged summary'
            );
          }
          return failure(finalUpsertResult.error);
        }

        if (this.logger) {
          this.logger.info(
            {
              userId,
              mergedSummaryLength: mergeResult.data.length,
            },
            'Summaries merged and saved successfully, incremental summary cleared'
          );
        }

        return success(mergeResult.data);
      } else if (!consolidatedSummary && incrementalSummary) {
        // First time - copy incremental to summary and clear incremental
        if (this.logger) {
          this.logger.info(
            { userId },
            'First time generating profile - copying incremental to summary'
          );
        }

        const firstTimeUpsertResult = await this.userAIProfileRepository.upsert(
          {
            userId,
            summary: incrementalSummary,
            summaryIncremental: null,
            summaryEmbedding: null,
          }
        );

        if (!firstTimeUpsertResult.success) {
          return failure(firstTimeUpsertResult.error);
        }

        if (this.logger) {
          this.logger.info({ userId }, 'Profile initialized successfully');
        }

        return success(incrementalSummary);
      }

      // No consolidated summary and no incremental (shouldn't happen, but handle gracefully)
      return success(summaryResponse.summary);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Unknown error';
      
      if (this.logger) {
        this.logger.error(
          {
            userId,
            error: errorMessage,
            errorStack: error instanceof Error ? error.stack : undefined,
          },
          'Error generating user profile from chats'
        );
      }

      return failure(
        new InternalError(
          `Unexpected error generating user profile from chats: ${errorMessage}`,
          error
        )
      );
    }
  }

  /**
   * Transforms ProcessedChatSummary[] to ai-service conversations format
   * Converts the backend's chat structure to ai-service's flat conversations array
   */
  private transformToAiServiceConversations(
    chats: ProcessedChatSummary[],
    currentUserName: string
  ): Array<{
    role: 'user' | 'assistant';
    content: string;
    sender: string; // Sender identifier (with '(MAIN)' marker if applicable)
  }> {
    const conversations: Array<{
      role: 'user' | 'assistant';
      content: string;
      sender: string;
    }> = [];

    // Process all chats uniformly
    for (const chat of chats) {
      // Include ALL messages (from both users) in chronological order
      for (const msg of chat.messages) {
        // Determine sender name with (MAIN) marker if applicable
        let sender: string;
        if (msg.senderName) {
          // Check if this message is from the current user (being profiled)
          // Compare normalized names (trim, case-insensitive) to handle formatting differences
          const normalizedSenderName = msg.senderName.trim().toLowerCase();
          const normalizedCurrentUserName = currentUserName.trim().toLowerCase();
          if (normalizedSenderName === normalizedCurrentUserName) {
            sender = `${msg.senderName} (MAIN)`;
          } else {
            sender = msg.senderName;
          }
        } else {
          // Fallback: if senderName is missing, we can't determine if it's MAIN
          sender = 'Usuario';
        }

        // All messages are treated as 'user' role in ai-service format
        // (ai-service will handle the distinction based on sender name)
        conversations.push({
          role: 'user',
          content: msg.content,
          sender,
        });
      }
    }

    return conversations;
  }
}
