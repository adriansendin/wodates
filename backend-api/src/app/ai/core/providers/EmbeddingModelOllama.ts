import {
  EmbeddingModel,
  EmbeddingRequest,
  EmbeddingResponse,
} from '../EmbeddingModel';

/**
 * Ollama implementation of EmbeddingModel
 *
 * Uses Ollama's embeddings API (http://localhost:11434/api/embeddings) to generate vector embeddings.
 *
 * Designed for use with yxchia/multilingual-e5-base model, which produces 768-dimensional vectors
 * suitable for storage in user_ai_profiles.summary_embedding (vector(768) column).
 *
 * This implementation is agnostic of database details - it only generates embeddings from text.
 * The embedding vectors are intended to be used by UserAIProfileEmbeddingService and matching services,
 * not directly by HTTP controllers.
 *
 * Dimension validation: The constructor validates that the provided dimension matches the expected
 * dimension for the model. The generateEmbedding method also validates that the returned embedding
 * matches the expected dimension exactly.
 */
export class EmbeddingModelOllama implements EmbeddingModel {
  readonly name = 'ollama';
  readonly model: string;
  readonly dimension: number;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly logger?: any;

  constructor(
    model: string,
    dimension: number = 768, // Default dimension for multilingual-e5-base (must match AIModelConstants.EMBEDDING.DIMENSION)
    baseUrl?: string,
    timeout?: number,
    logger?: any
  ) {
    if (!model || model.trim().length === 0) {
      throw new Error('Embedding model name is required');
    }
    if (dimension <= 0) {
      throw new Error('Embedding dimension must be positive');
    }

    this.model = model;
    this.dimension = dimension;
    this.baseUrl = baseUrl || 'http://localhost:11434';
    this.timeout = timeout || 30000;
    this.logger = logger;
  }

  async generateEmbedding(
    request: EmbeddingRequest
  ): Promise<EmbeddingResponse> {
    // Validate input
    if (!request.text || typeof request.text !== 'string') {
      throw new Error('Text input is required and must be a string');
    }

    if (this.logger) {
      this.logger.debug(
        {
          model: this.model,
          baseUrl: this.baseUrl,
          textLength: request.text.length,
          expectedDimension: this.dimension,
        },
        'Generating embedding with Ollama'
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Build request payload
      const requestBody = this.buildRequestPayload(request.text);

      // Make HTTP call
      const response = await this.callOllamaAPI(requestBody, controller);

      // Parse and validate response
      const embedding = await this.parseAndValidateResponse(response);

      clearTimeout(timeoutId);

      if (this.logger) {
        this.logger.debug(
          {
            model: this.model,
            dimension: embedding.length,
            textLength: request.text.length,
          },
          'Embedding generated successfully'
        );
      }

      return {
        embedding,
        provider: this.name,
        model: this.model,
        dimension: embedding.length,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      return this.handleError(error);
    }
  }

  /**
   * Builds the request payload for Ollama embeddings API
   *
   * For multilingual-e5-base model, adds the "passage:" prefix as required by E5 models
   * for asymmetric tasks (passage retrieval/document embedding).
   */
  private buildRequestPayload(text: string): { model: string; prompt: string } {
    return {
      model: this.model,
      prompt: `passage: ${text}`,
    };
  }

  /**
   * Makes HTTP call to Ollama embeddings API
   */
  private async callOllamaAPI(
    requestBody: { model: string; prompt: string },
    controller: AbortController
  ): Promise<Response> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Ollama embeddings API returned ${response.status} ${response.statusText}: ${errorText}`
        );
      }

      return response;
    } catch (error) {
      if (error instanceof Error) {
        // Re-throw HTTP errors as-is
        if (error.message.includes('Ollama embeddings API returned')) {
          throw error;
        }
        // Handle network errors
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          throw new Error(
            `Ollama embeddings API timeout after ${this.timeout}ms. Is Ollama running at ${this.baseUrl}?`
          );
        }
        // Handle fetch errors (network issues, DNS, etc.)
        throw new Error(
          `Failed to connect to Ollama at ${this.baseUrl}: ${error.message}`
        );
      }
      throw new Error('Unknown network error calling Ollama embeddings API');
    }
  }

  /**
   * Parses and validates the response from Ollama
   */
  private async parseAndValidateResponse(
    response: Response
  ): Promise<number[]> {
    let data: any;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error('Ollama returned invalid JSON response');
    }

    // Validate response structure
    if (!data || typeof data !== 'object') {
      throw new Error(
        'Ollama returned invalid response format: expected object'
      );
    }

    if (!data.embedding) {
      throw new Error('Ollama response missing embedding field');
    }

    if (!Array.isArray(data.embedding)) {
      throw new Error(
        'Ollama returned invalid embedding format: expected array'
      );
    }

    const embedding = data.embedding as number[];

    // Validate embedding values are numbers
    for (let i = 0; i < embedding.length; i++) {
      if (typeof embedding[i] !== 'number' || !Number.isFinite(embedding[i])) {
        throw new Error(
          `Ollama returned invalid embedding value at index ${i}: expected finite number`
        );
      }
    }

    // Strict validation: must match expected dimension exactly
    if (embedding.length !== this.dimension) {
      throw new Error(
        `Ollama returned embedding with dimension ${embedding.length}, but expected ${this.dimension}. ` +
          `Model ${this.model} should produce ${this.dimension}-dimensional vectors.`
      );
    }

    return embedding;
  }

  /**
   * Handles errors and wraps them with context
   */
  private handleError(error: unknown): never {
    if (error instanceof Error) {
      // Already formatted errors from our methods
      if (
        error.message.includes('Ollama') ||
        error.message.includes('timeout') ||
        error.message.includes('dimension')
      ) {
        throw error;
      }
      // Wrap unexpected errors
      throw new Error(`Ollama embeddings error: ${error.message}`);
    }
    throw new Error('Unknown error calling Ollama embeddings API');
  }
}
