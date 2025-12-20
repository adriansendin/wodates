import { z } from 'zod';

export const QuestionBankSchema = z.object({
  id: z.number().int().positive(),
  category: z.string().min(1),
  question: z.string().min(1),
  createdAt: z.string().datetime(),
  deprecated: z.boolean(),
});

export const CreateQuestionBankSchema = QuestionBankSchema.omit({
  id: true,
  createdAt: true,
});

export const UpdateQuestionBankSchema =
  CreateQuestionBankSchema.partial().extend({
    deprecated: z.boolean().optional(),
  });

export type QuestionBank = z.infer<typeof QuestionBankSchema>;
export type CreateQuestionBank = z.infer<typeof CreateQuestionBankSchema>;
export type UpdateQuestionBank = z.infer<typeof UpdateQuestionBankSchema>;
