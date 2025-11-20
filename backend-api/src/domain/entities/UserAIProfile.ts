import { z } from 'zod';

/**
 * UserAIProfile entity
 * 
 * Represents a consolidated AI profile for a user with personality summary
 * and vector embedding for matching by affinity. 1:1 relationship with users.
 */
export const UserAIProfileSchema = z.object({
  userId: z.string().uuid(),
  summary: z.string().nullable(),
  summaryUpdatedAt: z.string().datetime(),
  summaryEmbedding: z.array(z.number()).length(768).nullable(),
});

export const CreateUserAIProfileSchema = z.object({
  userId: z.string().uuid(),
  summary: z.string().nullable().optional(),
  summaryEmbedding: z.array(z.number()).length(768).nullable().optional(),
});

export const UpdateUserAIProfileSchema = z.object({
  summary: z.string().nullable().optional(),
  summaryEmbedding: z.array(z.number()).length(768).nullable().optional(),
});

export type UserAIProfile = z.infer<typeof UserAIProfileSchema>;
export type CreateUserAIProfile = z.infer<typeof CreateUserAIProfileSchema>;
export type UpdateUserAIProfile = z.infer<typeof UpdateUserAIProfileSchema>;

