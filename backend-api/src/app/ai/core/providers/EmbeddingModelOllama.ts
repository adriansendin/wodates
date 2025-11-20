import { EmbeddingModel, EmbeddingRequest, EmbeddingResponse } from '../EmbeddingModel';

/**
 * Ollama implementation of EmbeddingModel
 * 
 * Uses Ollama's embeddings API to generate vector embeddings.
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
    dimension: number = 768, // Default dimension for Ollama embeddings
    baseUrl?: string,
    timeout?: number,
    logger?: any,
  ) {
    this.model = model;
    this.dimension = dimension;
    this.baseUrl = baseUrl || 'http://localhost:11434';
    this.timeout = timeout || 30000;
    this.logger = logger;
  }

  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    try {
      if (this.logger) {
        this.logger.debug(
          {
            model: this.model,
            textLength: request.text.length,
          },
          'Generating embedding with Ollama',
        );
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(`${this.baseUrl}/api/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            prompt: request.text,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          clearTimeout(timeoutId);
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`Ollama embeddings API returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        clearTimeout(timeoutId);

        if (!data.embedding || !Array.isArray(data.embedding)) {
          throw new Error('Ollama returned invalid embedding format');
        }

        const embedding = data.embedding as number[];

        if (this.logger) {
          this.logger.debug(
            {
              model: this.model,
              dimension: embedding.length,
            },
            'Embedding generated successfully',
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
        throw error;
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          throw new Error(`Ollama embeddings API timeout after ${this.timeout}ms`);
        }
        throw new Error(`Ollama embeddings error: ${error.message}`);
      }
      throw new Error('Unknown error calling Ollama embeddings API');
    }
  }
}

