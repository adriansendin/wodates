import { AIConfig } from '../ai-settings';

/**
 * AiServiceProfileClient - HTTP client for ai-service profile operations
 *
 * This is a thin HTTP client with single responsibility:
 * - Send input → Receive output
 * - NO business logic
 * - NO complex validations
 * - Basic error handling
 *
 * Used to replace direct LLM calls in GenerateUserProfileFromChats.
 */
export interface AiServiceGenerateProfileRequest {
  conversations: Array<{
    role: 'user' | 'assistant';
    content: string;
    sender: string; // Sender identifier (with '(MAIN)' marker if applicable)
  }>;
  main_user_marker?: string; // Default: "(MAIN)"
}

export interface AiServiceGenerateProfileResponse {
  profile: string;
}

export interface AiServiceMergeProfilesRequest {
  consolidated_profile: string;
  incremental_profile: string;
}

export interface AiServiceMergeProfilesResponse {
  merged_profile: string;
}

export class AiServiceProfileClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly logger?: any;

  constructor(baseUrl?: string, timeout?: number, logger?: any) {
    this.baseUrl = baseUrl || AIConfig.aiService.baseUrl;
    this.timeout = timeout || AIConfig.aiService.timeout;
    this.logger = logger;
  }

  /**
   * Generates a profile summary from conversation messages
   *
   * @param request - Profile generation request with conversations
   * @returns Generated profile summary
   * @throws Error if the HTTP request fails
   */
  async generateProfile(
    request: AiServiceGenerateProfileRequest
  ): Promise<AiServiceGenerateProfileResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      if (this.logger) {
        this.logger.debug(
          {
            baseUrl: this.baseUrl,
            conversationsCount: request.conversations.length,
            mainUserMarker: request.main_user_marker || '(MAIN)',
          },
          'Calling ai-service /profile/generate'
        );
      }

      const response = await fetch(`${this.baseUrl}/profile/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversations: request.conversations,
          main_user_marker: request.main_user_marker || '(MAIN)',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `ai-service /profile/generate returned ${response.status}: ${errorText}`
        );
      }

      const data = await response.json();

      if (!data.profile || typeof data.profile !== 'string') {
        throw new Error(
          'ai-service /profile/generate returned invalid response format'
        );
      }

      if (this.logger) {
        this.logger.debug(
          {
            profileLength: data.profile.length,
          },
          'ai-service /profile/generate completed successfully'
        );
      }

      return {
        profile: data.profile,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          throw new Error(
            `ai-service /profile/generate timeout after ${this.timeout}ms`
          );
        }
        throw error;
      }

      throw new Error('Unknown error calling ai-service /profile/generate');
    }
  }

  /**
   * Merges two profile summaries into a single consolidated profile
   *
   * @param request - Merge request with consolidated and incremental profiles
   * @returns Merged profile summary
   * @throws Error if the HTTP request fails
   */
  async mergeProfiles(
    request: AiServiceMergeProfilesRequest
  ): Promise<AiServiceMergeProfilesResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      if (this.logger) {
        this.logger.debug(
          {
            baseUrl: this.baseUrl,
            consolidatedLength: request.consolidated_profile.length,
            incrementalLength: request.incremental_profile.length,
          },
          'Calling ai-service /profile/merge'
        );
      }

      const response = await fetch(`${this.baseUrl}/profile/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consolidated_profile: request.consolidated_profile,
          incremental_profile: request.incremental_profile,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `ai-service /profile/merge returned ${response.status}: ${errorText}`
        );
      }

      const data = await response.json();

      if (!data.merged_profile || typeof data.merged_profile !== 'string') {
        throw new Error(
          'ai-service /profile/merge returned invalid response format'
        );
      }

      if (this.logger) {
        this.logger.debug(
          {
            mergedProfileLength: data.merged_profile.length,
          },
          'ai-service /profile/merge completed successfully'
        );
      }

      return {
        merged_profile: data.merged_profile,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          throw new Error(
            `ai-service /profile/merge timeout after ${this.timeout}ms`
          );
        }
        throw error;
      }

      throw new Error('Unknown error calling ai-service /profile/merge');
    }
  }
}
