import { describe, expect, it } from '@jest/globals';
import { normalizeLanguage } from './normalizeLanguage';

describe('normalizeLanguage', () => {
  it('returns "es" for es and es-*', () => {
    expect(normalizeLanguage('es')).toBe('es');
    expect(normalizeLanguage('es-ES')).toBe('es');
    expect(normalizeLanguage('es-MX')).toBe('es');
    expect(normalizeLanguage('ES')).toBe('es');
  });

  it('returns "en" for en and en-*', () => {
    expect(normalizeLanguage('en')).toBe('en');
    expect(normalizeLanguage('en-US')).toBe('en');
    expect(normalizeLanguage('en-GB')).toBe('en');
    expect(normalizeLanguage('EN')).toBe('en');
  });

  it('returns "en" for other or unknown', () => {
    expect(normalizeLanguage('fr')).toBe('en');
    expect(normalizeLanguage('de')).toBe('en');
    expect(normalizeLanguage('fr-FR')).toBe('en');
  });

  it('returns "en" for empty/undefined', () => {
    expect(normalizeLanguage('')).toBe('en');
    expect(normalizeLanguage(undefined)).toBe('en');
  });
});
