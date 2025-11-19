import {
  IAProvider,
  IAResponse,
  IAGenerateRequest,
} from './IAProvider';
import { AIConfig } from '../ai-settings';

/**
 * Local Ollama implementation of IAProvider
 * 
 * Uses Ollama's local API (typically http://localhost:11434) to generate responses.
 * Handles streaming responses and reconstructs the full text before returning.
 */
interface OllamaParameters {
  temperature?: number;
  num_predict?: number;
  top_p?: number;
  num_ctx?: number; // Context window size (not 'context' which is an array)
}

export class LocalOllamaProvider implements IAProvider {
  readonly name = 'ollama';
  readonly model: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly parameters: OllamaParameters;
  private readonly logger?: any;

  constructor(
    model: string,
    baseUrl?: string,
    timeout?: number,
    parameters?: OllamaParameters,
    logger?: any,
  ) {
    // Model is required and provided by config.ts from AI_MODEL environment variable
    // Supported models: phi3, llama3.2:1b, qwen2.5:1.5b
    this.model = model;
    this.baseUrl = baseUrl || 'http://localhost:11434';
    this.timeout = timeout || 60000; // 60 seconds default timeout
    this.parameters = parameters || {};
    this.logger = logger;
  }

  async generateReply(request: IAGenerateRequest): Promise<IAResponse> {
    try {
      if (this.logger) {
        this.logger.debug(
          {
            userId: request.userId,
            historyLength: request.conversationHistory.length,
            messageLength: request.lastUserMessage.length,
          },
          'Building prompt for Ollama',
        );
      }

      // Build prompt for Ollama (text format, not role-based)
      const prompt = this.buildPrompt(request);

      if (this.logger) {
        this.logger.info(
          {
            baseUrl: this.baseUrl,
            model: this.model,
            promptLength: prompt.length,
            promptPreview: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
          },
          '7. Ollama - Llamando API HTTP a Ollama',
        );
      }

      // Call Ollama API with streaming
      const content = await this.callOllamaAPI(
        prompt, 
        request.lastUserMessage,
        request.conversationHistory.length
      );

      if (!content || content.trim().length === 0) {
        if (this.logger) {
          this.logger.warn('8. Ollama - ERROR: Respuesta vacía recibida');
        }
        throw new Error('Ollama returned empty response');
      }

      // Log the complete response (similar format to request log)
      console.log('\n=== OLLAMA RESPONSE ===');
      console.log('Model:', this.model);
      console.log('Response length:', content.length, 'characters');
      console.log('Response (full):');
      console.log(content);
      console.log('========================\n');

      if (this.logger) {
        this.logger.info(
          {
            model: this.model,
            responseLength: content.length,
            responsePreview: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
          },
          '8. Ollama - Respuesta recibida exitosamente',
        );
      }

      return {
        content: content.trim(),
        provider: this.name,
        model: this.model,
        // Ollama doesn't provide token usage in the same way
        // tokensUsed is optional, so we omit it instead of setting to undefined
      };
    } catch (error) {
      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(`Ollama API error: ${error.message}`);
      }
      throw new Error('Unknown error calling Ollama API');
    }
  }

  /**
   * Builds a text-based prompt for Ollama
   * 
   * Unlike OpenAI, Ollama uses a single text prompt rather than
   * separate system/user/assistant messages.
   * Uses centralized prompt configuration from AIConfig.
   */
  private buildPrompt(request: IAGenerateRequest): string {
    const userContext = request.userContext || {};
    const activeMatches = request.activeMatches || [];

    // System instructions from centralized config
    let prompt = `${AIConfig.prompt.systemInstructions}\n\n`;

    // Add user context if available
    if (userContext.name) {
      prompt += `El usuario se llama ${userContext.name}.\n`;
    }

    if (userContext.bio) {
      prompt += `Su bio dice: "${userContext.bio}"\n`;
    }

    // Add active matches context
    if (activeMatches.length > 0) {
      prompt += `\nActualmente tiene ${activeMatches.length} conversación(es) activa(s):\n`;
      for (const match of activeMatches.slice(0, 3)) {
        // Limit to 3 matches
        prompt += `- Con ${match.otherUserName}`;
        if (match.lastMessage) {
          prompt += `: último mensaje sobre "${match.lastMessage.substring(0, 50)}..."`;
        }
        prompt += '\n';
      }
    }

    prompt += '\n---\n\nConversación:\n\n';

    // Add conversation history in text format
    for (const msg of request.conversationHistory) {
      const role = msg.role === 'assistant' ? 'Doc Love' : 'Usuario';
      prompt += `${role}: ${msg.content}\n\n`;
    }

    // Add the last user message only if it's not already in the history
    // (to avoid duplication - the message might already be saved and included in history)
    const lastHistoryMessage = request.conversationHistory[request.conversationHistory.length - 1];
    const isLastMessageInHistory = lastHistoryMessage && 
      lastHistoryMessage.role === 'user' && 
      lastHistoryMessage.content === request.lastUserMessage;

    if (!isLastMessageInHistory && request.lastUserMessage) {
      prompt += `Usuario: ${request.lastUserMessage}\n\n`;
    }

    prompt += 'Doc Love: ';

    return prompt;
  }

  /**
   * Calls Ollama API and handles streaming response
   * 
   * Ollama returns a stream of JSON chunks (NDJSON format).
   * Each chunk has a "response" field with text and a "done" flag.
   * We accumulate all responses until done=true.
   */
  private async callOllamaAPI(
    prompt: string, 
    lastUserMessage?: string,
    historyLength?: number
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      if (this.logger) {
        this.logger.debug(
          {
            url: `${this.baseUrl}/api/generate`,
            model: this.model,
            timeout: this.timeout,
            temperature: this.parameters.temperature,
            num_predict: this.parameters.num_predict,
            top_p: this.parameters.top_p,
            num_ctx: this.parameters.num_ctx,
          },
          'Making request to Ollama API (speed-optimized)',
        );
      }

      // Build request body with speed-optimized parameters
      const requestBody: any = {
        model: this.model,
        prompt: prompt,
        stream: true,
      };

      // Add parameters if configured (prioritize speed)
      if (this.parameters.temperature !== undefined) {
        requestBody.temperature = this.parameters.temperature;
      }
      if (this.parameters.num_predict !== undefined) {
        requestBody.num_predict = this.parameters.num_predict;
      }
      if (this.parameters.top_p !== undefined) {
        requestBody.top_p = this.parameters.top_p;
      }
      if (this.parameters.num_ctx !== undefined) {
        requestBody.num_ctx = this.parameters.num_ctx;
      }

      // Log complete request before sending to LLM
      console.log('\n=== OLLAMA REQUEST ===');
      console.log('URL:', `${this.baseUrl}/api/generate`);
      console.log('Model:', this.model);
      console.log('Parameters:', {
        temperature: requestBody.temperature,
        num_predict: requestBody.num_predict,
        top_p: requestBody.top_p,
        num_ctx: requestBody.num_ctx,
        stream: requestBody.stream,
      });
      console.log('Prompt length:', requestBody.prompt.length, 'characters', '(includes system instructions, context, and conversation history)');
      if (historyLength !== undefined) {
        console.log('Conversation history:', historyLength, 'messages');
      }
      // Only log the last user message to avoid showing previous Doc Love messages
      if (lastUserMessage) {
        console.log('Usuario:', lastUserMessage, `(${lastUserMessage.length} characters)`);
      }
      console.log('========================\n');

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        clearTimeout(timeoutId);
        const errorText = await response.text().catch(() => 'Unknown error');
        if (this.logger) {
          this.logger.error(
            {
              status: response.status,
              statusText: response.statusText,
              error: errorText,
            },
            'Ollama API returned error status',
          );
        }
        throw new Error(
          `Ollama API returned ${response.status}: ${errorText}`,
        );
      }

      if (!response.body) {
        clearTimeout(timeoutId);
        if (this.logger) {
          this.logger.error('Ollama API response has no body');
        }
        throw new Error('Ollama API response has no body');
      }

      if (this.logger) {
        this.logger.debug('Reading streaming response from Ollama');
      }

      // Read streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      try {
        while (true) {
          // Check if aborted before reading
          if (controller.signal.aborted) {
            throw new Error('Request aborted due to timeout');
          }

          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // Decode chunk
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter((line) => line.trim());

          // Parse each JSON line
          for (const line of lines) {
            try {
              const json = JSON.parse(line);

              // Accumulate response text
              if (json.response) {
                fullResponse += json.response;
              }

              // Check if stream is done
              if (json.done === true) {
                clearTimeout(timeoutId);
                if (this.logger) {
                  this.logger.debug(
                    {
                      responseLength: fullResponse.length,
                    },
                    'Ollama stream completed',
                  );
                }
                return fullResponse;
              }

              // Handle errors in stream
              if (json.error) {
                clearTimeout(timeoutId);
                throw new Error(`Ollama stream error: ${json.error}`);
              }
            } catch (parseError) {
              // Ignore malformed JSON lines (common in streaming)
              // Only log if it's not a JSON parse error
              if (!(parseError instanceof SyntaxError)) {
                console.warn(
                  '[LocalOllamaProvider] Error parsing chunk:',
                  parseError,
                );
              }
            }
          }
        }
      } finally {
        clearTimeout(timeoutId);
        reader.releaseLock();
      }

      // Return accumulated response (even if done flag wasn't received)
      return fullResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          const timeoutError = `Ollama API timeout after ${this.timeout}ms. Is Ollama running at ${this.baseUrl}? Check: curl ${this.baseUrl}/api/tags`;
          if (this.logger) {
            this.logger.error(
              {
                timeout: this.timeout,
                baseUrl: this.baseUrl,
              },
              timeoutError,
            );
          }
          throw new Error(timeoutError);
        }
        if (this.logger) {
          this.logger.error(
            {
              error: error.message,
              baseUrl: this.baseUrl,
            },
            'Error calling Ollama API',
          );
        }
        throw error;
      }

      throw new Error('Unknown error calling Ollama API');
    }
  }
}

