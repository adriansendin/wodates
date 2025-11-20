import OpenAI from 'openai';
import { ChatModel, ChatRequest, ChatResponse } from '../ChatModel';
import { AIConfig } from '../../ai-settings';

/**
 * OpenAI implementation of ChatModel
 * 
 * Uses OpenAI's chat completions API for conversations.
 */
export class ChatModelOpenAI implements ChatModel {
  readonly name = 'openai';
  readonly model: string;
  private readonly client: OpenAI;

  constructor(apiKey: string, model?: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.client = new OpenAI({ apiKey });
    this.model = model || AIConfig.openai.model;
  }

  async generateChat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const messages = this.buildMessages(request);

      // Log LLM call parameters
      const totalPromptLength = messages.reduce((acc, m) => acc + m.content.length, 0);
      console.log('\n=== LLM CALL PARAMETERS (OpenAI) ===');
      console.log('Provider:', this.name);
      console.log('Model:', this.model);
      console.log('Parameters:');
      console.log('  - temperature:', AIConfig.openai.temperature);
      console.log('  - max_tokens:', AIConfig.openai.maxTokens);
      console.log('Messages count:', messages.length);
      console.log('Total prompt length:', totalPromptLength, 'characters');
      console.log('====================================\n');

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: AIConfig.openai.temperature,
        max_tokens: AIConfig.openai.maxTokens,
      });

      const content = completion.choices[0]?.message?.content;

      if (!content) {
        throw new Error('OpenAI returned empty response');
      }

      return {
        content,
        provider: this.name,
        model: completion.model,
        ...(completion.usage?.total_tokens && {
          tokensUsed: completion.usage.total_tokens,
        }),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      throw new Error('Unknown error calling OpenAI API');
    }
  }

  private buildMessages(request: ChatRequest): Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }> {
    const systemPrompt = this.buildSystemPrompt(request);
    const messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }> = [
      { role: 'system', content: systemPrompt },
    ];

    for (const msg of request.conversationHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    if (request.lastUserMessage) {
      messages.push({
        role: 'user',
        content: request.lastUserMessage,
      });
    }

    return messages;
  }

  private buildSystemPrompt(request: ChatRequest): string {
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

    prompt += `\nResponde de manera empática, profesional y útil. Ayuda al usuario a reflexionar sobre sus relaciones y a comunicarse mejor.`;

    return prompt;
  }
}

