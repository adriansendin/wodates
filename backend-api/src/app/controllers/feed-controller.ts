import { FastifyRequest, FastifyReply } from 'fastify';
import { LikeUser } from '../../domain/use-cases/feed/LikeUser';
import { PassUser } from '../../domain/use-cases/feed/PassUser';
import { DomainError } from '../../domain/errors/DomainError';
import { z } from 'zod';
import { SupabaseFeedService } from '../services/supabase-feed-service';
import { AiServiceChatClient } from '../ai/clients/AiServiceChatClient';
import { SupabaseUserAIProfileRepository } from '../../data/repositories/SupabaseUserAIProfileRepository';
import { AIConfig } from '../ai/ai-settings';

const LikeSchema = z.object({
  targetUserId: z.string().uuid(),
});

const PassSchema = z.object({
  targetUserId: z.string().uuid(),
});

const FeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export class FeedController {
  private readonly aiServiceChatClient: AiServiceChatClient;
  private readonly userAIProfileRepository: SupabaseUserAIProfileRepository;

  private readonly logger?: any;

  constructor(
    private readonly feedService: SupabaseFeedService,
    private likeUserUseCase: LikeUser,
    private passUserUseCase: PassUser,
    logger?: any
  ) {
    this.logger = logger;
    // Use timeout for feed operations (60 seconds to allow model to respond)
    // Note: If model is slow, fallback will be used
    this.aiServiceChatClient = new AiServiceChatClient(
      undefined, // Use default from AIConfig
      60000, // 60 seconds timeout for feed operations (allows model time to respond)
      logger
    );
    this.userAIProfileRepository = new SupabaseUserAIProfileRepository();
  }

  async getFeed(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      const { limit = 10, offset = 0 } = FeedQuerySchema.parse(request.query);

      const candidates = await this.feedService.getFeedCandidates(
        userId,
        limit,
        offset
      );

      return reply.send({
        users: candidates,
        pagination: {
          limit,
          offset,
          hasMore: candidates.length === limit,
        },
      });
    } catch (error) {
      if (error instanceof DomainError) {
        return this.handleError(reply, error);
      }
      return this.handleValidationError(reply, error);
    }
  }

  async likeUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      const { targetUserId } = LikeSchema.parse(request.body);

      const result = await this.likeUserUseCase.execute(userId, targetUserId);

      if (result.success) {
        return reply.send({
          action: 'like',
          result: result.data,
          isMatch: 'userId1' in result.data, // Check if it's a Match entity
        });
      } else {
        return this.handleError(reply, result.error);
      }
    } catch (error) {
      return this.handleValidationError(reply, error);
    }
  }

  async passUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      const { targetUserId } = PassSchema.parse(request.body);

      const result = await this.passUserUseCase.execute(userId, targetUserId);

      if (result.success) {
        return reply.send({
          action: 'pass',
          result: result.data,
        });
      } else {
        return this.handleError(reply, result.error);
      }
    } catch (error) {
      return this.handleValidationError(reply, error);
    }
  }

  private handleError(reply: FastifyReply, error: DomainError) {
    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message,
      details: error.details,
    });
  }

  async getAffinitySentences(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Check if affinity sentences feature is enabled
      if (!AIConfig.affinitySentencesEnabled) {
        // Feature disabled: return empty array immediately without executing anything
        return reply.send({
          sentences: [],
        });
      }

      const userId = request.user!.id;
      const { candidateId } = z
        .object({ candidateId: z.string().uuid() })
        .parse(request.params);

      // Get AI profiles for both users
      const [currentUserProfileResult, candidateProfileResult] =
        await Promise.all([
          this.userAIProfileRepository.findByUserId(userId),
          this.userAIProfileRepository.findByUserId(candidateId),
        ]);

      // Check if we have both profiles
      if (
        !currentUserProfileResult.success ||
        !currentUserProfileResult.data?.summary ||
        !candidateProfileResult.success ||
        !candidateProfileResult.data?.summary
      ) {
        // Log missing profiles but don't show anything visually
        if (this.logger) {
          this.logger.warn(
            {
              userId,
              candidateId,
              currentUserHasProfile: !!(
                currentUserProfileResult.success &&
                currentUserProfileResult.data?.summary
              ),
              candidateHasProfile: !!(
                candidateProfileResult.success &&
                candidateProfileResult.data?.summary
              ),
            },
            'Missing AI profiles for affinity sentences, returning empty array'
          );
        }
        return reply.send({
          sentences: [],
        });
      }

      const currentUserProfile = currentUserProfileResult.data.summary;
      const candidateProfile = candidateProfileResult.data.summary;

      // Build complete prompt in backend (following chat pattern)
      const fullPrompt = AIConfig.prompt.affinitySentences.buildPrompt(
        currentUserProfile,
        candidateProfile
      );

      // Call ai-service chat endpoint with the complete prompt
      // Following the same pattern as DocLove chat - backend builds prompt, ai-service just calls LLM
      // Use the affinity sentences model from config
      const affinityModel = process.env.OLLAMA_AFFINITY || 'gemma3:1b';

      if (this.logger) {
        this.logger.debug(
          {
            userId,
            candidateId,
            model: affinityModel,
            promptLength: fullPrompt.length,
          },
          'Generating affinity sentences'
        );
      }

      try {
        const response = await this.aiServiceChatClient.generateChat({
          messages: [{ role: 'user', content: fullPrompt }],
          // No system prompt needed, everything is in the user message
          model: affinityModel, // Use the configured model for affinity sentences
        });

        // Parse and validate the response
        const sentences = this.parseAffinitySentences(response.content);

        if (this.logger) {
          this.logger.debug(
            {
              userId,
              candidateId,
              sentencesCount: sentences.length,
              rawResponseLength: response.content.length,
            },
            'Affinity sentences generated'
          );
        }

        if (sentences.length >= 2) {
          return reply.send({
            sentences: sentences.slice(0, 2), // Ensure exactly 2 sentences
          });
        } else {
          // If parsing resulted in less than 2 sentences, return empty array
          if (this.logger) {
            this.logger.warn(
              {
                userId,
                candidateId,
                parsedCount: sentences.length,
                rawResponse: response.content.substring(0, 200),
              },
              'Parsed less than 2 sentences, returning empty array'
            );
          }
          return reply.send({
            sentences: [],
          });
        }
      } catch (error) {
        // If ai-service fails, return empty array (non-blocking)
        // Log error for debugging but don't show anything visually
        if (this.logger) {
          this.logger.warn(
            {
              userId,
              candidateId,
              error: error instanceof Error ? error.message : String(error),
            },
            'Failed to generate affinity sentences, returning empty array'
          );
        }
        return reply.send({
          sentences: [],
        });
      }
    } catch (error) {
      if (error instanceof DomainError) {
        return this.handleError(reply, error);
      }
      return this.handleValidationError(reply, error);
    }
  }

  /**
   * Parses affinity sentences from LLM response
   * Handles various formats: one per line, numbered lists, bullet points
   * Returns exactly 2 sentences (as per updated prompt requirement)
   */
  private parseAffinitySentences(text: string): string[] {
    // Remove common prefixes and markers
    const cleaned = text
      .replace(/^\d+[.)]\s*/gm, '') // Remove numbering
      .replace(/^[-•*]\s*/gm, '') // Remove bullets
      .trim();

    // Split by newlines first
    const lines = cleaned
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return [];
    }

    const sentences: string[] = [];
    for (const line of lines) {
      // Split by periods if line is too long
      if (line.includes('.') && line.split(/\s+/).length > 15) {
        const parts = line
          .split('.')
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
          .map((p) => (p.endsWith('.') ? p : p + '.'));
        sentences.push(...parts);
      } else {
        // Ensure sentence ends with period
        const sentence =
          line.endsWith('.') || line.endsWith('!') || line.endsWith('?')
            ? line
            : line + '.';
        sentences.push(sentence);
      }
    }

    // Filter and validate: max 12 words per sentence, take exactly 2 sentences
    const validated = sentences
      .filter((s) => s.split(/\s+/).length > 0)
      .map((s) => {
        const words = s.split(/\s+/);
        if (words.length > 12) {
          return words.slice(0, 12).join(' ') + '.';
        }
        return s;
      })
      .slice(0, 2); // Take exactly 2 sentences (updated requirement)

    return validated;
  }

  private handleValidationError(reply: FastifyReply, error: unknown) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: error,
    });
  }
}
