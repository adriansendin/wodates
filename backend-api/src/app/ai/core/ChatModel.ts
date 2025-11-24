/**
 * ChatModel interface - for real-time conversational AI (Doc Love chat)
 *
 * This interface abstracts how we call chat models for online conversations.
 * Implementations may use OpenAI, Ollama, or other providers.
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  userId: string;
  docLoveUserId: string;
  conversationHistory: ChatMessage[];
  lastUserMessage: string;
  userContext?: {
    name?: string;
    bio?: string;
    preferences?: any;
  };
  activeMatches?: Array<{
    matchId: string;
    otherUserName: string;
    lastMessage?: string;
  }>;
}

export interface ChatResponse {
  content: string;
  provider: string;
  model?: string;
  tokensUsed?: number;
}

export interface ChatModel {
  /**
   * Generates a chat response based on conversation context
   *
   * @param request - Complete context of conversation and user
   * @returns Generated chat response
   */
  generateChat(request: ChatRequest): Promise<ChatResponse>;

  /**
   * Provider name (for logging and debugging)
   */
  readonly name: string;

  /**
   * Model name being used (for logging and debugging)
   */
  readonly model: string;
}
