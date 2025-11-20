import OpenAI from 'openai';
import { EmbeddingModel, EmbeddingRequest, EmbeddingResponse } from '../EmbeddingModel';

/**
 * OpenAI implementation of EmbeddingModel
 * 
 * Uses OpenAI's embeddings API to generate vector embeddings.
 */
export class EmbeddingModelOpenAI implements EmbeddingModel {
  readonly name = 'openai';
  readonly model: string;
  readonly dimension: number;
  private readonly client: OpenAI;

  constructor(apiKey: string, model: string = 'text-embedding-3-small', dimension: number = 1536) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.dimension = dimension;
  }

  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: request.text,
      });

      const embedding = response.data[0]?.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('OpenAI returned invalid embedding format');
      }

      return {
        embedding,
        provider: this.name,
        model: this.model,
        dimension: embedding.length,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI embeddings error: ${error.message}`);
      }
      throw new Error('Unknown error calling OpenAI embeddings API');
    }
  }
}

