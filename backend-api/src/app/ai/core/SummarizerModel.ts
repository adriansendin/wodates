/**
 * SummarizerModel interface - for generating/updating user personality summaries
 *
 * This interface abstracts how we call models to build plain text summaries
 * of user personality, communication style, preferences, etc.
 *
 * Used asynchronously to build long-term user memory.
 */

export interface SummarizerRequest {
  /**
   * Previous summary (if exists) - for incremental updates
   * Plain text string format
   */
  previousSummary?: string;

  /**
   * New content to incorporate into the summary
   */
  newContent: {
    /**
     * Chat messages with Doc Love
     */
    docLoveChats?: Array<{
      messages: Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp: Date;
      }>;
    }>;

    /**
     * Chat messages with other users
     */
    userChats?: Array<{
      otherUserId: string;
      messages: Array<{ role: 'user'; content: string; timestamp: Date }>;
    }>;

    /**
     * Imported conversations (WhatsApp, etc.)
     */
    importedConversations?: Array<{
      source: string;
      messages: Array<{ role: 'user'; content: string; timestamp: Date }>;
    }>;
  };

  /**
   * User profile information
   */
  userProfile?: {
    name?: string;
    bio?: string;
    age?: number;
    gender?: string;
    preferences?: any;
  };
}

export interface SummarizerResponse {
  summary: string; // Plain text summary, not JSON
  provider: string;
  model?: string;
  tokensUsed?: number;
}

export interface SummarizerModel {
  /**
   * Generates or updates a user personality summary
   *
   * @param request - Content to summarize and previous summary (if any)
   * @returns Updated summary as plain text string
   */
  generateSummary(request: SummarizerRequest): Promise<SummarizerResponse>;

  /**
   * Provider name (for logging and debugging)
   */
  readonly name: string;

  /**
   * Model name being used (for logging and debugging)
   */
  readonly model: string;
}
