import { z } from 'zod';

export const MessageSchema = z.object({
  id: z.string().uuid(),
  matchId: z.string().uuid(),
  senderId: z.string().uuid(),
  content: z.string().min(1).max(500),
  createdAt: z.string().datetime(),
  profileProcessedAt: z.string().datetime().nullable().optional(),
});

export const CreateMessageSchema = MessageSchema.omit({
  id: true,
  createdAt: true,
});

export type Message = z.infer<typeof MessageSchema>;
export type CreateMessage = z.infer<typeof CreateMessageSchema>;
