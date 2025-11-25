import { Result, success, failure } from '../../Result';
import { DomainError, InternalError } from '../../errors/DomainError';
import { MatchRepository } from '../../repositories/MatchRepository';
import { UserRepository } from '../../repositories/UserRepository';
import { GetUnprocessedMessages } from './GetUnprocessedMessages';

/**
 * Formatted message for export
 */
export interface FormattedMessage {
  timestamp: string; // Format: "DD/MM/YY, HH:MM:SS"
  senderName: string;
  content: string;
}

/**
 * Processed chat summary
 */
export interface ProcessedChatSummary {
  matchId: string;
  otherUserId: string;
  otherUserName: string;
  isDocLove: boolean;
  messages: FormattedMessage[];
  messageCount: number;
  lastMessageTimestamp?: string; // Internal use for sorting, removed before return
}

/**
 * GetAllUserChats - Gets and processes all unprocessed messages for a user's chats
 *
 * This use case:
 * 1. Gets all matches for the user
 * 2. For each match, gets unprocessed messages
 * 3. Formats messages for export
 * 4. Marks messages as processed
 * 5. Returns summaries for each chat
 */
export class GetAllUserChats {
  constructor(
    private matchRepository: MatchRepository,
    private userRepository: UserRepository,
    private getUnprocessedMessages: GetUnprocessedMessages,
    private docLoveHelper: { getDocLoveUserId(): Promise<string> },
    private logger?: any
  ) {}

  async execute(
    userId: string
  ): Promise<Result<ProcessedChatSummary[], DomainError>> {
    try {
      // Get all matches for the user
      const matchesResult = await this.matchRepository.findByUserId(userId);
      if (!matchesResult.success) {
        return failure(matchesResult.error);
      }

      const matches = matchesResult.data;

      // Get Doc Love user ID for comparison
      let docLoveId: string;
      try {
        docLoveId = await this.docLoveHelper.getDocLoveUserId();
      } catch (error) {
        if (this.logger) {
          this.logger.warn(
            { userId, error },
            'Failed to get Doc Love user ID, continuing without Doc Love detection'
          );
        }
        docLoveId = ''; // Fallback, will not match any user
      }

      // Process each match
      const processedChats: ProcessedChatSummary[] = [];

      for (const match of matches) {
        // Identify the other user in the match
        const otherUserId =
          match.userId1 === userId ? match.userId2 : match.userId1;
        const isDocLove = otherUserId === docLoveId;

        // Get unprocessed messages for this match
        const unprocessedResult = await this.getUnprocessedMessages.execute(
          match.id,
          userId
        );

        if (!unprocessedResult.success) {
          if (this.logger) {
            this.logger.error(
              { matchId: match.id, userId, error: unprocessedResult.error },
              'Failed to get unprocessed messages for match'
            );
          }
          // Continue with next match instead of failing completely
          continue;
        }

        const unprocessedMessages = unprocessedResult.data;

        // Skip if no unprocessed messages
        if (unprocessedMessages.length === 0) {
          continue;
        }

        // Get other user's name
        let otherUserName = 'Usuario';
        if (isDocLove) {
          otherUserName = 'Doc Love';
        } else {
          const userResult = await this.userRepository.findById(otherUserId);
          if (userResult.success) {
            otherUserName = userResult.data.name;
          } else {
            if (this.logger) {
              this.logger.warn(
                { otherUserId, matchId: match.id },
                'Failed to get other user name, using default'
              );
            }
          }
        }

        // Get current user's name (for messages sent by the user)
        let currentUserName = 'Usuario';
        const currentUserResult = await this.userRepository.findById(userId);
        if (currentUserResult.success) {
          currentUserName = currentUserResult.data.name;
        }

        // Format messages
        const formattedMessages: FormattedMessage[] = unprocessedMessages.map(
          (msg) => ({
            timestamp: this.formatTimestamp(msg.createdAt),
            senderName:
              msg.senderId === userId ? currentUserName : otherUserName,
            content: msg.content,
          })
        );

        // Mark messages as processed
        // COMENTADO PARA PRUEBAS - No marcar como procesados durante testing
        // const messageIds = unprocessedMessages.map((msg) => msg.id);
        // const markResult = await this.messageRepository.markManyAsProcessed(
        //   messageIds
        // );

        // if (!markResult.success) {
        //   if (this.logger) {
        //     this.logger.error(
        //       {
        //         matchId: match.id,
        //         userId,
        //         messageIds,
        //         error: markResult.error,
        //       },
        //       'Failed to mark messages as processed, but messages were already retrieved'
        //     );
        //   }
        //   // Continue anyway - messages were already retrieved and formatted
        // }

        // Store last message timestamp for sorting (before formatting)
        const lastMessage = unprocessedMessages[unprocessedMessages.length - 1];
        const lastMessageTimestamp = lastMessage
          ? lastMessage.createdAt
          : match.createdAt;

        processedChats.push({
          matchId: match.id,
          otherUserId,
          otherUserName,
          isDocLove,
          messages: formattedMessages,
          messageCount: formattedMessages.length,
          lastMessageTimestamp, // Store for sorting
        });
      }

      // Sort chats by most recent message first (by last message timestamp)
      processedChats.sort((a, b) => {
        const timestampA = a.lastMessageTimestamp ?? '';
        const timestampB = b.lastMessageTimestamp ?? '';
        return new Date(timestampB).getTime() - new Date(timestampA).getTime();
      });

      // Remove lastMessageTimestamp from final result (it was only for sorting)
      const finalChats = processedChats.map(
        ({ lastMessageTimestamp: _lastMessageTimestamp, ...rest }) => rest
      );

      return success(finalChats);
    } catch (error) {
      return failure(
        new InternalError('Unexpected error getting all user chats', error)
      );
    }
  }

  /**
   * Executes and returns formatted text output instead of structured data
   *
   * Format:
   * --- Chat con {otherUserName} ---
   *
   * [DD/MM/YY, HH:MM] {senderName}: {content}
   *
   * @param userId - The user ID to get chats for
   * @returns Result with formatted text string or error
   */
  async executeAsText(userId: string): Promise<Result<string, DomainError>> {
    const result = await this.execute(userId);

    if (!result.success) {
      return result;
    }

    const chats = result.data;

    // If no chats with unprocessed messages, return empty string
    if (chats.length === 0) {
      return success('');
    }

    // Format each chat as text
    const formattedChats = chats.map((chat) => {
      const header = `--- Chat con ${chat.otherUserName} ---\n\n`;

      const messagesText = chat.messages
        .map((msg) => {
          // Format timestamp without seconds: "[DD/MM/YY, HH:MM]"
          const timestamp = this.formatTimestampShort(msg.timestamp);
          return `${timestamp} ${msg.senderName}: ${msg.content}`;
        })
        .join('\n');

      return header + messagesText;
    });

    return success(formattedChats.join('\n\n'));
  }

  /**
   * Formats ISO timestamp to "[DD/MM/YY, HH:MM:SS]" format
   * Example: "2023-12-06T18:30:03.000Z" -> "[12/6/23, 18:30:03]"
   */
  private formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    const day = date.getDate();
    const month = date.getMonth() + 1; // getMonth() returns 0-11
    const year = date.getFullYear().toString().slice(-2); // Last 2 digits
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    return `[${day}/${month}/${year}, ${hours}:${minutes}:${seconds}]`;
  }

  /**
   * Formats timestamp string from "[DD/MM/YY, HH:MM:SS]" to "[DD/MM/YY, HH:MM]" (without seconds)
   * Example: "[12/6/23, 18:30:03]" -> "[12/6/23, 18:30]"
   */
  private formatTimestampShort(timestamp: string): string {
    // Remove seconds part: "[DD/MM/YY, HH:MM:SS]" -> "[DD/MM/YY, HH:MM]"
    // Match pattern: "HH:MM:SS]" and replace with "HH:MM]"
    return timestamp.replace(/(\d{2}:\d{2}):\d{2}\]/, '$1]');
  }
}
