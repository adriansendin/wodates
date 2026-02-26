import { GenerateUserProfileFromChats } from '../../domain/use-cases/chat/GenerateUserProfileFromChats';
import { UserAIProfileRepository } from '../../domain/repositories/UserAIProfileRepository';
import { UserAIProfileEmbeddingService } from '../ai/profile/UserAIProfileEmbeddingService';
import { UserBioGenerationService } from '../ai/profile/UserBioGenerationService';
import { DomainError } from '../../domain/errors/DomainError';

export type ProcessUserProfileResult =
  | { success: true; summary: string; message: string }
  | { success: true; skipped: true; message: string }
  | { success: false; error: DomainError };

/**
 * Runs the full "process one user" pipeline: profile from chats, embedding, bio.
 * Used by the API (Build my profile) and mirrors the nightly job logic for a single user.
 */
export class ProcessUserProfileService {
  constructor(
    private readonly generateUserProfile: GenerateUserProfileFromChats,
    private readonly userAIProfileRepository: UserAIProfileRepository,
    private readonly embeddingService: UserAIProfileEmbeddingService,
    private readonly bioService: UserBioGenerationService,
    private readonly logger?: { info: (msg: string) => void; warn: (msg: string) => void }
  ) {}

  async run(userId: string): Promise<ProcessUserProfileResult> {
    const profileBeforeResult = await this.userAIProfileRepository.findByUserId(userId);
    const summaryBefore =
      profileBeforeResult.success && profileBeforeResult.data
        ? profileBeforeResult.data.summary?.trim() ?? null
        : null;

    const result = await this.generateUserProfile.execute(userId);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    if (result.data === 'No unprocessed chats to analyze') {
      return {
        success: true,
        skipped: true,
        message: result.data,
      };
    }

    const profileAfterResult = await this.userAIProfileRepository.findByUserId(userId);
    const summaryAfter =
      profileAfterResult.success && profileAfterResult.data
        ? profileAfterResult.data.summary?.trim() ?? null
        : null;

    const summaryChanged = summaryBefore !== summaryAfter;
    const hasSummary = summaryAfter !== null && summaryAfter.length > 0;

    if (hasSummary && summaryChanged) {
      try {
        await this.embeddingService.generateEmbeddingFromSummary(userId);
        this.logger?.info?.(`Embedding generated for user ${userId}`);
      } catch (err) {
        this.logger?.warn?.(
          `Embedding generation failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    if (hasSummary) {
      try {
        await this.bioService.generateBioFromSummary(userId);
        this.logger?.info?.(`Bio generated for user ${userId}`);
      } catch (err) {
        this.logger?.warn?.(
          `Bio generation failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return {
      success: true,
      summary: result.data,
      message: 'Profile generated successfully',
    };
  }
}
