/**
 * EmbeddingModel interface - for generating embeddings from text
 * 
 * This interface abstracts how we generate vector embeddings from text summaries.
 * Used for semantic search, similarity matching, and feed ranking.
 */

export interface EmbeddingRequest {
  /**
   * Text to generate embedding for (typically a user summary)
   */
  text: string;
}

export interface EmbeddingResponse {
  /**
   * Vector embedding (array of numbers)
   */
  embedding: number[];
  
  /**
   * Provider name
   */
  provider: string;
  
  /**
   * Model name used
   */
  model?: string;
  
  /**
   * Dimension of the embedding vector
   */
  dimension: number;
}

export interface EmbeddingModel {
  /**
   * Generates an embedding vector from text
   * 
   * @param request - Text to embed
   * @returns Embedding vector and metadata
   */
  generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  
  /**
   * Provider name (for logging and debugging)
   */
  readonly name: string;
  
  /**
   * Model name being used (for logging and debugging)
   */
  readonly model: string;
  
  /**
   * Dimension of embeddings produced by this model
   */
  readonly dimension: number;
}

