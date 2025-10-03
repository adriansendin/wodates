import { z } from 'zod';

export const PassSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export const CreatePassSchema = PassSchema.omit({
  id: true,
  createdAt: true,
});

export type Pass = z.infer<typeof PassSchema>;
export type CreatePass = z.infer<typeof CreatePassSchema>;
