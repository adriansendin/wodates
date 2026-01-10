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
 * UserAskedQuestion entity represents when a question from question_bank
 * has been asked to a user.
 *
 * Table: public.user_asked_questions
 * - user_id: User who was asked the question (part of composite PK)
 * - question_id: Question from question_bank that was asked (part of composite PK)
 * - asked_at: When the question was asked
 *
 * Note: Uses composite primary key (user_id, question_id) to prevent duplicates.
 * This only tracks that a question was asked, not whether it was answered.
 */
export const UserAskedQuestionSchema = z.object({
  userId: z.string().uuid(),
  questionId: z.number().int().positive(),
  askedAt: SupabaseTimestampSchema,
});

export const CreateUserAskedQuestionSchema = UserAskedQuestionSchema.omit({
  askedAt: true,
});

export type UserAskedQuestion = z.infer<typeof UserAskedQuestionSchema>;
export type CreateUserAskedQuestion = z.infer<
  typeof CreateUserAskedQuestionSchema
>;
