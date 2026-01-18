import { z } from 'zod';

/**
 * Habits preferences
 *
 * These enums represent fixed values that cannot be extended.
 * Any changes require database migration.
 */

// Smoking preference
export const SMOKING_VALUES = ['no', 'occasionally', 'regularly'] as const;
export const SmokingSchema = z.enum(SMOKING_VALUES);
export type Smoking = z.infer<typeof SmokingSchema>;

// Cares about partner smoking
export const CARES_ABOUT_PARTNER_SMOKING_VALUES = ['yes', 'no'] as const;
export const CaresAboutPartnerSmokingSchema = z.enum(
  CARES_ABOUT_PARTNER_SMOKING_VALUES
);
export type CaresAboutPartnerSmoking = z.infer<
  typeof CaresAboutPartnerSmokingSchema
>;
