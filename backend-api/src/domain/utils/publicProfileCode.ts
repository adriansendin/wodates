/**
 * Builds a stable public profile code: alphanumeric/underscore slug from the display name
 * plus a 3-digit suffix in [000, 999].
 */
const MAX_BASE_LENGTH = 45;

export function slugifyDisplayNameForProfileCode(displayName: string): string {
  const trimmed =
    typeof displayName === 'string' ? displayName.trim() : '';
  const ascii = trimmed
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
  const slug = ascii
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase()
    .slice(0, MAX_BASE_LENGTH);
  return slug.length > 0 ? slug : 'user';
}

export function buildPublicProfileCode(
  displayName: string,
  suffix0to999: number
): string {
  const base = slugifyDisplayNameForProfileCode(displayName);
  const n = Math.min(999, Math.max(0, Math.floor(suffix0to999)));
  return `${base}${String(n).padStart(3, '0')}`;
}

/** Uniform integer in [0, 999] inclusive. */
export function randomPublicProfileSuffix(): number {
  return Math.floor(Math.random() * 1000);
}
