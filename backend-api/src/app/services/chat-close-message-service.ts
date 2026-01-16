import { Result, success } from '../../domain/Result';
import { DomainError } from '../../domain/errors/DomainError';
import { MatchRepository } from '../../domain/repositories/MatchRepository';
import { MessageRepository } from '../../domain/repositories/MessageRepository';
import { DocLoveHelper } from './doc-love-helper';

/**
 * Message pools for chat close events
 */
const SELF_CLOSE_MESSAGES = [
  "Got it — that chat is now closed for both of you, for good. Discover is there whenever you're ready.",
  "Understood. That chat is closed for both of you, for good. You're back on Discover whenever you want.",
  "All set — that chat is now closed for both of you, for good. Discover is available when you're ready.",
  "Okay — that chat is closed for both of you, for good. Come back to Discover whenever you feel like it.",
  "Done. That chat is closed for both of you, for good. Discover is open again whenever you're ready.",
  "Closed — that chat is over for both of you, for good. Back to Discover.",
  "Done. That chat is closed for both of you, for good. Discover is back.",
  "Confirmed: that chat has ended for both of you, for good. Discover is live again.",
  "That chat is closed for both of you, for good. You're back on Discover.",
  "That's closed — for good. Back on Discover whenever you want.",
];

const OTHER_CLOSE_MESSAGES = [
  "That chat has ended, for good. Discover is there whenever you're ready to return.",
  "That chat is now closed for both of you, for good. Discover is available whenever you want.",
  "That chat has ended, for good. You're back on Discover whenever you feel like it.",
  "That chat is closed for both of you, for good. Whenever you're ready, Discover is there for you.",
  "That chat is closed now, for good. Take a moment — then head back to Discover when you want.",
  "That chat ended — for good. Back on Discover.",
  "Chat closed — for good. Discover is back.",
  "That match chat is over — for good. Discover is live again.",
  "That chat is closed for both — for good. Back to Discover.",
  "That's a wrap — for good. You're back on Discover.",
];


/**
 * Service for sending Doc Love system messages when human chats are closed
 */
export class ChatCloseMessageService {
  constructor(
    private docLoveHelper: DocLoveHelper,
    private matchRepository: MatchRepository,
    private messageRepository: MessageRepository,
    private logger?: any
  ) {}

  /**
   * Sends close messages to both users' Doc Love chats
   * 
   * @param blockerId - User who closed the chat
   * @param blockedId - User who was blocked
   * @param closedMatchId - The match/chat that was closed
   */
  async sendCloseMessages(
    blockerId: string,
    blockedId: string,
    closedMatchId: string
  ): Promise<void> {
    try {
      // Send SELF_CLOSE message to the blocker
      await this.sendCloseMessage(
        blockerId,
        closedMatchId,
        'SELF_CLOSE'
      );

      // Send OTHER_CLOSE message to the blocked user
      await this.sendCloseMessage(
        blockedId,
        closedMatchId,
        'OTHER_CLOSE'
      );
    } catch (error) {
      // Log error but don't throw - this is a fire-and-forget operation
      if (this.logger) {
        this.logger.error(
          {
            blockerId,
            blockedId,
            closedMatchId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to send chat close messages'
        );
      }
    }
  }

  /**
   * Sends a close message to a user's Doc Love chat
   */
  private async sendCloseMessage(
    userId: string,
    closedMatchId: string,
    messageType: 'SELF_CLOSE' | 'OTHER_CLOSE'
  ): Promise<void> {
    try {
      // Get Doc Love's user ID
      const docLoveId = await this.docLoveHelper.getDocLoveUserId();

      // Get the user's Doc Love match
      const docLoveMatchResult = await this.getDocLoveMatchForUser(userId, docLoveId);
      if (!docLoveMatchResult.success || !docLoveMatchResult.data) {
        if (this.logger) {
          this.logger.warn(
            { userId, closedMatchId, messageType },
            'User does not have a Doc Love match, skipping close message'
          );
        }
        return;
      }

      const docLoveMatchId = docLoveMatchResult.data.id;

      // Select random message from appropriate pool
      const messagePool =
        messageType === 'SELF_CLOSE' ? SELF_CLOSE_MESSAGES : OTHER_CLOSE_MESSAGES;
      const messageContent = this.selectRandomMessage(messagePool);

      // Send message from Doc Love to the user
      const messageResult = await this.messageRepository.create({
        matchId: docLoveMatchId,
        senderId: docLoveId,
        content: messageContent,
      });

      if (!messageResult.success) {
        if (this.logger) {
          this.logger.error(
            {
              userId,
              closedMatchId,
              docLoveMatchId,
              messageType,
              error: messageResult.error,
            },
            'Failed to create close message'
          );
        }
        return;
      }

      if (this.logger) {
        this.logger.info(
          {
            userId,
            closedMatchId,
            docLoveMatchId,
            messageType,
            messageId: messageResult.data.id,
          },
          'Chat close message sent successfully'
        );
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(
          {
            userId,
            closedMatchId,
            messageType,
            error: error instanceof Error ? error.message : String(error),
          },
          'Unexpected error sending close message'
        );
      }
      // Don't throw - this is a fire-and-forget operation
    }
  }

  /**
   * Gets the Doc Love match for a user
   */
  private async getDocLoveMatchForUser(
    userId: string,
    docLoveId: string
  ): Promise<Result<{ id: string } | null, DomainError>> {
    const matchResult = await this.matchRepository.getMatchBetween(
      userId,
      docLoveId
    );
    if (!matchResult.success) {
      return matchResult;
    }
    return success(matchResult.data ? { id: matchResult.data.id } : null);
  }

  /**
   * Selects a random message from the pool
   */
  private selectRandomMessage(pool: readonly string[]): string {
    if (pool.length === 0) {
      throw new Error('Message pool is empty');
    }
    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex]!;
  }
}
