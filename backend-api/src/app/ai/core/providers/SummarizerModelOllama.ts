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
  seed?: number;
  top_k?: number;
  repeat_penalty?: number;
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

      const trimmedContent = content.trim();

      // Log response preview for debugging (first 500 chars)
      if (this.logger) {
        this.logger.debug(
          {
            model: this.model,
            responseLength: trimmedContent.length,
            responsePreview:
              trimmedContent.length > 500
                ? trimmedContent.substring(0, 500) + '...'
                : trimmedContent,
          },
          'Raw LLM response received (plain text)'
        );
      }

      // Return plain text summary (no JSON parsing needed)
      return {
        summary: trimmedContent,
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

    // Build new content section first (will be used as {{NEW_INFO}} placeholder)
    let newInfoSection = '';

    // Add user profile info
    if (request.userProfile) {
      newInfoSection += `\nPERFIL DEL USUARIO:\n`;
      if (request.userProfile.name) {
        newInfoSection += `- Nombre: ${request.userProfile.name}\n`;
      }
      if (request.userProfile.age) {
        newInfoSection += `- Edad: ${request.userProfile.age}\n`;
      }
      if (request.userProfile.gender) {
        newInfoSection += `- Género: ${request.userProfile.gender}\n`;
      }
      if (request.userProfile.bio) {
        newInfoSection += `- Bio: ${request.userProfile.bio}\n`;
      }
    }

    // Add conversation content
    const newContent = request.newContent;
    let conversationCount = 0;

    if (newContent.docLoveChats && newContent.docLoveChats.length > 0) {
      newInfoSection += `\nCONVERSACIONES CON DOC LOVE:\n`;
      for (const chat of newContent.docLoveChats.slice(0, 5)) {
        conversationCount++;
        newInfoSection += `\nConversación ${conversationCount}:\n`;
        for (const msg of chat.messages.slice(-10)) {
          const role = msg.role === 'assistant' ? 'Doc Love' : 'Usuario';
          newInfoSection += `${role}: ${msg.content}\n`;
        }
      }
    }

    if (newContent.userChats && newContent.userChats.length > 0) {
      newInfoSection += `\nCONVERSACIONES CON OTROS USUARIOS:\n`;
      for (const chat of newContent.userChats.slice(0, 5)) {
        conversationCount++;
        newInfoSection += `\nConversación ${conversationCount}:\n`;
        for (const msg of chat.messages.slice(-10)) {
          newInfoSection += `Usuario: ${msg.content}\n`;
        }
      }
    }

    if (
      newContent.importedConversations &&
      newContent.importedConversations.length > 0
    ) {
      newInfoSection += `\nCONVERSACIONES IMPORTADAS:\n`;
      for (const conv of newContent.importedConversations.slice(0, 3)) {
        conversationCount++;
        newInfoSection += `\n${conv.source}:\n`;
        for (const msg of conv.messages.slice(-20)) {
          newInfoSection += `Usuario: ${msg.content}\n`;
        }
      }
    }

    // Always use createNew instructions; summaries are merged in a separate step
    prompt += `CONTENIDO A RESUMIR:\n`;
    prompt += newInfoSection;
    prompt += `\n\nINSTRUCCIONES:\n`;
    prompt += AIConfig.prompt.summarizerInstructions.createNew;

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
      if (this.parameters.seed !== undefined) {
        requestBody.seed = this.parameters.seed;
      }
      if (this.parameters.top_k !== undefined) {
        requestBody.top_k = this.parameters.top_k;
      }
      if (this.parameters.repeat_penalty !== undefined) {
        requestBody.repeat_penalty = this.parameters.repeat_penalty;
      }

      const apiUrl = `${this.baseUrl}/api/generate`;

      // Log parameters before LLM call
      console.log('\n🔧 LLM CALL PARAMETERS (Summarizer - createNew)');
      console.log('─'.repeat(60));
      console.log(`   Model: ${this.model}`);
      console.log(`   Temperature: ${requestBody.temperature ?? 'not set'}`);
      console.log(`   Seed: ${requestBody.seed ?? 'not set'}`);
      console.log(`   num_predict: ${requestBody.num_predict ?? 'not set'}`);
      console.log(`   num_ctx: ${requestBody.num_ctx ?? 'not set'}`);
      if (requestBody.top_p !== undefined) {
        console.log(`   top_p: ${requestBody.top_p}`);
      }
      if (requestBody.top_k !== undefined) {
        console.log(`   top_k: ${requestBody.top_k}`);
      }
      if (requestBody.repeat_penalty !== undefined) {
        console.log(`   repeat_penalty: ${requestBody.repeat_penalty}`);
      }
      console.log(`   Prompt length: ${prompt.length} characters`);
      console.log('─'.repeat(60));
      console.log('');

      if (this.logger) {
        this.logger.debug(
          {
            url: apiUrl,
            model: this.model,
            promptLength: prompt.length,
          },
          'Calling Ollama API for summarization'
        );
      }

      const response = await fetch(apiUrl, {
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
          const errorMsg = `Ollama API timeout after ${this.timeout}ms. Is Ollama running at ${this.baseUrl}? Check: curl ${this.baseUrl}/api/tags`;
          if (this.logger) {
            this.logger.error(
              {
                url: `${this.baseUrl}/api/generate`,
                timeout: this.timeout,
                model: this.model,
              },
              errorMsg
            );
          }
          throw new Error(errorMsg);
        }

        // Handle fetch-specific errors
        const isConnectionError =
          error.message.includes('fetch failed') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('ENOTFOUND') ||
          error.message.includes('ECONNRESET') ||
          (error as any).code === 'ECONNREFUSED' ||
          (error as any).code === 'ENOTFOUND';

        if (isConnectionError) {
          const causeMessage =
            (error as any).cause?.message || (error as any).cause || '';
          const detailedError = causeMessage
            ? `${error.message} (cause: ${causeMessage})`
            : error.message;
          const errorMsg = `Failed to connect to Ollama at ${this.baseUrl}. Error: ${detailedError}. Is Ollama running? Check: curl ${this.baseUrl}/api/tags`;
          if (this.logger) {
            this.logger.error(
              {
                url: `${this.baseUrl}/api/generate`,
                baseUrl: this.baseUrl,
                model: this.model,
                originalError: error.message,
                errorCode: (error as any).code,
                errorCause: (error as any).cause,
              },
              errorMsg
            );
          }
          throw new Error(errorMsg);
        }

        throw error;
      }

      throw new Error('Unknown error calling Ollama API');
    }
  }
}
