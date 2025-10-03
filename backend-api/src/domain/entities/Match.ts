import { z } from 'zod';

export const MatchSchema = z.object({
  id: z.string().uuid(),
  userId1: z.string().uuid(),
  userId2: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export const CreateMatchSchema = MatchSchema.omit({
  id: true,
  createdAt: true,
});

export type Match = z.infer<typeof MatchSchema>;
export type CreateMatch = z.infer<typeof CreateMatchSchema>;
