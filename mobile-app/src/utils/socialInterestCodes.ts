/** Alfanumérico, guiones y guiones bajos; mismo criterio que la API. */
export const SOCIAL_PROFILE_INTEREST_CODE_REGEX =
  /^[A-Za-z0-9_-]{2,48}$/;

/**
 * Dedupa (sin distinguir mayúsculas), recorta y limita a 3 entradas.
 */
export function normalizeSocialInterestCodes(codes: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of codes) {
    if (typeof raw !== 'string') continue;
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t.slice(0, 48));
    if (out.length >= 3) break;
  }
  return out;
}

/** Vacío es válido (campo opcional); si tiene texto debe cumplir el formato. */
export function isValidSocialInterestCodeInput(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  return SOCIAL_PROFILE_INTEREST_CODE_REGEX.test(t);
}

export function tripleFromStoredCodes(codes?: string[]): [string, string, string] {
  const arr = [...(codes ?? [])];
  return [(arr[0] ?? '').trim(), (arr[1] ?? '').trim(), (arr[2] ?? '').trim()];
}
