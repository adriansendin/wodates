import { IAProvider } from './providers/IAProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { LocalOllamaProvider } from './providers/LocalOllamaProvider';
import { AIConfig } from './ai-settings';
// import { GeminiProvider } from './providers/GeminiProvider'; // Future provider

/**
 * Factory function to create AI providers
 *
 * Uses centralized configuration from ai-settings.ts.
 * This file only handles provider instantiation, not configuration.
 *
 * @param logger - Optional logger instance to pass to providers
 * @returns Configured IAProvider instance
 * @throws Error if provider is unknown or required configuration is missing
 */
export function createAIProvider(logger?: any): IAProvider {
  const providerName = process.env.AI_PROVIDER || AIConfig.defaultProvider;

  switch (providerName) {
    case 'ollama': {
      return new LocalOllamaProvider(
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
      return new OpenAIProvider(apiKey, AIConfig.openai.model);
    }

    case 'ai-service': {
      // When using ai-service, providers are handled via AiService*Client
      // This factory should not be called when AI_PROVIDER=ai-service
      throw new Error(
        'createAIProvider should not be called when AI_PROVIDER=ai-service. ' +
        'Use AiService*Client directly instead.'
      );
    }

    // case 'gemini': {
    //   const apiKey = process.env.GEMINI_API_KEY;
    //   if (!apiKey) {
    //     throw new Error(
    //       'GEMINI_API_KEY is required when AI_PROVIDER=gemini',
    //     );
    //   }
    //   return new GeminiProvider(apiKey);
    // }

    default:
      // Allow unknown providers - they may not be used in this flow
      // Fallback to ollama as safe default
      if (logger) {
        logger.warn(
          `Unknown AI provider: ${providerName}, falling back to ollama`
        );
      }
      return new LocalOllamaProvider(
        AIConfig.ollama.model,
        AIConfig.ollama.baseUrl,
        AIConfig.ollama.timeout,
        AIConfig.ollama.parameters,
        logger
      );
  }
}
