/** Allowed chronological age for users (birth date validation). */
export const USER_BIRTH_AGE_MIN = 29;
export const USER_BIRTH_AGE_MAX = 65;

/**
 * Whole years of age from ISO-8601 datetime string (UTC calendar date).
 */
export function ageFromIsoDateTime(iso: string): number | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  const y = parsed.getUTCFullYear();
  const birthMonth = parsed.getUTCMonth();
  const birthDay = parsed.getUTCDate();
  const now = new Date();
  let age = now.getUTCFullYear() - y;
  const monthDiff = now.getUTCMonth() - birthMonth;
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birthDay)) {
    age--;
  }
  return age;
}

/**
 * Whole years of age from YYYY-MM-DD (UTC calendar date).
 */
export function ageFromYmd(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const birthMonth = mo - 1;
  const now = new Date();
  let age = now.getUTCFullYear() - y;
  const monthDiff = now.getUTCMonth() - birthMonth;
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < d)) {
    age--;
  }
  return age;
}
