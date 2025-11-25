import {
  SummarizerModel,
  SummarizerRequest,
  SummarizerResponse,
} from '../SummarizerModel';
import { AIConfig } from '../../ai-settings';

/**
 * Ollama implementation of SummarizerModel
 *
 * Uses Ollama for generating user personality summaries.
 */
interface OllamaParameters {
  temperature?: number;
  num_predict?: number;
  top_p?: number;
  num_ctx?: number;
}

export class SummarizerModelOllama implements SummarizerModel {
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
    this.timeout = timeout || 120000; // Longer timeout for summarization
    this.parameters = parameters || {};
    this.logger = logger;
  }

  async generateSummary(
    request: SummarizerRequest
  ): Promise<SummarizerResponse> {
    try {
      const prompt = this.buildPrompt(request);

      if (this.logger) {
        this.logger.debug(
          {
            model: this.model,
            promptLength: prompt.length,
            hasPreviousSummary: !!request.previousSummary,
          },
          'Generating user summary with Ollama'
        );
      }

      const content = await this.callOllamaAPI(prompt);

      if (!content || content.trim().length === 0) {
        throw new Error('Ollama returned empty summary');
      }

      return {
        summary: content.trim(),
        provider: this.name,
        model: this.model,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Ollama summarization error: ${error.message}`);
      }
      throw new Error('Unknown error calling Ollama for summarization');
    }
  }

  private buildPrompt(request: SummarizerRequest): string {
    // Use centralized prompt configuration from AIConfig
    let prompt = `${AIConfig.prompt.summarizerInstructions.introduction}\n\n`;

    if (request.previousSummary) {
      prompt += `RESUMEN ANTERIOR:\n${request.previousSummary}\n\n`;
      prompt += `NUEVO CONTENIDO A INCORPORAR:\n`;
    } else {
      prompt += `CONTENIDO A RESUMIR:\n`;
    }

    // Add user profile info
    if (request.userProfile) {
      prompt += `\nPERFIL DEL USUARIO:\n`;
      if (request.userProfile.name) {
        prompt += `- Nombre: ${request.userProfile.name}\n`;
      }
      if (request.userProfile.age) {
        prompt += `- Edad: ${request.userProfile.age}\n`;
      }
      if (request.userProfile.gender) {
        prompt += `- Género: ${request.userProfile.gender}\n`;
      }
      if (request.userProfile.bio) {
        prompt += `- Bio: ${request.userProfile.bio}\n`;
      }
    }

    // Add conversation content
    const newContent = request.newContent;
    let conversationCount = 0;

    if (newContent.docLoveChats && newContent.docLoveChats.length > 0) {
      prompt += `\nCONVERSACIONES CON DOC LOVE:\n`;
      for (const chat of newContent.docLoveChats.slice(0, 5)) {
        conversationCount++;
        prompt += `\nConversación ${conversationCount}:\n`;
        for (const msg of chat.messages.slice(-10)) {
          const role = msg.role === 'assistant' ? 'Doc Love' : 'Usuario';
          prompt += `${role}: ${msg.content}\n`;
        }
      }
    }

    if (newContent.userChats && newContent.userChats.length > 0) {
      prompt += `\nCONVERSACIONES CON OTROS USUARIOS:\n`;
      for (const chat of newContent.userChats.slice(0, 5)) {
        conversationCount++;
        prompt += `\nConversación ${conversationCount}:\n`;
        for (const msg of chat.messages.slice(-10)) {
          prompt += `Usuario: ${msg.content}\n`;
        }
      }
    }

    if (
      newContent.importedConversations &&
      newContent.importedConversations.length > 0
    ) {
      prompt += `\nCONVERSACIONES IMPORTADAS:\n`;
      for (const conv of newContent.importedConversations.slice(0, 3)) {
        conversationCount++;
        prompt += `\n${conv.source}:\n`;
        for (const msg of conv.messages.slice(-20)) {
          prompt += `Usuario: ${msg.content}\n`;
        }
      }
    }

    // Use centralized instructions from AIConfig
    prompt += `\n\nINSTRUCCIONES:\n`;
    if (request.previousSummary) {
      prompt += AIConfig.prompt.summarizerInstructions.updateExisting;
    } else {
      prompt += AIConfig.prompt.summarizerInstructions.createNew;
    }
    prompt += `\n`;

    prompt += `\nEscribe SOLO el contenido del resumen, sin títulos ni introducciones:\n`;

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
        requestBody.num_predict = this.parameters.num_predict || 1000; // More tokens for summaries
      }
      if (this.parameters.top_p !== undefined) {
        requestBody.top_p = this.parameters.top_p;
      }
      if (this.parameters.num_ctx !== undefined) {
        requestBody.num_ctx = this.parameters.num_ctx || 2048; // Larger context for summaries
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
                  '[SummarizerModelOllama] Error parsing chunk:',
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
          throw new Error(`Ollama API timeout after ${this.timeout}ms`);
        }
        throw error;
      }

      throw new Error('Unknown error calling Ollama API');
    }
  }
}
