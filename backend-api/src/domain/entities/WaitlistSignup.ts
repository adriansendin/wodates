import { z } from 'zod';

export const WaitlistSignupSchema = z.object({
  id: z.string().uuid(),
  city: z.string().min(1).max(80),
  email: z.string().email().max(254),
  createdAt: z.string().datetime(),
});

export const CreateWaitlistSignupSchema = z.object({
  city: z
    .string()
    .min(1, 'City is required')
    .max(80, 'City must be at most 80 characters')
    .transform((val) => val.trim()),
  email: z
    .string()
    .email('Invalid email format')
    .max(254, 'Email must be at most 254 characters')
    .transform((val) => val.trim().toLowerCase()),
});

export type WaitlistSignup = z.infer<typeof WaitlistSignupSchema>;
export type CreateWaitlistSignup = z.infer<typeof CreateWaitlistSignupSchema>;
