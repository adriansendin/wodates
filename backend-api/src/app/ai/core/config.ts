import { ChatModel } from './ChatModel';
import { SummarizerModel } from './SummarizerModel';
import { EmbeddingModel } from './EmbeddingModel';
import { ChatModelOllama } from './providers/ChatModelOllama';
import { ChatModelOpenAI } from './providers/ChatModelOpenAI';
import { SummarizerModelOllama } from './providers/SummarizerModelOllama';
import { EmbeddingModelOllama } from './providers/EmbeddingModelOllama';
import { EmbeddingModelOpenAI } from './providers/EmbeddingModelOpenAI';
import { AIConfig } from '../ai-settings';

/**
 * Factory functions to create AI model instances
 *
 * These factories abstract provider creation and configuration.
 */

export function createChatModel(logger?: any): ChatModel {
  const providerName = process.env.AI_PROVIDER || AIConfig.defaultProvider;

  switch (providerName) {
    case 'ollama': {
      return new ChatModelOllama(
        AIConfig.ollama.model,
        AIConfig.ollama.baseUrl,
        AIConfig.ollama.timeout,
        AIConfig.ollama.parameters,
        logger
      );
    }

    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai');
      }
      return new ChatModelOpenAI(apiKey, AIConfig.openai.model);
    }

    default:
      throw new Error(
        `Unknown AI provider: ${providerName}. Supported providers: ollama, openai`
      );
  }
}

export function createSummarizerModel(logger?: any): SummarizerModel {
  const providerName = process.env.AI_PROVIDER || AIConfig.defaultProvider;

  switch (providerName) {
    case 'ollama': {
      // Use same model but with different parameters optimized for summarization
      return new SummarizerModelOllama(
        AIConfig.ollama.model,
        AIConfig.ollama.baseUrl,
        AIConfig.ollama.timeout * 2, // Longer timeout for summarization
        {
          ...AIConfig.ollama.parameters,
          num_predict: AIConfig.ollama.parameters.num_predict || 1000,
          num_ctx: AIConfig.ollama.parameters.num_ctx || 2048,
        },
        logger
      );
    }

    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai');
      }
      // For now, use chat model for summarization (can be refactored later)
      // TODO: Add SummarizerModelOpenAI if needed
      throw new Error(
        'OpenAI summarizer not yet implemented. Use ollama for now.'
      );
    }

    default:
      throw new Error(
        `Unknown AI provider: ${providerName}. Supported providers: ollama, openai`
      );
  }
}

export function createEmbeddingModel(logger?: any): EmbeddingModel {
  const providerName = process.env.AI_PROVIDER || AIConfig.defaultProvider;

  switch (providerName) {
    case 'ollama': {
      // Use dedicated embeddings configuration (separate from chat model)
      // Uses AIModelConstants.EMBEDDING.DEFAULT_MODEL (yxchia/multilingual-e5-base)
      // and AIModelConstants.EMBEDDING.DIMENSION (768) from ai-settings.ts
      // Override via OLLAMA_EMBEDDING_MODEL in .env if needed
      return new EmbeddingModelOllama(
        AIConfig.ollama.embeddings.model,
        AIConfig.ollama.embeddings.dimension,
        AIConfig.ollama.baseUrl,
        AIConfig.ollama.embeddings.timeout,
        logger
      );
    }

    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai');
      }
      const embeddingModel =
        process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
      const dimension = process.env.OPENAI_EMBEDDING_DIMENSION
        ? parseInt(process.env.OPENAI_EMBEDDING_DIMENSION, 10)
        : 1536;
      return new EmbeddingModelOpenAI(apiKey, embeddingModel, dimension);
    }

    default:
      throw new Error(
        `Unknown AI provider: ${providerName}. Supported providers: ollama, openai`
      );
  }
}
