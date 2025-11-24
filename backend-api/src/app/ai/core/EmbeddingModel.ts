/**
 * EmbeddingModel interface - for generating embeddings from text
 *
 * This interface abstracts how we generate vector embeddings from text summaries.
 *
 * **Purpose:**
 * - Generates 768-dimensional vector embeddings from user personality summaries
 * - Designed for storage in `user_ai_profiles.summary_embedding` (vector(768) column)
 * - Used by UserAIProfileEmbeddingService to convert text summaries into numerical representations
 *
 * **Usage:**
 * - This is a low-level AI model interface, not meant for direct use by HTTP controllers
 * - Intended for use by:
 *   - UserAIProfileEmbeddingService: Generates embeddings from existing summaries in user_ai_profiles table
 *   - Matching services: Semantic similarity calculations
 *   - Feed ranking services: User preference matching
 *
 * **Implementation:**
 * - Default implementation uses Ollama with yxchia/multilingual-e5-base model
 * - Produces 768-dimensional vectors compatible with pgvector vector(768) type
 * - Database-agnostic: only generates embeddings, does not interact with database
 */

export interface EmbeddingRequest {
  /**
   * Text to generate embedding for (typically a user personality summary)
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
