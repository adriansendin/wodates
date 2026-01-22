import { AIConfig, AIModelConstants } from '../ai-settings';

/**
 * AiServiceEmbeddingClient - HTTP client for ai-service embedding operations
 *
 * This is a thin HTTP client with single responsibility:
 * - Send input → Receive output
 * - NO business logic
 * - NO complex validations
 * - Basic error handling
 *
 * Used to replace direct LLM calls in UserAIProfileEmbeddingService.
 */
export interface AiServiceGenerateEmbeddingRequest {
  text: string;
}

export interface AiServiceGenerateEmbeddingResponse {
  embedding: number[];
  dimension: number;
}

export class AiServiceEmbeddingClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly logger?: any;

  constructor(baseUrl?: string, timeout?: number, logger?: any) {
    this.baseUrl = baseUrl || AIConfig.aiService.baseUrl;
    this.timeout = timeout || AIConfig.aiService.timeout;
    this.logger = logger;
  }

  /**
   * Generates a vector embedding from text
   *
   * @param request - Embedding generation request with text
   * @returns Generated embedding vector (dimension matches AIModelConstants.EMBEDDING.DIMENSION)
   * @throws Error if the HTTP request fails or AI is disabled
   */
  async generateEmbedding(
    request: AiServiceGenerateEmbeddingRequest
  ): Promise<AiServiceGenerateEmbeddingResponse> {
    // Global kill-switch: abort immediately if AI is disabled
    if (!AIConfig.enabled) {
      throw new Error('AI functionality is disabled (AI_ENABLED=false)');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      if (this.logger) {
        this.logger.debug(
          {
            baseUrl: this.baseUrl,
            textLength: request.text.length,
          },
          'Calling ai-service /embeddings/generate'
        );
      }

      const response = await fetch(`${this.baseUrl}/embeddings/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: request.text,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `ai-service /embeddings/generate returned ${response.status}: ${errorText}`
        );
      }

      const data = await response.json();

      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error(
          'ai-service /embeddings/generate returned invalid response format'
        );
      }

      // Validate embedding dimension (uses AIModelConstants.EMBEDDING.DIMENSION)
      const expectedDimension = AIModelConstants.EMBEDDING.DIMENSION;
      if (data.embedding.length !== expectedDimension) {
        throw new Error(
          `ai-service /embeddings/generate returned embedding with dimension ${data.embedding.length}, but expected ${expectedDimension}`
        );
      }

      // Validate all values are numbers
      for (let i = 0; i < data.embedding.length; i++) {
        if (
          typeof data.embedding[i] !== 'number' ||
          !Number.isFinite(data.embedding[i])
        ) {
          throw new Error(
            `ai-service /embeddings/generate returned invalid embedding value at index ${i}: expected finite number`
          );
        }
      }

      if (this.logger) {
        this.logger.debug(
          {
            dimension: data.embedding.length,
            textLength: request.text.length,
          },
          'ai-service /embeddings/generate completed successfully'
        );
      }

      return {
        embedding: data.embedding,
        dimension: data.dimension || data.embedding.length,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          throw new Error(
            `ai-service /embeddings/generate timeout after ${this.timeout}ms`
          );
        }
        throw error;
      }

      throw new Error('Unknown error calling ai-service /embeddings/generate');
    }
  }
}
