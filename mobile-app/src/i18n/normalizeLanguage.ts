export const SUPPORTED_LANGS = ['es', 'en'] as const;
export type SupportedLng = (typeof SUPPORTED_LANGS)[number];

/**
 * Normalizes browser/device language to a supported app language.
 * es-* => es, en-* => en, anything else => en.
 */
export function normalizeLanguage(lang: string | undefined): SupportedLng {
  if (!lang || typeof lang !== 'string') return 'en';
  const lower = lang.toLowerCase().trim();
  if (lower.startsWith('es')) return 'es';
  if (lower.startsWith('en')) return 'en';
  return 'en';
}
