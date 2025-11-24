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

/**
 * BlockedUser entity represents when one user blocks another user.
 * Once blocked, users can no longer see each other's matches or communicate.
 *
 * Table: public.blocked_users
 * - blocker_id: User who initiated the block (part of composite PK)
 * - blocked_id: User who was blocked (part of composite PK)
 * - created_at: When the block occurred
 *
 * Note: Uses composite primary key (blocker_id, blocked_id) instead of separate id
 */
export const BlockedUserSchema = z.object({
  blockerId: z.string().uuid(),
  blockedId: z.string().uuid(),
  createdAt: SupabaseTimestampSchema,
});

export const CreateBlockedUserSchema = BlockedUserSchema.omit({
  createdAt: true,
});

export type BlockedUser = z.infer<typeof BlockedUserSchema>;
export type CreateBlockedUser = z.infer<typeof CreateBlockedUserSchema>;
