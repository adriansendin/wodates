import { z } from 'zod';
import { GenderSchema } from './Gender';
import { LookingForSchema } from './LookingFor';

export const VerificationStatusSchema = z.enum([
  'pending', // nunca ha enviado
  'verifying', // selfie enviada, esperando revisión
  'verified',
  'rejected',
]);

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  birthDate: z.string().min(4).nullable(),
  gender: GenderSchema.nullable(),
  looking_for: LookingForSchema.nullable(),
  min_age: z.number().int().nullable(),
  max_age: z.number().int().nullable(),
  bio: z.string().nullable(),
  city: z.string().nullable(),
  show_bio_in_feed: z.boolean().nullable(),
  verification_status: VerificationStatusSchema.default('pending'),
  // Family plan
  has_children: z.boolean().nullable(),
  wants_children: z.enum(['yes', 'no', 'not_sure']).nullable(),
  cares_about_partner_children: z.enum(['yes', 'no']).nullable(),
  // Habits
  smoking: z.enum(['no', 'occasionally', 'regularly']).nullable(),
  cares_about_partner_smoking: z.enum(['yes', 'no']).nullable(),
});

export const UpdateUserProfileSchema = z.object({
  name: z.string().max(100).nullable().optional(),
  birthDate: z.string().nullable().optional(),
  gender: GenderSchema.nullable().optional(),
  looking_for: LookingForSchema.nullable().optional(),
  min_age: z.number().int().nullable().optional(),
  max_age: z.number().int().nullable().optional(),
  bio: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  show_bio_in_feed: z.boolean().nullable().optional(),
  // Family plan
  has_children: z.boolean().nullable().optional(),
  wants_children: z.enum(['yes', 'no', 'not_sure']).nullable().optional(),
  cares_about_partner_children: z.enum(['yes', 'no']).nullable().optional(),
  // Habits
  smoking: z.enum(['no', 'occasionally', 'regularly']).nullable().optional(),
  cares_about_partner_smoking: z.enum(['yes', 'no']).nullable().optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UpdateUserProfile = z.infer<typeof UpdateUserProfileSchema>;
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;
