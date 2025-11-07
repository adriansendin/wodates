import { z } from 'zod';
import { ApiClient } from './apiClient';
import { Result } from '../../domain/Result';
import { DomainError } from '../../domain/errors/DomainError';
import { MatchSchema } from '../../domain/entities/Match';
import { MessageSchema } from '../../domain/entities/Message';
import { ValidationError } from '../../domain/errors/DomainError';

const MatchUserSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    bio: z.string().nullable().optional(),
    photoUrl: z.string().url().nullable().optional(),
    birthDate: z.string().nullable().optional(),
    gender: z.string().nullable().optional(),
  })
  .nullable();

const MatchOverviewSchema = MatchSchema.extend({
  otherUser: MatchUserSchema,
  lastMessage: MessageSchema.nullable(),
  unreadCount: z.number().nonnegative(),
});

type MatchOverview = z.infer<typeof MatchOverviewSchema>;

export class MatchApi {
  constructor(private apiClient: ApiClient) {}

  async getMatches(
    token: string,
  ): Promise<Result<{ matches: MatchOverview[]; activeChatsCount: number }, DomainError>> {
    const response = await this.apiClient.get<{ matches: unknown; activeChatsCount: unknown }>(
      '/matches',
      token,
    );

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
      return { success: false, error: new ValidationError('Invalid matches payload') };
    }

    return {
      success: true,
      data: parseResult.data,
    };
  }
}
