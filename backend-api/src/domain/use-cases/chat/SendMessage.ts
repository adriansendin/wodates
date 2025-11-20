import { Message } from '../../entities/Message';
import { Result, success, failure } from '../../Result';
import { DomainError, NotFoundError, ForbiddenError } from '../../errors/DomainError';
import { MessageRepository } from '../../repositories/MessageRepository';
import { MatchRepository } from '../../repositories/MatchRepository';

/**
 * Optional Doc Love chat service for AI responses
 * Injected from app layer to avoid circular dependencies
 */
type DocLoveChatService = {
  isDocLoveConversation(matchId: string): Promise<Result<boolean, DomainError>>;
  generateAndSaveReply(
    matchId: string,
    userId: string,
    userMessage: Message,
  ): Promise<Result<Message, DomainError>>;
};

export class SendMessage {
  constructor(
    private messageRepository: MessageRepository,
    private matchRepository: MatchRepository,
    private docLoveChatService?: DocLoveChatService, // Optional: only for Doc Love conversations
    private logger?: any, // Optional: logger for debugging
  ) {}

  async execute(
    matchId: string,
    senderId: string,
    content: string
  ): Promise<Result<Message, DomainError>> {
    // Verify match exists and user is part of it
    const matchResult = await this.matchRepository.findById(matchId);
    if (isFailure(matchResult)) {
      return failure(new NotFoundError('Match not found'));
    }

    const match = matchResult.data;
    if (match.userId1 !== senderId && match.userId2 !== senderId) {
      return failure(new ForbiddenError('User is not part of this match'));
    }

    // Create message
    const messageResult = await this.messageRepository.create({
      matchId,
      senderId,
      content,
    });

    if (isFailure(messageResult)) {
      return messageResult;
    }

    const savedMessage = messageResult.data;

    if (this.logger) {
      this.logger.info(
        { matchId, senderId, messageId: savedMessage.id, contentLength: content.length },
        '2. Mensaje del usuario guardado en base de datos',
      );
    }

    // If Doc Love chat service is available, check if this is a Doc Love conversation
    // and generate AI response if needed
    if (this.docLoveChatService) {
      if (this.logger) {
        this.logger.debug({ matchId, senderId }, 'Verificando si es conversación con Doc Love');
      }

      const isDocLoveResult = await this.docLoveChatService.isDocLoveConversation(
        matchId,
      );

      // Only generate AI response if:
      // 1. We successfully checked it's a Doc Love conversation
      // 2. It is indeed a Doc Love conversation
      // 3. The sender is NOT Doc Love (to avoid infinite loops)
      if (isDocLoveResult.success && isDocLoveResult.data) {
        if (this.logger) {
          this.logger.info(
            { matchId, senderId, content },
            '3. Conversación con Doc Love detectada - Iniciando generación de respuesta',
          );
        }

        const docLoveReplyResult =
          await this.docLoveChatService.generateAndSaveReply(
            matchId,
            senderId,
            savedMessage,
          );

        // Log error but don't fail the original message send
        if (!docLoveReplyResult.success) {
          if (this.logger) {
            this.logger.error(
              {
                matchId,
                senderId,
                error: docLoveReplyResult.error,
              },
              'Failed to generate Doc Love reply',
            );
          }
        } else {
          if (this.logger) {
            this.logger.info({ matchId, senderId }, 'Doc Love reply generated and saved successfully');
          }
        }
        // Note: We don't return the AI message here, as the frontend
        // will receive it via polling/subscription
      } else {
        if (this.logger) {
          this.logger.debug(
            {
              matchId,
              senderId,
              isDocLoveResult: isDocLoveResult.success ? isDocLoveResult.data : 'check failed',
            },
            'Not a Doc Love conversation',
          );
        }
      }
    } else {
      if (this.logger) {
        this.logger.warn({ matchId, senderId }, 'Doc Love chat service is not available');
      }
    }

    return success(savedMessage);
  }
}

function isFailure<T, E>(result: Result<T, E>): result is import('../../Result').Failure<E> {
  return !result.success;
}
