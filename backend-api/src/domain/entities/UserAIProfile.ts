import { z } from 'zod';

/**
 * UserAIProfile entity
 *
 * Represents a consolidated AI profile for a user with personality summary
 * and vector embedding for matching by affinity. 1:1 relationship with users.
 *
 * Note: The embedding dimension (768) matches AIModelConstants.EMBEDDING.DIMENSION
 * from ai-settings.ts. This must match the database schema (vector(768)) and
 * the embedding model configuration.
 *
 * Summary fields are stored as JSONB in the database with structure: { text: string }
 */
const SummaryJsonSchema = z.object({
  text: z.string(),
});

export const UserAIProfileSchema = z.object({
  userId: z.string().uuid(),
  summary: SummaryJsonSchema.nullable(),
  summaryIncremental: SummaryJsonSchema.nullable(),
  summaryUpdatedAt: z.string().datetime(),
  summaryEmbedding: z.array(z.number()).length(768).nullable(), // Must match AIModelConstants.EMBEDDING.DIMENSION
});

export const CreateUserAIProfileSchema = z.object({
  userId: z.string().uuid(),
  summary: SummaryJsonSchema.nullable().optional(),
  summaryIncremental: SummaryJsonSchema.nullable().optional(),
  summaryEmbedding: z.array(z.number()).length(768).nullable().optional(), // Must match AIModelConstants.EMBEDDING.DIMENSION
});

export const UpdateUserAIProfileSchema = z.object({
  summary: SummaryJsonSchema.nullable().optional(),
  summaryIncremental: SummaryJsonSchema.nullable().optional(),
  summaryEmbedding: z.array(z.number()).length(768).nullable().optional(), // Must match AIModelConstants.EMBEDDING.DIMENSION
});

export type UserAIProfile = z.infer<typeof UserAIProfileSchema>;
export type CreateUserAIProfile = z.infer<typeof CreateUserAIProfileSchema>;
export type UpdateUserAIProfile = z.infer<typeof UpdateUserAIProfileSchema>;
