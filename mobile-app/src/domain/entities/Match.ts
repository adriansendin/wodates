import { z } from 'zod';

const SupabaseTimestampSchema = z.string().transform((value, ctx) => {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid timestamp',
    });
    return z.NEVER;
  }

  return new Date(timestamp).toISOString();
});

export const MatchSchema = z.object({
  id: z.string().uuid(),
  userId1: z.string().uuid(),
  userId2: z.string().uuid(),
  createdAt: SupabaseTimestampSchema,
});

export const CreateMatchSchema = MatchSchema.omit({
  id: true,
  createdAt: true,
});

export type Match = z.infer<typeof MatchSchema>;
export type CreateMatch = z.infer<typeof CreateMatchSchema>;
