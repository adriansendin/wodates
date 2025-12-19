import { UserAIProfileRepository } from '../../../domain/repositories/UserAIProfileRepository';
import { AiServiceEmbeddingClient } from '../clients/AiServiceEmbeddingClient';

/**
 * UserAIProfileEmbeddingService - Generates embeddings from existing summaries
 *
 * This service generates vector embeddings from plain text summaries stored in user_ai_profiles table.
 * Designed to be called asynchronously (via jobs/cron/webhooks) to update embeddings when summaries change.
 *
 * Architecture:
 * - Reads summary (text column containing plain text) from user_ai_profiles table
 * - Generates 768-dimensional embedding using ai-service HTTP API
 * - Updates summary_embedding and summary_updated_at columns
 * - Handles errors gracefully (logs to console, preserves existing state)
 */
export class UserAIProfileEmbeddingService {
  private readonly aiServiceEmbeddingClient: AiServiceEmbeddingClient;

  constructor(
    private aiProfileRepository: UserAIProfileRepository,
    private logger?: any
  ) {
    this.aiServiceEmbeddingClient = new AiServiceEmbeddingClient(
      undefined, // Use default from AIConfig
      undefined, // Use default timeout
      logger
    );
    if (this.logger && typeof this.logger.info === 'function') {
      this.logger.info('UserAIProfileEmbeddingService: Using ai-service for embedding generation');
    }
  }

  /**
   * Generates embedding from existing summary and updates the database
   *
   * Process:
   * 1. Retrieves user AI profile from database
   * 2. If no summary exists, returns without doing anything
   * 3. Generates embedding from summary text using ai-service
   * 4. Updates summary_embedding and summary_updated_at columns
   * 5. On error: logs to console and preserves existing embedding state
   *
   * @param userId - The user ID to process
   */
  async generateEmbeddingFromSummary(userId: string): Promise<void> {
    try {
      if (this.logger) {
        this.logger.debug(
          { userId },
          'Starting embedding generation from summary'
        );
      }

      // Step 1: Get user AI profile from database
      const profileResult = await this.aiProfileRepository.findByUserId(userId);

      if (!profileResult.success) {
        const errorMessage = `Failed to fetch user AI profile: ${profileResult.error.message}`;
        console.error(`[UserAIProfileEmbeddingService] ${errorMessage}`, {
          userId,
          error: profileResult.error,
        });
        if (this.logger) {
          this.logger.error(
            { userId, error: profileResult.error },
            errorMessage
          );
        }
        return;
      }

      const profile = profileResult.data;

      // Step 2: Check if summary exists
      if (!profile || !profile.summary || profile.summary.trim().length === 0) {
        if (this.logger) {
          this.logger.debug(
            { userId },
            'No summary found, skipping embedding generation'
          );
        }
        return;
      }

      // Step 3: Generate embedding from summary plain text using ai-service
      let embedding: number[];
      try {
        const summaryText = profile.summary;

        const aiServiceResponse = await this.aiServiceEmbeddingClient.generateEmbedding({
          text: summaryText,
        });

        embedding = aiServiceResponse.embedding;

        if (this.logger) {
          this.logger.debug(
            {
              userId,
              summaryTextLength: summaryText.length,
              embeddingDimension: embedding.length,
              dimension: aiServiceResponse.dimension,
            },
            'Embedding generated successfully from plain text summary'
          );
        }
      } catch (embeddingError) {
        const errorMessage = `Failed to generate embedding: ${embeddingError instanceof Error ? embeddingError.message : 'Unknown error'}`;
        console.error(`[UserAIProfileEmbeddingService] ${errorMessage}`, {
          userId,
          error: embeddingError,
        });
        if (this.logger) {
          this.logger.error({ userId, error: embeddingError }, errorMessage);
        }
        // Preserve existing embedding state - don't update database
        return;
      }

      // Step 4: Update database with new embedding
      const updateResult = await this.aiProfileRepository.update(userId, {
        summaryEmbedding: embedding,
      });

      if (!updateResult.success) {
        const errorMessage = `Failed to update user AI profile: ${updateResult.error.message}`;
        console.error(`[UserAIProfileEmbeddingService] ${errorMessage}`, {
          userId,
          error: updateResult.error,
        });
        if (this.logger) {
          this.logger.error(
            { userId, error: updateResult.error },
            errorMessage
          );
        }
        // Preserve existing embedding state - update failed
        return;
      }

      if (this.logger) {
        this.logger.info(
          {
            userId,
            embeddingDimension: embedding.length,
          },
          'Successfully updated user AI profile embedding'
        );
      }
    } catch (error) {
      // Catch-all for unexpected errors
      const errorMessage = `Unexpected error in generateEmbeddingFromSummary: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[UserAIProfileEmbeddingService] ${errorMessage}`, {
        userId,
        error,
      });
      if (this.logger) {
        this.logger.error({ userId, error }, errorMessage);
      }
      // Preserve existing embedding state - unexpected error occurred
    }
  }
}
