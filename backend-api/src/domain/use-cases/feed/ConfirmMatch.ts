import { Match } from '../../entities/Match';
import { Result, success, failure } from '../../Result';
import {
  DomainError,
  ConflictError,
  ForbiddenError,
} from '../../errors/DomainError';
import { LikeRepository } from '../../repositories/LikeRepository';
import { MatchRepository } from '../../repositories/MatchRepository';
import { UserRepository } from '../../repositories/UserRepository';
import { AffinitySentenceGenerator } from '../../services/AffinitySentenceGenerator';

export class ConfirmMatch {
  constructor(
    private likeRepository: LikeRepository,
    private matchRepository: MatchRepository,
    private affinitySentenceGenerator?: AffinitySentenceGenerator,
    private userRepository?: UserRepository
  ) {}

  async execute(
    userId: string,
    targetUserId: string
  ): Promise<Result<Match, DomainError>> {
    // Verify that both users have liked each other
    const userLikedTarget = await this.likeRepository.hasLiked(
      userId,
      targetUserId
    );
    if (isFailure(userLikedTarget) || !userLikedTarget.data) {
      return failure(
        new ForbiddenError('You must like the user before confirming a match')
      );
    }

    const targetLikedUser = await this.likeRepository.hasLiked(
      targetUserId,
      userId
    );
    if (isFailure(targetLikedUser) || !targetLikedUser.data) {
      return failure(
        new ForbiddenError(
          'The other user must also like you to create a match'
        )
      );
    }

    // Check if match already exists
    const existingMatchResult = await this.matchRepository.getMatchBetween(
      userId,
      targetUserId
    );
    if (isFailure(existingMatchResult)) {
      return failure(existingMatchResult.error);
    }
    if (existingMatchResult.data) {
      return success(existingMatchResult.data);
    }

    // Check if both users have no active chats before creating match
    const activeChatsCounts = await this.matchRepository.getActiveChatsCount([
      userId,
      targetUserId,
    ]);

    const userActiveChats = activeChatsCounts.get(userId) ?? 0;
    const targetUserActiveChats = activeChatsCounts.get(targetUserId) ?? 0;

    if (userActiveChats >= 1) {
      return failure(
        new ConflictError(
          'You have reached the maximum number of active chats (0)'
        )
      );
    }

    if (targetUserActiveChats >= 1) {
      return failure(
        new ConflictError(
          'This user has reached the maximum number of active chats (0)'
        )
      );
    }

    // Create match
    const matchResult = await this.matchRepository.create({
      userId1: userId,
      userId2: targetUserId,
    });

    if (isFailure(matchResult)) {
      return failure(matchResult.error);
    }

    const match = matchResult.data;

    // Generate and store affinity sentence asynchronously (non-blocking)
    // If generation fails, we still proceed with match creation
    if (this.affinitySentenceGenerator) {
      this.generateAndStoreAffinitySentence(
        match.id,
        userId,
        targetUserId
      ).catch((error) => {
        // Log error but don't fail match creation
        console.error(
          `Failed to generate affinity sentence for chat ${match.id}:`,
          error instanceof Error ? error.message : String(error)
        );
      });
    }

    return success(match);
  }

  /**
   * Resolves the locale to use for the affinity sentence based on both users' preferences.
   * Both ES → 'es'; both EN → 'en'; mixed → 'en'.
   */
  private async resolveMatchLocale(
    userId1: string,
    userId2: string
  ): Promise<string> {
    if (!this.userRepository) return 'en';
    try {
      const [u1, u2] = await Promise.all([
        this.userRepository.findById(userId1),
        this.userRepository.findById(userId2),
      ]);
      const locale1 = (u1.success && u1.data.appLocale) || 'en';
      const locale2 = (u2.success && u2.data.appLocale) || 'en';
      return locale1 === 'es' && locale2 === 'es' ? 'es' : 'en';
    } catch {
      return 'en';
    }
  }

  /**
   * Generates and stores affinity sentence for a chat (non-blocking)
   * Called asynchronously after match creation
   */
  private async generateAndStoreAffinitySentence(
    chatId: string,
    userId1: string,
    userId2: string
  ): Promise<void> {
    if (!this.affinitySentenceGenerator) {
      return;
    }

    const locale = await this.resolveMatchLocale(userId1, userId2);
    const fallback =
      locale === 'es'
        ? 'La afinidad inicial es baja—la conversación afinará las recomendaciones.'
        : 'Initial affinity is low—conversation will refine the recommendations.';

    try {
      const result =
        await this.affinitySentenceGenerator.generateAffinitySentence(
          userId1,
          userId2,
          locale
        );

      const sentence = result.success ? result.data : fallback;

      const updateResult = await this.matchRepository.updateAffinitySentence(
        chatId,
        sentence
      );
      if (!updateResult.success) {
        console.error(
          `Failed to store affinity sentence for chat ${chatId}:`,
          updateResult.error.message
        );
      }
    } catch (error) {
      try {
        await this.matchRepository.updateAffinitySentence(chatId, fallback);
      } catch (updateError) {
        console.error(
          `Failed to store fallback affinity sentence for chat ${chatId}:`,
          updateError instanceof Error
            ? updateError.message
            : String(updateError)
        );
      }
    }
  }
}

function isFailure<T, E>(
  result: Result<T, E>
): result is import('../../Result').Failure<E> {
  return !result.success;
}
