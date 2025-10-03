import { z } from 'zod';

export const LikeSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export const CreateLikeSchema = LikeSchema.omit({
  id: true,
  createdAt: true,
});

export type Like = z.infer<typeof LikeSchema>;
export type CreateLike = z.infer<typeof CreateLikeSchema>;
