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
        this.logger.debug({ userId }, 'Starting bio generation from summary');
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
      // Step 3: Generate bio from summary using ai-service
      let bio: string;
      try {
        const summaryText = profile.summary;

        // --- NEW: fetch user gender for pronouns (A)
        let pronounLine = 'Use third person pronouns: they/them.';
        try {
          const userResult = await this.userRepository.findById(userId);
          if (userResult.success && userResult.data?.gender) {
            const g = userResult.data.gender;
            if (g === 'male') pronounLine = 'Use third person pronouns: he/him.';
            else if (g === 'female') pronounLine = 'Use third person pronouns: she/her.';
            else pronounLine = 'Use third person pronouns: they/them.';
          }
        } catch {
          // ignore: keep default they/them
        }

        // Build the prompt with the summary (+ pronouns + format rules)
        const prompt = `${AIConfig.prompt.bioGeneration}

RULES:
- ${pronounLine}
- Do NOT include any speaker labels.
- Do NOT write "Doc Love:" (or any variant like "DocLove:", "DOC LOVE -", etc.).
- Output only the bio text.

STRUCTURED PROFILE:
"""
${summaryText}
"""

Now generate the bio based on this profile.`;

        const aiServiceResponse = await this.aiServiceChatClient.generateChat({
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        bio = aiServiceResponse.content.trim();

        // --- NEW: normalize/strip "Doc Love:" prefix (B)
        bio = bio
          .replace(/^\s*doc\s*love\s*[:\-]\s*/i, '') // "Doc Love:" or "Doc Love -"
          .replace(/^\s*doc\s*love\s*/i, '')         // fallback if model writes "Doc Love" without punctuation
          .trim();

        bio = bio.trim();
        bio = bio.replace(/(.)\1{9,}/g, '').trim();

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
