import { AIConfig } from '../ai-settings';

/**
 * AiServiceChatClient - HTTP client for ai-service chat operations
 *
 * This is a thin HTTP client with single responsibility:
 * - Send input → Receive output
 * - NO business logic
 * - NO complex validations
 * - Basic error handling
 *
 * Used to replace direct LLM calls in DocLoveChatService.
 */
export interface AiServiceChatRequest {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  system?: string | undefined;
  model?: string | undefined; // Optional model override (e.g., 'gemma3:1b' for affinity sentences)
}

export interface AiServiceChatResponse {
  content: string;
}

export class AiServiceChatClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly logger?: any;

  constructor(baseUrl?: string, timeout?: number, logger?: any) {
    this.baseUrl = baseUrl || AIConfig.aiService.baseUrl;
    this.timeout = timeout || AIConfig.aiService.timeout;
    this.logger = logger;
  }

  /**
   * Generates a chat response from conversation messages
   *
   * @param request - Chat request with messages and optional system prompt
   * @returns Generated chat response
   * @throws Error if the HTTP request fails
   */
  async generateChat(
    request: AiServiceChatRequest
  ): Promise<AiServiceChatResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      if (this.logger) {
        this.logger.debug(
          {
            baseUrl: this.baseUrl,
            messagesCount: request.messages.length,
            hasSystem: !!request.system,
          },
          'Calling ai-service /chat/generate'
        );
      }

      const response = await fetch(`${this.baseUrl}/chat/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: request.messages,
          system: request.system,
          model: request.model,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `ai-service /chat/generate returned ${response.status}: ${errorText}`
        );
      }

      const data = await response.json();

      if (!data.content || typeof data.content !== 'string') {
        throw new Error(
          'ai-service /chat/generate returned invalid response format'
        );
      }

      if (this.logger) {
        this.logger.debug(
          {
            responseLength: data.content.length,
          },
          'ai-service /chat/generate completed successfully'
        );
      }

      return {
        content: data.content,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          throw new Error(
            `ai-service /chat/generate timeout after ${this.timeout}ms`
          );
        }
        throw error;
      }

      throw new Error('Unknown error calling ai-service /chat/generate');
    }
  }
}
