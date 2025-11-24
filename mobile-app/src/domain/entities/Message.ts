import { z } from 'zod';

// More lenient datetime validation that accepts ISO 8601 or tries to parse and convert
const DateTimeSchema = z
  .string()
  .refine(
    (val) => {
      // Try to parse as ISO 8601 first
      if (z.string().datetime().safeParse(val).success) {
        return true;
      }
      // Try to parse as a date and convert to ISO
      const date = new Date(val);
      return !isNaN(date.getTime());
    },
    { message: 'Invalid datetime format' }
  )
  .transform((val) => {
    // If it's already valid ISO 8601, return as is
    if (z.string().datetime().safeParse(val).success) {
      return val;
    }
    // Otherwise, try to convert to ISO 8601
    const date = new Date(val);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    return val;
  });

export const MessageSchema = z.object({
  id: z.string().uuid(),
  matchId: z.string().uuid(),
  senderId: z.string().uuid(),
  content: z.string().min(1).max(1000),
  createdAt: DateTimeSchema,
  profileProcessedAt: DateTimeSchema.nullable().optional(),
});

export const CreateMessageSchema = MessageSchema.omit({
  id: true,
  createdAt: true,
});

export type Message = z.infer<typeof MessageSchema>;
export type CreateMessage = z.infer<typeof CreateMessageSchema>;
