import { Result, success, failure } from '../../domain/Result';
import { DomainError, InternalError } from '../../domain/errors/DomainError';
import {
  IAProvider,
  IAGenerateRequest,
  IAResponse,
} from './providers/IAProvider';

/**
 * AI Service - Orchestrator for AI providers
 *
 * This service abstracts the AI provider implementation details
 * from the Doc Love domain logic.
 */
export class AIService {
  constructor(
    private provider: IAProvider,
    private logger?: any
  ) {}

  /**
   * Generates an AI reply using the configured provider
   *
   * @param request - Complete context for generating the reply
   * @returns Result containing the AI response or an error
   */
  async generateReply(
    request: IAGenerateRequest
  ): Promise<Result<IAResponse, DomainError>> {
    try {
      if (this.logger) {
        this.logger.info(
          {
            userId: request.userId,
            historyLength: request.conversationHistory.length,
            messageLength: request.lastUserMessage.length,
          },
          '5. AIService - Delegando generación a provider (Ollama)'
        );
      }

      const response = await this.provider.generateReply(request);

      if (this.logger) {
        this.logger.info(
          {
            provider: this.provider.name,
            model: response.model,
            responseLength: response.content.length,
            tokensUsed: response.tokensUsed,
          },
          '6. AIService - Respuesta recibida del provider'
        );
      }

      return success(response);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error generating AI reply';

      if (this.logger) {
        this.logger.error(
          { error: errorMessage, provider: this.provider.name },
          'Failed to generate AI reply'
        );
      }

      return failure(
        new InternalError(`Failed to generate AI reply: ${errorMessage}`, error)
      );
    }
  }

  /**
   * Gets the name of the current provider
   */
  getProviderName(): string {
    return this.provider.name;
  }

  /**
   * Gets the model name being used
   */
  getModel(): string {
    return this.provider.model;
  }
}
