import { ChatModel, ChatRequest, ChatResponse } from '../ChatModel';
import { AIConfig } from '../../ai-settings';

/**
 * Ollama implementation of ChatModel
 *
 * Uses Ollama's local API for chat conversations.
 */
interface OllamaParameters {
  temperature?: number;
  num_predict?: number;
  top_p?: number;
  num_ctx?: number;
}

export class ChatModelOllama implements ChatModel {
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
    logger?: any
  ) {
    this.model = model;
    this.baseUrl = baseUrl || 'http://localhost:11434';
    this.timeout = timeout || 60000;
    this.parameters = parameters || {};
    this.logger = logger;
  }

  async generateChat(request: ChatRequest): Promise<ChatResponse> {
    try {
      if (this.logger) {
        this.logger.debug(
          {
            userId: request.userId,
            historyLength: request.conversationHistory.length,
            messageLength: request.lastUserMessage.length,
          },
          'Building prompt for Ollama chat'
        );
      }

      const prompt = this.buildPrompt(request);

      if (this.logger) {
        this.logger.info(
          {
            baseUrl: this.baseUrl,
            model: this.model,
            promptLength: prompt.length,
          },
          'Calling Ollama API for chat'
        );
      }

      const content = await this.callOllamaAPI(prompt);

      if (!content || content.trim().length === 0) {
        throw new Error('Ollama returned empty response');
      }

      return {
        content: content.trim(),
        provider: this.name,
        model: this.model,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Ollama API error: ${error.message}`);
      }
      throw new Error('Unknown error calling Ollama API');
    }
  }

  private buildPrompt(request: ChatRequest): string {
    const userContext = request.userContext || {};
    const activeMatches = request.activeMatches || [];

    let prompt = `${AIConfig.prompt.systemInstructions}\n\n`;

    if (userContext.name) {
      prompt += `El usuario se llama ${userContext.name}.\n`;
    }

    if (userContext.bio) {
      prompt += `Su bio dice: "${userContext.bio}"\n`;
    }

    if (activeMatches.length > 0) {
      prompt += `\nActualmente tiene ${activeMatches.length} conversación(es) activa(s):\n`;
      for (const match of activeMatches.slice(0, 3)) {
        prompt += `- Con ${match.otherUserName}`;
        if (match.lastMessage) {
          prompt += `: último mensaje sobre "${match.lastMessage.substring(0, 50)}..."`;
        }
        prompt += '\n';
      }
    }

    prompt += '\n---\n\nConversación:\n\n';

    for (const msg of request.conversationHistory) {
      const role = msg.role === 'assistant' ? 'Doc Love' : 'Usuario';
      prompt += `${role}: ${msg.content}\n\n`;
    }

    const lastHistoryMessage =
      request.conversationHistory[request.conversationHistory.length - 1];
    const isLastMessageInHistory =
      lastHistoryMessage &&
      lastHistoryMessage.role === 'user' &&
      lastHistoryMessage.content === request.lastUserMessage;

    if (!isLastMessageInHistory && request.lastUserMessage) {
      prompt += `Usuario: ${request.lastUserMessage}\n\n`;
    }

    prompt += 'Doc Love: ';

    return prompt;
  }

  private async callOllamaAPI(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const requestBody: any = {
        model: this.model,
        prompt: prompt,
        stream: true,
      };

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

      // Log LLM call parameters
      console.log('\n=== LLM CALL PARAMETERS (Ollama) ===');
      console.log('Provider:', this.name);
      console.log('Model:', this.model);
      console.log('Base URL:', this.baseUrl);
      console.log('Timeout:', this.timeout, 'ms');
      console.log('Parameters:');
      console.log('  - temperature:', requestBody.temperature ?? 'default');
      console.log('  - num_predict:', requestBody.num_predict ?? 'default');
      console.log('  - top_p:', requestBody.top_p ?? 'default');
      console.log('  - num_ctx:', requestBody.num_ctx ?? 'default');
      console.log('  - stream:', requestBody.stream);
      console.log('Prompt length:', prompt.length, 'characters');
      console.log('=====================================\n');

      if (this.logger) {
        this.logger.info(
          {
            provider: this.name,
            model: this.model,
            baseUrl: this.baseUrl,
            timeout: this.timeout,
            parameters: {
              temperature: requestBody.temperature,
              num_predict: requestBody.num_predict,
              top_p: requestBody.top_p,
              num_ctx: requestBody.num_ctx,
              stream: requestBody.stream,
            },
            promptLength: prompt.length,
          },
          'Calling Ollama LLM with parameters'
        );
      }

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
        throw new Error(`Ollama API returned ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        clearTimeout(timeoutId);
        throw new Error('Ollama API response has no body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      try {
        for (;;) {
          if (controller.signal.aborted) {
            throw new Error('Request aborted due to timeout');
          }

          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter((line) => line.trim());

          for (const line of lines) {
            try {
              const json = JSON.parse(line);

              if (json.response) {
                fullResponse += json.response;
              }

              if (json.done === true) {
                clearTimeout(timeoutId);
                return fullResponse;
              }

              if (json.error) {
                clearTimeout(timeoutId);
                throw new Error(`Ollama stream error: ${json.error}`);
              }
            } catch (parseError) {
              if (!(parseError instanceof SyntaxError)) {
                console.warn(
                  '[ChatModelOllama] Error parsing chunk:',
                  parseError
                );
              }
            }
          }
        }
      } finally {
        clearTimeout(timeoutId);
        reader.releaseLock();
      }

      return fullResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          throw new Error(
            `Ollama API timeout after ${this.timeout}ms. Is Ollama running at ${this.baseUrl}?`
          );
        }
        throw error;
      }

      throw new Error('Unknown error calling Ollama API');
    }
  }
}
