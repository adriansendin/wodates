import { Result, success, failure } from '../../Result';
import { DomainError, InternalError } from '../../errors/DomainError';
import { GetAllUserChats, ProcessedChatSummary } from './GetAllUserChats';
import { UserAIProfileRepository } from '../../repositories/UserAIProfileRepository';
import { UserRepository } from '../../repositories/UserRepository';
import {
  SummarizerModel,
  SummarizerRequest,
} from '../../../app/ai/core/SummarizerModel';
import { DocLoveHelper } from '../../../app/services/doc-love-helper';
import { AIConfig } from '../../../app/ai/ai-settings';

/**
 * GenerateUserProfileFromChats - Generates or updates user profile from unprocessed chats
 *
 * This use case:
 * 1. Gets all unprocessed chats for the user (using GetAllUserChats)
 * 2. Retrieves existing profile (if any)
 * 3. Transforms chat data to SummarizerRequest format
 * 4. Calls SummarizerModel to generate/update profile summary
 * 5. Saves the updated profile to user_ai_profiles table
 *
 * Note: Messages are NOT marked as processed - they are only read for analysis.
 */
export class GenerateUserProfileFromChats {
  private mergeModelOverride: string | undefined;

  constructor(
    private getAllUserChats: GetAllUserChats,
    private userAIProfileRepository: UserAIProfileRepository,
    private userRepository: UserRepository,
    private summarizerModel: SummarizerModel,
    private docLoveHelper: DocLoveHelper,
    private logger?: any,
    mergeModelOverride?: string
  ) {
    this.mergeModelOverride = mergeModelOverride;
  }

  async execute(userId: string): Promise<Result<string, DomainError>> {
    try {
      // Step 1: Get all unprocessed chats
      if (this.logger) {
        this.logger.info(
          { userId },
          'Generating user profile from chats - fetching unprocessed chats'
        );
      }

      const chatsResult = await this.getAllUserChats.execute(userId);
      if (!chatsResult.success) {
        return failure(chatsResult.error);
      }

      const chats = chatsResult.data;

      // If no chats with unprocessed messages, return early
      if (chats.length === 0) {
        if (this.logger) {
          this.logger.info(
            { userId },
            'No unprocessed chats found - nothing to analyze'
          );
        }
        return success('No unprocessed chats to analyze');
      }

      // Step 2: Get existing profile (opcional, no se usa para previousSummary)
      const existingProfileResult =
        await this.userAIProfileRepository.findByUserId(userId);
      if (!existingProfileResult.success) {
        return failure(existingProfileResult.error);
      }

      // No leer previousSummary - cada ejecución genera un resumen nuevo basado solo en mensajes no procesados

      // Step 3: Get user information for context
      const userResult = await this.userRepository.findById(userId);
      if (!userResult.success) {
        return failure(userResult.error);
      }

      const user = userResult.data;

      // Get Doc Love user ID to identify Doc Love chats
      let docLoveUserId: string;
      try {
        docLoveUserId = await this.docLoveHelper.getDocLoveUserId();
      } catch (error) {
        if (this.logger) {
          this.logger.warn(
            { userId, error },
            'Failed to get Doc Love user ID, continuing without Doc Love detection'
          );
        }
        docLoveUserId = ''; // Fallback
      }

      // Step 4: Transform chats to SummarizerRequest format
      // DISABLED: Detailed transformation logs removed for cleaner production logs
      // console.log(
      //   '[8.5.1] Transformando conversaciones a formato SummarizerRequest...'
      // );
      const userData: { name?: string; bio?: string; birthDate?: string } = {};
      if (user.name !== undefined) {
        userData.name = user.name;
      }
      if (user.bio !== undefined) {
        userData.bio = user.bio;
      }
      if (user.birthDate !== undefined) {
        userData.birthDate = user.birthDate;
      }

      const summarizerRequest = this.transformChatsToSummarizerRequest(
        chats,
        docLoveUserId,
        userData,
        undefined // No pasar previousSummary - generar resumen nuevo cada vez
      );

      // DISABLED: Detailed transformation logs removed for cleaner production logs
      // console.log(
      //   `[8.5.1] ✅ Transformación completada. Conversaciones procesadas: ${chats.length}`
      // );
      // console.log(
      //   `[8.5.1] ✅ Total mensajes que se pasarán al LLM: ${totalMessages} (TODOS los mensajes de todas las conversaciones)`
      // );

      // Step 5: Generate summary using SummarizerModel
      if (this.logger) {
        this.logger.info(
          {
            userId,
            chatsCount: chats.length,
          },
          'Calling SummarizerModel to generate profile summary'
        );
      }

      const summaryResponse =
        await this.summarizerModel.generateSummary(summarizerRequest);

      // Step 6: Save incremental summary (plain text)
      const upsertResult = await this.userAIProfileRepository.upsert({
        userId,
        summaryIncremental: summaryResponse.summary, // Plain text string
        summaryEmbedding: null, // Embedding will be generated separately if needed
      });

      if (!upsertResult.success) {
        return failure(upsertResult.error);
      }

      if (this.logger) {
        this.logger.info(
          {
            userId,
            summaryLength: summaryResponse.summary.length,
            provider: summaryResponse.provider,
            model: summaryResponse.model,
          },
          'Incremental summary generated and saved successfully'
        );
      }

      // Step 7: Merge summaries if consolidated summary exists
      const profileAfterIncremental = upsertResult.data;
      const consolidatedSummary = profileAfterIncremental.summary;
      const incrementalSummary = profileAfterIncremental.summaryIncremental;

      if (consolidatedSummary && incrementalSummary) {
        // Both summaries exist - merge them using LLM
        if (this.logger) {
          this.logger.info(
            { userId },
            'Merging consolidated summary with incremental summary'
          );
        }

        const mergeResult = await this.mergeSummaries(
          consolidatedSummary,
          incrementalSummary
        );

        if (!mergeResult.success) {
          // Log error but don't fail - incremental summary is already saved
          if (this.logger) {
            this.logger.error(
              { userId, error: mergeResult.error },
              'Failed to merge summaries, incremental summary saved but merge skipped'
            );
          }
          return success(summaryResponse.summary);
        }

        // Save merged summary and clear incremental
        const finalUpsertResult = await this.userAIProfileRepository.upsert({
          userId,
          summary: mergeResult.data, // Plain text string
          summaryIncremental: null, // Limpiar summaryIncremental
          summaryEmbedding: null,
        });

        if (!finalUpsertResult.success) {
          if (this.logger) {
            this.logger.error(
              { userId, error: finalUpsertResult.error },
              'Failed to save merged summary'
            );
          }
          return failure(finalUpsertResult.error);
        }

        if (this.logger) {
          this.logger.info(
            {
              userId,
              mergedSummaryLength: mergeResult.data.length,
            },
            'Summaries merged and saved successfully, incremental summary cleared'
          );
        }

        return success(mergeResult.data);
      } else if (!consolidatedSummary && incrementalSummary) {
        // First time - copy incremental to summary and clear incremental
        if (this.logger) {
          this.logger.info(
            { userId },
            'First time generating profile - copying incremental to summary'
          );
        }

        const firstTimeUpsertResult = await this.userAIProfileRepository.upsert(
          {
            userId,
            summary: incrementalSummary, // Plain text string
            summaryIncremental: null, // Limpiar incremental
            summaryEmbedding: null,
          }
        );

        if (!firstTimeUpsertResult.success) {
          return failure(firstTimeUpsertResult.error);
        }

        if (this.logger) {
          this.logger.info({ userId }, 'Profile initialized successfully');
        }

        return success(incrementalSummary);
      }

      // No consolidated summary and no incremental (shouldn't happen, but handle gracefully)
      return success(summaryResponse.summary);
    } catch (error) {
      return failure(
        new InternalError(
          'Unexpected error generating user profile from chats',
          error
        )
      );
    }
  }

  /**
   * Transforms ProcessedChatSummary[] to SummarizerRequest format
   * Now unified: all chats (Doc Love and regular users) are treated the same way
   * Preserves senderName so LLM can distinguish who said what
   */
  private transformChatsToSummarizerRequest(
    chats: ProcessedChatSummary[],
    _docLoveUserId: string,
    user: { name?: string; bio?: string; birthDate?: string },
    previousSummary?: string
  ): SummarizerRequest {
    // DISABLED: Detailed transformation logs removed for cleaner production logs
    // console.log(
    //   '[8.5.2] Unificando conversaciones (Doc Love y usuarios regulares)...'
    // );

    // Unified structure: all chats go into userChats with senderName preserved
    const userChats: Array<{
      otherUserId: string;
      otherUserName?: string;
      messages: Array<{
        role: 'user';
        content: string;
        timestamp: Date;
        senderName?: string;
      }>;
    }> = [];

    // Process all chats uniformly (no distinction between Doc Love and regular users)
    for (const chat of chats) {
      // DISABLED: Detailed conversation processing logs removed for cleaner production logs
      // console.log(
      //   `[8.5.2.1] Procesando conversación con ${chat.otherUserName} (${chat.isDocLove ? 'Doc Love' : 'usuario regular'})`
      // );

      // Include ALL messages (from both users) in chronological order
      // Preserve senderName so LLM can distinguish who said what
      const allMessages = chat.messages.map((msg) => ({
        role: 'user' as const,
        content: msg.content,
        timestamp: this.parseTimestamp(msg.timestamp),
        senderName: msg.senderName, // Preserve sender name
      }));

      if (allMessages.length > 0) {
        userChats.push({
          otherUserId: chat.otherUserId,
          otherUserName: chat.otherUserName,
          messages: allMessages,
        });
        // DISABLED: Detailed conversation processing logs removed for cleaner production logs
        // console.log(
        //   `[8.5.2.1] ✅ Conversación procesada: ${allMessages.length} mensajes`
        // );
      }
    }

    // DISABLED: Detailed transformation logs removed for cleaner production logs
    // console.log(
    //   `[8.5.2] ✅ Total conversaciones unificadas: ${userChats.length}`
    // );

    // Calculate age from birthDate if available
    let age: number | undefined;
    if (user.birthDate) {
      const birthDate = new Date(user.birthDate);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age--;
      }
    }

    const newContent: SummarizerRequest['newContent'] = {};
    // All chats now go into userChats (unified structure)
    if (userChats.length > 0) {
      newContent.userChats = userChats;
    }

    const userProfile: SummarizerRequest['userProfile'] = {};
    if (user.name !== undefined) {
      userProfile.name = user.name;
    }
    if (user.bio !== undefined) {
      userProfile.bio = user.bio;
    }
    if (age !== undefined) {
      userProfile.age = age;
    }

    const result: SummarizerRequest = {
      newContent,
    };

    if (previousSummary !== undefined) {
      result.previousSummary = previousSummary;
    }

    if (Object.keys(userProfile).length > 0) {
      result.userProfile = userProfile;
    }

    return result;
  }

  /**
   * Merges two summaries using LLM
   * Uses the mergeSummaries prompt from AIConfig
   */
  private async mergeSummaries(
    consolidatedSummary: string,
    incrementalSummary: string
  ): Promise<Result<string, DomainError>> {
    try {
      // Build merge prompt using centralized configuration
      const mergePrompt = this.buildMergePrompt(
        consolidatedSummary,
        incrementalSummary
      );

      // Call LLM directly with the merge prompt
      const mergedSummaryText = await this.callLLMForMerge(mergePrompt);

      // Return plain text summary (no JSON parsing needed)
      return success(mergedSummaryText.trim());
    } catch (error) {
      return failure(
        new InternalError('Unexpected error merging summaries', error)
      );
    }
  }

  /**
   * Builds merge prompt using centralized configuration
   * Improved prompt to better preserve new information
   */
  private buildMergePrompt(
    consolidatedSummary: string,
    incrementalSummary: string
  ): string {
    // Usamos una intro más genérica o vacía para el merge para evitar confusión con "convertir conversaciones"
    // O simplemente confiamos en que el prompt de merge es suficientemente explícito.
    let prompt = '';

    // Replace placeholders in mergeSummaries prompt
    const mergePrompt = AIConfig.prompt.summarizerInstructions.mergeSummaries
      .replace('{{PROFILE_1}}', consolidatedSummary)
      .replace('{{PROFILE_2}}', incrementalSummary);

    prompt += mergePrompt;

    // LOGGING DEL PROMPT COMPLETO POR CONSOLA (Crucial para debug)
    // DISABLED: Prompts and conversations should NOT be logged to avoid exposing sensitive data
    // console.log('BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');
    // console.log('\n🔀 PROMPT DE MERGE (ANTES DE ENVIAR AL LLM):');
    // console.log('═'.repeat(80));
    // console.log(prompt);
    // console.log('═'.repeat(80));
    // console.log('');

    // LOGGING DEL PROMPT (Crucial para debug)
    if (this.logger) {
      this.logger.debug(
        {
          consolidatedPreview: consolidatedSummary.substring(0, 100),
          incrementalPreview: incrementalSummary.substring(0, 100),
          fullPromptLength: prompt.length,
        },
        'Generando prompt de merge'
      );
    }

    return prompt;
  }

  /**
   * Calls LLM API directly for merging summaries
   * Similar to SummarizerModelOllama.callOllamaAPI but for merge operations
   * Uses larger context and prediction limits for better quality
   * Uses merge-specific temperature from AIConfig.ollama.mergeParameters.temperature
   * Uses dedicated merge model (AI_MODEL_PROFILE_MERGE_RESUMES) instead of summarizer model
   */
  private async callLLMForMerge(prompt: string): Promise<string> {
    // Get configuration from AIConfig (same as SummarizerModel uses)
    const baseUrl = AIConfig.ollama.baseUrl;
    // Use centralized summarization timeout (same as summarization operations)
    const timeout = AIConfig.ollama.summarizationTimeout;
    const mergeParams = AIConfig.ollama.mergeParameters;
    // Use dedicated merge model instead of summarizer model
    // If mergeModelOverride is provided, use it; otherwise use configured model
    const model =
      this.mergeModelOverride || AIConfig.ollama.profileMergeResumesModel;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const requestBody: any = {
        model: model,
        prompt: prompt,
        stream: true,
      };

      // Use merge-specific parameters from configuration
      requestBody.temperature = mergeParams.temperature;
      requestBody.num_predict = mergeParams.num_predict;
      requestBody.num_ctx = mergeParams.num_ctx;

      if (mergeParams.seed !== undefined) {
        requestBody.seed = mergeParams.seed;
      }

      if (mergeParams.top_p !== undefined) {
        requestBody.top_p = mergeParams.top_p;
      }

      if (mergeParams.top_k !== undefined) {
        requestBody.top_k = mergeParams.top_k;
      }

      if (mergeParams.repeat_penalty !== undefined) {
        requestBody.repeat_penalty = mergeParams.repeat_penalty;
      }

      // Consolidated log: LLM call parameters in single line
      const params = [
        `Model: ${model}`,
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
      console.log(`🔧 LLM CALL (Merge - mergeSummaries): ${params}`);

      const response = await fetch(`${baseUrl}/api/generate`, {
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
                return fullResponse.trim();
              }

              if (json.error) {
                clearTimeout(timeoutId);
                throw new Error(`Ollama stream error: ${json.error}`);
              }
            } catch (parseError) {
              if (!(parseError instanceof SyntaxError)) {
                if (this.logger) {
                  this.logger.warn(
                    '[GenerateUserProfileFromChats] Error parsing chunk:',
                    parseError
                  );
                }
              }
            }
          }
        }
      } finally {
        clearTimeout(timeoutId);
        reader.releaseLock();
      }

      return fullResponse.trim();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          throw new Error(`Ollama API timeout after ${timeout}ms`);
        }
        throw error;
      }

      throw new Error('Unknown error calling Ollama API');
    }
  }

  /**
   * Parses timestamp string to Date object
   * Handles format "[DD/MM/YY, HH:MM]" or "[DD/MM/YY, HH:MM:SS]"
   * Supports both padded and unpadded days/months (e.g., "[12/6/23, 18:30:03]" or "[12/06/23, 18:30:03]")
   */
  private parseTimestamp(timestampStr: string): Date {
    // Format is "[DD/MM/YY, HH:MM]" or "[DD/MM/YY, HH:MM:SS]"
    // Extract date and time parts - \d+ matches one or more digits (handles both padded and unpadded)
    const match = timestampStr.match(
      /\[(\d+)\/(\d+)\/(\d+),\s*(\d+):(\d+)(?::(\d+))?\]/
    );

    if (!match) {
      // Fallback to current date if parsing fails
      if (this.logger) {
        this.logger.warn(
          { timestampStr },
          'Failed to parse timestamp, using current date as fallback'
        );
      }
      return new Date();
    }

    const [, day, month, year, hours, minutes, seconds] = match;

    // Validate all required parts exist
    if (!day || !month || !year || !hours || !minutes) {
      if (this.logger) {
        this.logger.warn(
          { timestampStr, match },
          'Failed to parse timestamp - missing required parts, using current date as fallback'
        );
      }
      return new Date();
    }

    const fullYear = 2000 + parseInt(year, 10); // Convert YY to YYYY
    const date = new Date(
      fullYear,
      parseInt(month, 10) - 1, // Month is 0-indexed
      parseInt(day, 10),
      parseInt(hours, 10),
      parseInt(minutes, 10),
      seconds ? parseInt(seconds, 10) : 0
    );

    return date;
  }
}
