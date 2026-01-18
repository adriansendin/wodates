import { z } from 'zod';

/**
 * Family Plan preferences
 *
 * These enums represent fixed values that cannot be extended.
 * Any changes require database migration.
 */

// Wants children preference
export const WANTS_CHILDREN_VALUES = ['yes', 'no', 'not_sure'] as const;
export const WantsChildrenSchema = z.enum(WANTS_CHILDREN_VALUES);
export type WantsChildren = z.infer<typeof WantsChildrenSchema>;

// Cares about partner having children
export const CARES_ABOUT_PARTNER_CHILDREN_VALUES = ['yes', 'no'] as const;
export const CaresAboutPartnerChildrenSchema = z.enum(
  CARES_ABOUT_PARTNER_CHILDREN_VALUES
);
export type CaresAboutPartnerChildren = z.infer<
  typeof CaresAboutPartnerChildrenSchema
>;
