import { ChatModel, ChatRequest, ChatResponse } from '../ChatModel';
import { AIConfig } from '../../ai-settings';

/**
 * HTTP implementation of ChatModel
 *
 * Uses ai-service HTTP API for chat conversations.
 * This replaces direct Ollama calls with HTTP requests to the external ai-service.
 */
export class ChatModelHttp implements ChatModel {
  readonly name = 'ai-service';
  readonly model: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly logger?: any;

  constructor(baseUrl?: string, timeout?: number, logger?: any) {
    this.model = 'ai-service';
    this.baseUrl = baseUrl || AIConfig.aiService.baseUrl;
    this.timeout = timeout || AIConfig.aiService.timeout;
    this.logger = logger;
  }

  async generateChat(request: ChatRequest): Promise<ChatResponse> {
    // Global kill-switch: abort immediately if AI is disabled
    if (!AIConfig.enabled) {
      throw new Error('AI functionality is disabled (AI_ENABLED=false)');
    }

    try {
      if (this.logger) {
        this.logger.debug(
          {
            userId: request.userId,
            historyLength: request.conversationHistory.length,
            messageLength: request.lastUserMessage.length,
          },
          'Building request for ai-service chat'
        );
      }

      // Transform ChatRequest to ai-service format
      const aiServiceRequest = this.buildAiServiceRequest(request);

      if (this.logger) {
        this.logger.info(
          {
            baseUrl: this.baseUrl,
            messagesCount: aiServiceRequest.messages.length,
            hasSystem: !!aiServiceRequest.system,
          },
          'Calling ai-service /chat/generate'
        );
      }

      const content = await this.callAiService(aiServiceRequest);

      if (!content || content.trim().length === 0) {
        throw new Error('ai-service returned empty response');
      }

      return {
        content: content.trim(),
        provider: this.name,
        model: this.model,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`ai-service API error: ${error.message}`);
      }
      throw new Error('Unknown error calling ai-service API');
    }
  }

  /**
   * Builds ai-service request from ChatRequest
   * Transforms the backend's ChatRequest format to ai-service's GenerateChatRequest format
   */
  private buildAiServiceRequest(request: ChatRequest): {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    system?: string;
  } {
    // Build system prompt (same logic as ChatModelOllama.buildPrompt)
    const userContext = request.userContext || {};
    const activeMatches = request.activeMatches || [];

    let systemPrompt = `${AIConfig.prompt.systemInstructions()}\n\n`;

    if (userContext.name) {
      systemPrompt += `El usuario se llama ${userContext.name}.\n`;
    }

    if (userContext.bio) {
      systemPrompt += `Su bio dice: "${userContext.bio}"\n`;
    }

    if (activeMatches.length > 0) {
      systemPrompt += `\nActualmente tiene ${activeMatches.length} conversación(es) activa(s):\n`;
      for (const match of activeMatches.slice(0, 3)) {
        systemPrompt += `- Con ${match.otherUserName}`;
        if (match.lastMessage) {
          systemPrompt += `: último mensaje sobre "${match.lastMessage.substring(0, 50)}..."`;
        }
        systemPrompt += '\n';
      }
    }

    // Build messages array from conversation history
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add conversation history
    for (const msg of request.conversationHistory) {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      });
    }

    // Add last user message if not already in history
    const lastHistoryMessage =
      request.conversationHistory[request.conversationHistory.length - 1];
    const isLastMessageInHistory =
      lastHistoryMessage &&
      lastHistoryMessage.role === 'user' &&
      lastHistoryMessage.content === request.lastUserMessage;

    if (!isLastMessageInHistory && request.lastUserMessage) {
      messages.push({
        role: 'user',
        content: request.lastUserMessage,
      });
    }

    return {
      messages,
      system: systemPrompt,
    };
  }

  /**
   * Calls ai-service HTTP API
   */
  private async callAiService(request: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    system?: string;
  }): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/chat/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: request.messages,
          system: request.system,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`ai-service returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (!data.content || typeof data.content !== 'string') {
        throw new Error('ai-service returned invalid response format');
      }

      return data.content;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          throw new Error(
            `ai-service timeout after ${this.timeout}ms. Is ai-service running at ${this.baseUrl}?`
          );
        }
        throw error;
      }

      throw new Error('Unknown error calling ai-service API');
    }
  }
}
