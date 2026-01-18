import { Result, success, failure } from '../../domain/Result';
import { DomainError, InternalError } from '../../domain/errors/DomainError';
import { MatchRepository } from '../../domain/repositories/MatchRepository';
import { LikeRepository } from '../../domain/repositories/LikeRepository';
import { MessageRepository } from '../../domain/repositories/MessageRepository';
import { DocLoveHelper } from './doc-love-helper';
import { Match } from '../../domain/entities/Match';

/**
 * Service for managing system user interactions (like Doc Love)
 *
 * Handles automatic match creation between new users and system bots.
 */
export class SystemUserService {
  constructor(
    private docLoveHelper: DocLoveHelper,
    private likeRepository: LikeRepository,
    private matchRepository: MatchRepository,
    private messageRepository?: MessageRepository
  ) {}

  /**
   * Creates a welcome match between a new user and Doc Love
   *
   * This method:
   * 1. Gets Doc Love's user ID
   * 2. Checks if match already exists (idempotent)
   * 3. Creates mutual likes (interactions)
   * 4. Creates the match and chat
   *
   * Note: This bypasses the active_chats_count check since Doc Love
   * chats don't count toward the limit.
   *
   * @param userId - The new user's ID
   * @returns The created match, or existing match if already present
   */
  async createWelcomeMatch(
    userId: string
  ): Promise<Result<Match, DomainError>> {
    try {
      // Get Doc Love's user ID
      const docLoveId = await this.docLoveHelper.getDocLoveUserId();

      // Check if match already exists (idempotent operation)
      const existsResult = await this.matchRepository.existsBetweenUsers(
        userId,
        docLoveId
      );

      if (!existsResult.success) {
        return failure(existsResult.error);
      }

      if (existsResult.data) {
        // Match already exists, get it and return
        // Find the match by getting all matches for the user and filtering
        const userMatchesResult =
          await this.matchRepository.findByUserId(userId);
        if (!userMatchesResult.success) {
          return failure(userMatchesResult.error);
        }

        const existingMatch = userMatchesResult.data.find(
          (match) =>
            (match.userId1 === userId && match.userId2 === docLoveId) ||
            (match.userId1 === docLoveId && match.userId2 === userId)
        );

        if (!existingMatch) {
          return failure(
            new InternalError('Match exists but could not be retrieved')
          );
        }

        return success(existingMatch);
      }

      // Check if user already liked Doc Love (shouldn't happen, but be safe)
      const hasLikedResult = await this.likeRepository.hasLiked(
        userId,
        docLoveId
      );
      if (!hasLikedResult.success) {
        return failure(hasLikedResult.error);
      }

      // Create like from user to Doc Love
      if (!hasLikedResult.data) {
        const userLikeResult = await this.likeRepository.create({
          userId,
          targetUserId: docLoveId,
        });

        if (!userLikeResult.success) {
          return failure(userLikeResult.error);
        }
      }

      // Check if Doc Love already liked user (shouldn't happen, but be safe)
      const docLoveHasLikedResult = await this.likeRepository.hasLiked(
        docLoveId,
        userId
      );
      if (!docLoveHasLikedResult.success) {
        return failure(docLoveHasLikedResult.error);
      }

      // Create like from Doc Love to user
      if (!docLoveHasLikedResult.data) {
        const docLoveLikeResult = await this.likeRepository.create({
          userId: docLoveId,
          targetUserId: userId,
        });

        if (!docLoveLikeResult.success) {
          return failure(docLoveLikeResult.error);
        }
      }

      // Now create the match (both users have liked each other)
      // Note: We bypass the active_chats_count check here because
      // chats with bots don't count toward the limit
      const matchResult = await this.matchRepository.create({
        userId1: userId,
        userId2: docLoveId,
      });

      if (!matchResult.success) {
        return failure(matchResult.error);
      }

      // Send welcome messages from Doc Love (static messages, not AI-generated)
      // Split into 5 separate chat bubbles
      if (this.messageRepository) {
        const welcomeMessages = [
          "Hi — I'm Doc Love.",
          'Wodates learns from conversation to show you a better fit over time. Wodates is built for intentional dating — real compatibility, not noise.',
          "That's why you can only have one active chat with a human at a time.",
          "In Discover (where you'll see new people and your shared compatibility highlights), it's available when you're not in a chat — it pauses while you're matched.",
          'Ready?',
        ];

        // Create each message sequentially
        for (const content of welcomeMessages) {
          const welcomeMessageResult = await this.messageRepository.create({
            matchId: matchResult.data.id,
            senderId: docLoveId,
            content,
          });

          // Log error but don't fail the match creation if message fails
          if (!welcomeMessageResult.success) {
            console.error(
              '[SystemUserService] Failed to send welcome message:',
              welcomeMessageResult.error
            );
          }
        }
      }

      return success(matchResult.data);
    } catch (error) {
      if (error instanceof DomainError) {
        return failure(error);
      }

      return failure(
        new InternalError('Unexpected error creating welcome match', error)
      );
    }
  }
}
