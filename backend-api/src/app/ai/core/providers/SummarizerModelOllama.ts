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

      // DISABLED: Prompts and conversations should NOT be logged to avoid exposing sensitive data
      // Log completo del prompt antes de enviarlo al LLM
      // console.log('[8.5.4] INICIO DEL PROMPT ANTES DE ENVIAR AL LLM');
      // console.log(prompt);
      // console.log('[8.5.4] FIN DEL PROMPT ANTES DE ENVIAR AL LLM');

      const content = await this.callOllamaAPI(prompt);

      if (!content || content.trim().length === 0) {
        throw new Error('Ollama returned empty summary');
      }

      const trimmedContent = content.trim();

      // DISABLED: Raw LLM response should NOT be logged to avoid exposing sensitive data
      // Log response preview for debugging (first 500 chars)
      // if (this.logger) {
      //   this.logger.debug(
      //     {
      //       model: this.model,
      //       responseLength: trimmedContent.length,
      //       responsePreview:
      //         trimmedContent.length > 500
      //           ? trimmedContent.substring(0, 500) + '...'
      //           : trimmedContent,
      //     },
      //     'Raw LLM response received (plain text)'
      //   );
      // }

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
    // DISABLED: Detailed prompt construction logs removed for cleaner production logs
    // console.log('[8.5.3] Construyendo prompt para el LLM...');

    // Use centralized prompt configuration from AIConfig
    let prompt = `${AIConfig.prompt.summarizerInstructions.introduction}\n\n`;

    // Build new content section first (will be used as {{NEW_INFO}} placeholder)
    let newInfoSection = '';

    // Get current user name (the one being profiled)
    const currentUserName = request.userProfile?.name || 'Usuario';

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

    // Add conversation content - unified handling for all chats
    const newContent = request.newContent;
    let conversationCount = 0;

    // Process all user chats (now includes both Doc Love and regular users)
    if (newContent.userChats && newContent.userChats.length > 0) {
      // DISABLED: Detailed conversation processing logs removed for cleaner production logs
      // console.log(
      //   `[8.5.3.1] Procesando ${newContent.userChats.length} conversación(es) para el prompt...`
      // );
      newInfoSection += `\nCONVERSACIONES:\n`;
      // IMPORTANTE: Incluir TODAS las conversaciones, no solo las primeras 5
      // El LLM necesita ver todas las conversaciones para generar un perfil completo
      const allChats = newContent.userChats; // TODAS las conversaciones, sin límite
      // DISABLED: Detailed conversation processing logs removed for cleaner production logs
      // console.log(
      //   `[8.5.3.1] ✅ Incluyendo ${allChats.length} conversación(es) completas en el prompt (sin límite)`
      // );
      for (const chat of allChats) {
        conversationCount++;
        const otherUserName = chat.otherUserName || 'Otro usuario';
        newInfoSection += `\nConversación ${conversationCount} con ${otherUserName}:\n`;

        // DISABLED: Detailed conversation logs removed for cleaner production logs
        // Log conversation details
        // console.log(
        //   `[8.5.3.1.${conversationCount}] Conversación ${conversationCount} con ${otherUserName}:`
        // );
        // console.log(
        //   `[8.5.3.1.${conversationCount}] Total mensajes en conversación: ${chat.messages.length}`
        // );
        // console.log(
        //   `[8.5.3.1.${conversationCount}] Total mensajes que se enviarán al LLM: ${chat.messages.length} (TODOS los mensajes)`
        // );
        // console.log('─'.repeat(80));

        // IMPORTANTE: Incluir TODOS los mensajes, no solo los últimos 10
        // El LLM necesita ver toda la conversación para generar un perfil completo
        const allMessages = chat.messages; // TODOS los mensajes, sin límite
        // DISABLED: Detailed conversation processing logs removed for cleaner production logs
        // console.log(
        //   `[8.5.3.1.${conversationCount}] ✅ Incluyendo ${allMessages.length} mensajes completos en el prompt`
        // );

        for (let i = 0; i < allMessages.length; i++) {
          const msg = allMessages[i];
          if (!msg) continue; // Skip if message is undefined

          // Use senderName if available, otherwise fallback to role-based naming
          let displayName: string;
          if (msg.senderName) {
            // Check if this message is from the current user (being profiled)
            // Compare normalized names (trim, case-insensitive) to handle formatting differences
            const normalizedSenderName = msg.senderName.trim().toLowerCase();
            const normalizedCurrentUserName = currentUserName
              .trim()
              .toLowerCase();
            if (normalizedSenderName === normalizedCurrentUserName) {
              displayName = `${msg.senderName} (MAIN)`;
            } else {
              displayName = msg.senderName;
            }
          } else {
            // WARNING: senderName should always be present in Wodates chats
            // If missing, we can't determine if it's from MAIN user, so use generic name
            // DISABLED: Warning logs removed for cleaner production logs
            // console.warn(
            //   `[8.5.3.1.${conversationCount}] ⚠️ Message without senderName detected. Cannot mark as (MAIN).`
            // );
            displayName = 'Usuario';
          }

          // DISABLED: User message logs removed to avoid exposing sensitive conversation data
          // Log primeros 5 y últimos 5 mensajes para verificación
          // if (i < 5 || i >= allMessages.length - 5) {
          //   const messagePreview =
          //     msg.content.length > 100
          //       ? msg.content.substring(0, 100) + '...'
          //       : msg.content;
          //   const position = i < 5 ? 'INICIO' : 'FINAL';
          //   console.log(
          //     `[8.5.3.1.${conversationCount}] [${position}] [${i + 1}/${allMessages.length}] ${displayName}: ${messagePreview}`
          //   );
          // } else if (i === 5) {
          //   console.log(
          //     `[8.5.3.1.${conversationCount}] ... (${allMessages.length - 10} mensajes intermedios) ...`
          //   );
          // }

          newInfoSection += `${displayName}: ${msg.content}\n`;
        }
        // DISABLED: Detailed conversation processing logs removed for cleaner production logs
        // console.log('─'.repeat(80));
      }
      // DISABLED: Detailed conversation processing logs removed for cleaner production logs
      // console.log(`[8.5.3.1] ✅ Conversaciones procesadas en el prompt`);
    }

    // Handle imported conversations (WhatsApp, etc.)
    if (
      newContent.importedConversations &&
      newContent.importedConversations.length > 0
    ) {
      // DISABLED: Detailed imported conversation logs removed for cleaner production logs
      // console.log(
      //   `[8.5.3.2] Procesando ${newContent.importedConversations.length} conversación(es) importada(s)...`
      // );
      newInfoSection += `\nCONVERSACIONES IMPORTADAS:\n`;
      for (const conv of newContent.importedConversations.slice(0, 3)) {
        conversationCount++;
        newInfoSection += `\n${conv.source}:\n`;
        for (const msg of conv.messages.slice(-20)) {
          // Use senderName if available, otherwise fallback to generic name
          let displayName: string;
          if (msg.senderName) {
            // Check if this message is from the current user (being profiled)
            // Compare normalized names (trim, case-insensitive) to handle formatting differences
            const normalizedSenderName = msg.senderName.trim().toLowerCase();
            const normalizedCurrentUserName = currentUserName
              .trim()
              .toLowerCase();
            if (normalizedSenderName === normalizedCurrentUserName) {
              displayName = `${msg.senderName} (MAIN)`;
            } else {
              displayName = msg.senderName;
            }
          } else {
            // WARNING: senderName should be present in imported conversations
            // If missing, we can't determine if it's from MAIN user, so use generic name
            // This can happen if the WhatsApp format doesn't match the expected pattern
            // DISABLED: Warning logs removed for cleaner production logs
            // console.warn(
            //   `[8.5.3.2] ⚠️ Imported conversation message without senderName detected. Cannot mark as (MAIN).`
            // );
            displayName = 'Usuario';
          }
          newInfoSection += `${displayName}: ${msg.content}\n`;
        }
      }
      // DISABLED: Detailed imported conversation logs removed for cleaner production logs
      // console.log(
      //   `[8.5.3.2] ✅ Conversaciones importadas procesadas en el prompt`
      // );
    }

    // Always use createNew instructions; summaries are merged in a separate step
    prompt += `CONTENIDO A RESUMIR:\n`;
    prompt += newInfoSection;
    prompt += `\n\nINSTRUCCIONES:\n`;
    prompt += AIConfig.prompt.summarizerInstructions.createNew;

    // DISABLED: Detailed prompt construction logs removed - consolidated into single log line
    // console.log(
    //   '[8.5.3] ✅ Prompt construido. Longitud total:',
    //   prompt.length,
    //   'caracteres'
    // );
    // DISABLED: Prompts and conversations should NOT be logged to avoid exposing sensitive data
    // console.log('[8.5.3] 📋 CONTENIDO DE CONVERSACIONES QUE SE ENVÍA AL LLM:');
    // console.log('═'.repeat(80));
    // console.log(newInfoSection);
    // console.log('═'.repeat(80));
    // console.log(
    //   '[8.5.3] 📋 Vista previa del prompt completo (primeros 1000 caracteres):'
    // );
    // console.log('─'.repeat(80));
    // console.log(prompt.substring(0, 1000));
    // console.log('─'.repeat(80));

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

      // Consolidated log: LLM call parameters in single line
      const params = [
        `Model: ${this.model}`,
        `Temp: ${requestBody.temperature ?? 'not set'}`,
        `Seed: ${requestBody.seed ?? 'not set'}`,
        `num_predict: ${requestBody.num_predict ?? 'not set'}`,
        `num_ctx: ${requestBody.num_ctx ?? 'not set'}`,
        requestBody.top_p !== undefined ? `top_p: ${requestBody.top_p}` : null,
        requestBody.top_k !== undefined ? `top_k: ${requestBody.top_k}` : null,
        requestBody.repeat_penalty !== undefined
          ? `repeat_penalty: ${requestBody.repeat_penalty}`
          : null,
        `Prompt length: ${prompt.length} chars`,
      ]
        .filter(Boolean)
        .join(', ');
      console.log(`🔧 LLM CALL (Summarizer - createNew): ${params}`);

      // DISABLED: Detailed DEBUG logs removed to avoid exposing sensitive data
      // if (this.logger) {
      //   this.logger.debug(
      //     {
      //       url: apiUrl,
      //       model: this.model,
      //       promptLength: prompt.length,
      //     },
      //     'Calling Ollama API for summarization'
      //   );
      // }

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
