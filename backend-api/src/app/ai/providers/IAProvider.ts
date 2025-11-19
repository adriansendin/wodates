/**
 * Interface for AI providers (OpenAI, Gemini, etc.)
 * 
 * This interface allows us to swap AI providers without changing
 * the Doc Love service or other domain logic.
 */

export interface IAResponse {
  content: string;
  provider: string;
  model?: string;
  tokensUsed?: number;
}

export interface IAMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface IAGenerateRequest {
  userId: string;
  docLoveUserId: string;
  conversationHistory: IAMessage[];
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

export interface IAProvider {
  /**
   * Generates an AI response based on conversation context
   * 
   * @param request - Complete context of conversation and user
   * @returns Generated AI response
   */
  generateReply(request: IAGenerateRequest): Promise<IAResponse>;
  
  /**
   * Provider name (for logging and debugging)
   */
  readonly name: string;
  
  /**
   * Model name being used (for logging and debugging)
   */
  readonly model: string;
}

