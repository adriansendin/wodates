import { Result, success } from '../../domain/Result';
import { DomainError } from '../../domain/errors/DomainError';
import { UserAIProfileRepository } from '../../domain/repositories/UserAIProfileRepository';
import { AiServiceChatClient } from '../ai/clients/AiServiceChatClient';
import { AIConfig } from '../ai/ai-settings';
import { AffinitySentenceGenerator } from '../../domain/services/AffinitySentenceGenerator';

/**
 * Service for generating affinity sentences for matches
 *
 * Extracts shared logic from FeedController for reuse in match creation
 * and chat affinity endpoints.
 */
export class AffinitySentenceService implements AffinitySentenceGenerator {
  constructor(
    private readonly userAIProfileRepository: UserAIProfileRepository,
    private readonly aiServiceChatClient: AiServiceChatClient,
    private readonly logger?: any
  ) {}

  /**
   * Generates a single affinity sentence for two users
   *
   * @param userId1 - First user ID
   * @param userId2 - Second user ID
   * @returns Result containing the affinity sentence (or fallback if generation fails)
   */
  async generateAffinitySentence(
    userId1: string,
    userId2: string
  ): Promise<Result<string, DomainError>> {
    // Check if affinity sentences feature is enabled
    if (!AIConfig.affinitySentencesEnabled) {
      // Feature disabled: return fallback sentence
      return success(AIConfig.affinitySentencesFallback[0]);
    }

    // Get AI profiles for both users
    const [user1ProfileResult, user2ProfileResult] = await Promise.all([
      this.userAIProfileRepository.findByUserId(userId1),
      this.userAIProfileRepository.findByUserId(userId2),
    ]);

    // Check if we have both profiles with non-empty summaries
    const user1HasProfile =
      user1ProfileResult.success &&
      user1ProfileResult.data?.summary &&
      user1ProfileResult.data.summary.trim().length > 0;
    const user2HasProfile =
      user2ProfileResult.success &&
      user2ProfileResult.data?.summary &&
      user2ProfileResult.data.summary.trim().length > 0;

    if (!user1HasProfile || !user2HasProfile) {
      // Return fallback sentence when either profile is missing/empty
      if (this.logger) {
        this.logger.warn(
          {
            userId1,
            userId2,
            user1HasProfile,
            user2HasProfile,
          },
          'Missing AI profiles for affinity sentences, returning fallback sentence'
        );
      }
      return success(AIConfig.affinitySentencesFallback[0]);
    }

    const user1Profile = user1ProfileResult.data.summary ?? '';
    const user2Profile = user2ProfileResult.data.summary ?? '';

    // Build complete prompt in backend (following chat pattern)
    const fullPrompt = AIConfig.prompt.affinitySentences.buildPrompt(
      user1Profile,
      user2Profile
    );

    // Call ai-service chat endpoint with the complete prompt
    if (this.logger) {
      this.logger.debug(
        {
          userId1,
          userId2,
          task: 'AFFINITY_SENTENCE',
          promptLength: fullPrompt.length,
        },
        'Generating affinity sentence'
      );
    }

    try {
      const response = await this.aiServiceChatClient.generateChat({
        messages: [{ role: 'user', content: fullPrompt }],
        task: 'AFFINITY_SENTENCE', // ai-service will select model and parameters internally
      });

      // Parse and validate the response
      const sentences = this.parseAffinitySentences(response.content);

      if (this.logger) {
        this.logger.debug(
          {
            userId1,
            userId2,
            sentencesCount: sentences.length,
            rawResponseLength: response.content.length,
          },
          'Affinity sentence generated'
        );
      }

      // Simplify: if first sentence is non-empty string, return it; else return fallback
      const firstSentence = sentences[0];
      if (
        typeof firstSentence === 'string' &&
        firstSentence.trim().length > 0
      ) {
        return success(firstSentence.trim());
      }

      // If parsing resulted in no valid sentences, return fallback
      if (this.logger) {
        this.logger.warn(
          {
            userId1,
            userId2,
            parsedCount: sentences.length,
            rawResponse: response.content.substring(0, 200),
          },
          'Parsed no valid sentences, returning fallback sentence'
        );
      }
      return success(AIConfig.affinitySentencesFallback[0]);
    } catch (error) {
      // If ai-service fails, return fallback sentence (non-blocking)
      // Log error with full details for debugging
      if (this.logger) {
        this.logger.error(
          {
            userId1,
            userId2,
            error: error instanceof Error ? error.message : String(error),
            errorType: error instanceof Error ? error.constructor.name : typeof error,
            stack: error instanceof Error ? error.stack : undefined,
          },
          'Failed to generate affinity sentence, returning fallback sentence'
        );
      }
      return success(AIConfig.affinitySentencesFallback[0]);
    }
  }

  /**
   * Parses affinity sentences from LLM response
   * Handles various formats: one per line, numbered lists, bullet points
   * Returns exactly 1 sentence (as per prompt requirement)
   */
  private parseAffinitySentences(text: string): string[] {
    // Remove common prefixes and markers
    const cleaned = text
      .replace(/^\d+[.)]\s*/gm, '') // Remove numbering
      .replace(/^[-•*]\s*/gm, '') // Remove bullets
      .trim();

    // Split by newlines first
    const lines = cleaned
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return [];
    }

    const sentences: string[] = [];
    for (const line of lines) {
      // Split by periods if line is too long
      if (line.includes('.') && line.split(/\s+/).length > 15) {
        const parts = line
          .split('.')
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
          .map((p) => (p.endsWith('.') ? p : p + '.'));
        sentences.push(...parts);
      } else {
        // Ensure sentence ends with period
        const sentence =
          line.endsWith('.') || line.endsWith('!') || line.endsWith('?')
            ? line
            : line + '.';
        sentences.push(sentence);
      }
    }

    // Filter and validate: max 12 words per sentence, take exactly 1 sentence
    const validated = sentences
      .filter((s) => s.split(/\s+/).length > 0)
      .map((s) => {
        const words = s.split(/\s+/);
        if (words.length > 12) {
          return words.slice(0, 12).join(' ') + '.';
        }
        return s;
      })
      .slice(0, 1); // Take exactly 1 sentence

    return validated;
  }
}
