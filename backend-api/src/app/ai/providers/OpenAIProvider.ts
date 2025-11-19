import OpenAI from 'openai';
import {
  IAProvider,
  IAResponse,
  IAGenerateRequest,
} from './IAProvider';
import { AIConfig } from '../ai-settings';

/**
 * OpenAI implementation of IAProvider
 * 
 * Uses OpenAI's chat completions API to generate responses for Doc Love.
 */
export class OpenAIProvider implements IAProvider {
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

  async generateReply(request: IAGenerateRequest): Promise<IAResponse> {
    try {
      // Build messages for OpenAI
      const messages = this.buildMessages(request);

      // Log complete request before sending to LLM
      const systemMessage = messages.find((m) => m.role === 'system');
      console.log('\n=== OPENAI REQUEST ===');
      console.log('Model:', this.model);
      console.log('Parameters:', {
        temperature: AIConfig.openai.temperature,
        max_tokens: AIConfig.openai.maxTokens,
      });
      console.log('Total messages:', messages.length);
      if (systemMessage) {
        console.log('System prompt length:', systemMessage.content.length, 'characters');
        console.log('System prompt (full):');
        console.log(systemMessage.content);
      }
      console.log('All messages:', JSON.stringify(messages, null, 2));
      console.log('========================\n');

      // Use centralized configuration from AIConfig
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
      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      throw new Error('Unknown error calling OpenAI API');
    }
  }

  private buildMessages(request: IAGenerateRequest): Array<{
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

    // Add conversation history
    for (const msg of request.conversationHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Add the last user message if not already in history
    if (request.lastUserMessage) {
      messages.push({
        role: 'user',
        content: request.lastUserMessage,
      });
    }

    return messages;
  }

  private buildSystemPrompt(request: IAGenerateRequest): string {
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

    prompt += `\nResponde de manera empática, profesional y útil. Ayuda al usuario a reflexionar sobre sus relaciones y a comunicarse mejor.`;

    return prompt;
  }
}

