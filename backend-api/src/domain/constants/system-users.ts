/**
 * System Users Constants
 * 
 * Constants for identifying system users (bots) in the application.
 * These users are excluded from normal user flows like feed, statistics, etc.
 */

/**
 * Email address for Doc Love, the AI assistant bot
 */
export const DOC_LOVE_EMAIL = process.env.DOC_LOVE_EMAIL || 'doclove@wodates.com';

/**
 * Type guard to check if an email belongs to a system user
 */
export function isSystemUserEmail(email: string): boolean {
  return email === DOC_LOVE_EMAIL;
}

