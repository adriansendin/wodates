import { UserAIProfileRepository } from '../../../domain/repositories/UserAIProfileRepository';
import { UserRepository } from '../../../domain/repositories/UserRepository';
import { AiServiceChatClient } from '../clients/AiServiceChatClient';
import { AIConfig } from '../ai-settings';

/**
 * UserBioGenerationService - Generates user bios from AI profile summaries
 *
 * This service generates short bios (max 240 chars) from structured profile summaries
 * stored in user_ai_profiles table. Designed to be called asynchronously (via jobs/cron)
 * to update bios when summaries change.
 *
 * Architecture:
 * - Reads summary (structured profile text) from user_ai_profiles table
 * - Generates bio using ai-service HTTP API with bio generation prompt
 * - Validates bio length (max 240 chars)
 * - Updates users.bio column
 * - Handles errors gracefully (logs to console, preserves existing bio)
 */
export class UserBioGenerationService {
  private readonly aiServiceChatClient: AiServiceChatClient;

  constructor(
    private aiProfileRepository: UserAIProfileRepository,
    private userRepository: UserRepository,
    private logger?: any
  ) {
    this.aiServiceChatClient = new AiServiceChatClient(
      undefined, // Use default from AIConfig
      undefined, // Use default timeout
      logger
    );
    if (this.logger && typeof this.logger.info === 'function') {
      this.logger.info(
        'UserBioGenerationService: Using ai-service for bio generation'
      );
    }
  }

  /**
   * Generates bio from existing summary and updates the database
   *
   * Process:
   * 1. Retrieves user AI profile from database
   * 2. If no summary exists, returns without doing anything
   * 3. Generates bio from summary text using ai-service
   * 4. Validates bio length (max 240 chars)
   * 5. Updates users.bio column
   * 6. On error: logs to console and preserves existing bio state
   *
   * @param userId - The user ID to process
   */
  async generateBioFromSummary(userId: string): Promise<void> {
    try {
      if (this.logger) {
        this.logger.debug(
          { userId },
          'Starting bio generation from summary'
        );
      }

      // Step 1: Get user AI profile from database
      const profileResult = await this.aiProfileRepository.findByUserId(userId);

      if (!profileResult.success) {
        const errorMessage = `Failed to fetch user AI profile: ${profileResult.error.message}`;
        console.error(`[UserBioGenerationService] ${errorMessage}`, {
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
            'No summary found, skipping bio generation'
          );
        }
        return;
      }

      // Step 3: Generate bio from summary using ai-service
      let bio: string;
      try {
        const summaryText = profile.summary;

        // Build the prompt with the summary
        const prompt = `${AIConfig.prompt.bioGeneration}

PERFIL ESTRUCTURADO:
"""
${summaryText}
"""

Ahora genera la bio basándote en este perfil.`;

        const aiServiceResponse = await this.aiServiceChatClient.generateChat({
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        bio = aiServiceResponse.content.trim();

        // Validate bio length (max 240 chars)
        if (bio.length > 240) {
          if (this.logger) {
            this.logger.warn(
              {
                userId,
                bioLength: bio.length,
                bioPreview: bio.substring(0, 50),
              },
              'Generated bio exceeds 240 chars, truncating'
            );
          }
          // Truncate to 240 chars, ensuring we don't cut in the middle of a word
          bio = bio.substring(0, 240);
          const lastSpace = bio.lastIndexOf(' ');
          if (lastSpace > 200) {
            // Only truncate at word boundary if it's reasonable
            bio = bio.substring(0, lastSpace);
          }
        }

        if (this.logger) {
          this.logger.debug(
            {
              userId,
              summaryTextLength: summaryText.length,
              bioLength: bio.length,
            },
            'Bio generated successfully from summary'
          );
        }
      } catch (bioError) {
        const errorMessage = `Failed to generate bio: ${bioError instanceof Error ? bioError.message : 'Unknown error'}`;
        console.error(`[UserBioGenerationService] ${errorMessage}`, {
          userId,
          error: bioError,
        });
        if (this.logger) {
          this.logger.error({ userId, error: bioError }, errorMessage);
        }
        // Preserve existing bio state - don't update database
        return;
      }

      // Step 4: Update database with new bio
      const updateResult = await this.userRepository.update(userId, {
        bio,
      });

      if (!updateResult.success) {
        const errorMessage = `Failed to update user bio: ${updateResult.error.message}`;
        console.error(`[UserBioGenerationService] ${errorMessage}`, {
          userId,
          error: updateResult.error,
        });
        if (this.logger) {
          this.logger.error(
            { userId, error: updateResult.error },
            errorMessage
          );
        }
        // Preserve existing bio state - update failed
        return;
      }

      if (this.logger) {
        this.logger.info(
          {
            userId,
            bioLength: bio.length,
          },
          'Successfully updated user bio'
        );
      }
    } catch (error) {
      // Catch-all for unexpected errors
      const errorMessage = `Unexpected error in generateBioFromSummary: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[UserBioGenerationService] ${errorMessage}`, {
        userId,
        error,
      });
      if (this.logger) {
        this.logger.error({ userId, error }, errorMessage);
      }
      // Preserve existing bio state - unexpected error occurred
    }
  }
}

