import { z } from 'zod';

export const ContactUsMessageSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  content: z.string(),
  createdAt: z.string().datetime(),
});

export const CreateContactUsMessageSchema = z.object({
  userId: z.string().uuid(),
  content: z
    .string()
    .transform((val) => val.trim())
    .min(10, 'Message must be at least 10 characters')
    .max(300, 'Message must be at most 300 characters'),
});

export type ContactUsMessage = z.infer<typeof ContactUsMessageSchema>;
export type CreateContactUsMessage = z.infer<
  typeof CreateContactUsMessageSchema
>;

