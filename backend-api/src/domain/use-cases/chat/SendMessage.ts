import { Message } from '../../entities/Message';
import { Result, success, failure } from '../../Result';
import {
  DomainError,
  NotFoundError,
  ForbiddenError,
} from '../../errors/DomainError';
import { MessageRepository } from '../../repositories/MessageRepository';
import { MatchRepository } from '../../repositories/MatchRepository';

/**
 * Optional Doc Love chat service for AI responses
 * Injected from app layer to avoid circular dependencies
 */
type DocLoveChatService = {
  isDocLoveConversation(matchId: string): Promise<Result<boolean, DomainError>>;
  isDocLoveConversationWithMatch(
    matchId: string,
    match: { userId1: string; userId2: string }
  ): Promise<Result<boolean, DomainError>>;
  generateAndSaveReply(
    matchId: string,
    userId: string,
    userMessage: Message,
    locale?: string
  ): Promise<Result<Message, DomainError>>;
};

export class SendMessage {
  constructor(
    private messageRepository: MessageRepository,
    private matchRepository: MatchRepository,
    private docLoveChatService?: DocLoveChatService, // Optional: only for Doc Love conversations
    private logger?: any // Optional: logger for debugging
  ) {}

  async execute(
    matchId: string,
    senderId: string,
    content: string,
    locale?: string
  ): Promise<Result<Message, DomainError>> {
    if (this.logger) {
      this.logger.info(
        {
          matchId,
          senderId,
          contentLength: content.length,
          docLoveServiceAvailable: !!this.docLoveChatService,
        },
        'SendMessage.execute: Iniciando envío de mensaje'
      );
    }

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
        {
          matchId,
          senderId,
          messageId: savedMessage.id,
          contentLength: content.length,
        },
        '2. Mensaje del usuario guardado en base de datos'
      );
    }

    // If Doc Love chat service is available, check if this is a Doc Love conversation
    // and generate AI response if needed
    // We already have the match, so we can check directly without querying again
    if (this.docLoveChatService) {
      if (this.logger) {
        this.logger.info(
          { matchId, senderId, userId1: match.userId1, userId2: match.userId2 },
          '1. Doc Love chat service disponible - Verificando si es conversación con Doc Love'
        );
      }

      // Check if this is a Doc Love conversation using the match we already have
      const isDocLoveResult =
        await this.docLoveChatService.isDocLoveConversationWithMatch(
          matchId,
          match
        );

      if (this.logger) {
        this.logger.info(
          {
            matchId,
            senderId,
            isDocLoveConversation: isDocLoveResult.success
              ? isDocLoveResult.data
              : 'check failed',
            checkSuccess: isDocLoveResult.success,
          },
          '2. Resultado de verificación Doc Love'
        );
      }

      // Only generate AI response if:
      // 1. We successfully checked it's a Doc Love conversation
      // 2. It is indeed a Doc Love conversation
      // 3. The sender is NOT Doc Love (to avoid infinite loops)
      if (isDocLoveResult.success && isDocLoveResult.data) {
        if (this.logger) {
          this.logger.info(
            { matchId, senderId, content },
            '3. Conversación con Doc Love detectada - Iniciando generación de respuesta (asíncrona)'
          );
        }

        // Generate Doc Love reply asynchronously (fire-and-forget)
        // This allows the user's message to be sent immediately without waiting
        // for the AI response. The frontend will receive Doc Love's reply via polling.
        this.docLoveChatService
          .generateAndSaveReply(matchId, senderId, savedMessage, locale)
          .then((docLoveReplyResult) => {
            if (!docLoveReplyResult.success) {
              if (this.logger) {
                this.logger.error(
                  {
                    matchId,
                    senderId,
                    error: docLoveReplyResult.error,
                  },
                  'Failed to generate Doc Love reply (async)'
                );
              }
            } else {
              if (this.logger) {
                this.logger.info(
                  { matchId, senderId, messageId: docLoveReplyResult.data.id },
                  'Doc Love reply generated and saved successfully (async)'
                );
              }
            }
          })
          .catch((error) => {
            // Catch any unexpected errors to prevent unhandled promise rejection
            if (this.logger) {
              this.logger.error(
                {
                  matchId,
                  senderId,
                  error: error instanceof Error ? error.message : String(error),
                },
                'Unexpected error generating Doc Love reply (async)'
              );
            }
          });
        // Note: We don't return the AI message here, as the frontend
        // will receive it via polling/subscription
      } else {
        if (this.logger) {
          this.logger.info(
            {
              matchId,
              senderId,
              isDocLoveResult: isDocLoveResult.success
                ? isDocLoveResult.data
                : 'check failed',
            },
            'No es una conversación con Doc Love'
          );
        }
      }
    } else {
      if (this.logger) {
        this.logger.warn(
          { matchId, senderId },
          '⚠️ Doc Love chat service NO está disponible - AI features deshabilitadas'
        );
      }
    }

    return success(savedMessage);
  }
}

function isFailure<T, E>(
  result: Result<T, E>
): result is import('../../Result').Failure<E> {
  return !result.success;
}
