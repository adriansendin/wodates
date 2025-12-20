import { ChatModel } from './ChatModel';
import { ChatModelHttp } from './providers/ChatModelHttp';
import { AIConfig } from '../ai-settings';

/**
 * Factory functions to create AI model instances
 *
 * These factories abstract provider creation and configuration.
 * Only ai-service is supported - direct LLM providers have been removed.
 */

export function createChatModel(logger?: any): ChatModel {
  const providerName = process.env.AI_PROVIDER;

  if (providerName !== 'ai-service') {
    throw new Error(
      `AI_PROVIDER must be 'ai-service'. Got: ${providerName || 'undefined'}. ` +
        'Direct LLM providers (ollama, openai) have been removed. ' +
        'All AI operations must go through ai-service HTTP API.'
    );
  }

  return new ChatModelHttp(
    AIConfig.aiService.baseUrl,
    AIConfig.aiService.timeout,
    logger
  );
}

// createSummarizerModel and createEmbeddingModel are no longer needed
// When using ai-service, these operations are handled via:
// - AiServiceProfileClient for profile generation/merging
// - AiServiceEmbeddingClient for embeddings
