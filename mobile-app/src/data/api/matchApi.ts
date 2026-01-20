import { z } from 'zod';
import { ApiClient } from './apiClient';
import { Result } from '../../domain/Result';
import { DomainError } from '../../domain/errors/DomainError';
import { MatchSchema, Match } from '../../domain/entities/Match';
import { MessageSchema } from '../../domain/entities/Message';
import { ValidationError } from '../../domain/errors/DomainError';

const MatchUserSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    bio: z.string().nullable().optional(),
    photoUrl: z.preprocess(
      (val) => {
        if (val === '' || val === undefined) {
          return null;
        }
        return val;
      },
      z.union([z.string().url(), z.null()]).optional().nullable()
    ),
    birthDate: z.string().nullable().optional(),
    gender: z.string().nullable().optional(),
    isBot: z.boolean().optional(),
    show_bio_in_feed: z.boolean().nullable().optional(),
  })
  .nullable();

// More lenient message schema for lastMessage - allows longer content for display purposes
// The backend may return messages that exceed the normal 1000 char limit
const LastMessageSchema = MessageSchema.extend({
  content: z.string().min(1), // Remove max(1000) restriction for display purposes
});

const MatchOverviewSchema = MatchSchema.extend({
  otherUser: MatchUserSchema,
  lastMessage: LastMessageSchema.nullable(),
  unreadCount: z.number().nonnegative(),
});

type MatchOverview = z.infer<typeof MatchOverviewSchema>;

export class MatchApi {
  constructor(private apiClient: ApiClient) {}

  async getMatches(
    token: string
  ): Promise<
    Result<{ matches: MatchOverview[]; activeChatsCount: number }, DomainError>
  > {
    const response = await this.apiClient.get<{
      matches: unknown;
      activeChatsCount: unknown;
    }>('/matches', token);

    if (!response.success) {
      return response;
    }

    const parseResult = z
      .object({
        matches: z.array(MatchOverviewSchema),
        activeChatsCount: z.number().nonnegative(),
      })
      .safeParse(response.data);

    if (!parseResult.success) {
      const errorDetails = parseResult.error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
      console.error('[MatchApi] Validation error details:', errorDetails);
      console.error(
        '[MatchApi] Failed data:',
        JSON.stringify(response.data, null, 2)
      );
      return {
        success: false,
        error: new ValidationError(`Invalid matches payload: ${errorDetails}`),
      };
    }

    return {
      success: true,
      data: parseResult.data,
    };
  }

  async markAsRead(
    matchId: string,
    token: string,
    readAt?: Date
  ): Promise<Result<void, DomainError>> {
    const body = readAt ? { readAt: readAt.toISOString() } : undefined;
    const response = await this.apiClient.put<void>(
      `/matches/${matchId}/read`,
      body,
      token
    );

    if (!response.success) {
      return response;
    }

    return {
      success: true,
      data: undefined,
    };
  }

  async confirmMatch(
    targetUserId: string,
    token: string
  ): Promise<Result<Match, DomainError>> {
    const response = await this.apiClient.post<{ match: unknown }>(
      '/matches/confirm',
      { targetUserId },
      token
    );

    if (!response.success) {
      return response;
    }

    // Backend only returns a basic Match (id, userId1, userId2, createdAt)
    // We'll construct the full MatchWithUser in the component
    const parseResult = MatchSchema.safeParse(response.data.match);

    if (!parseResult.success) {
      const errorDetails = parseResult.error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
      return {
        success: false,
        error: new ValidationError(`Invalid match payload: ${errorDetails}`),
      };
    }

    return {
      success: true,
      data: parseResult.data,
    };
  }
}
