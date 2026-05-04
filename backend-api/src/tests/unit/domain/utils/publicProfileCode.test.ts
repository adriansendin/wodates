import { describe, expect, it } from 'vitest';
import {
  buildPublicProfileCode,
  slugifyDisplayNameForProfileCode,
} from '../../../../domain/utils/publicProfileCode';

describe('publicProfileCode', () => {
  it('slugify keeps ascii letters, digits, underscore, hyphen and lowercases', () => {
    expect(slugifyDisplayNameForProfileCode('María-José_2')).toBe(
      'maria-jose_2'
    );
  });

  it('slugify strips diacritics and non-slug chars', () => {
    expect(slugifyDisplayNameForProfileCode('  José  ')).toBe('jose');
  });

  it('slugify uses "user" when nothing left', () => {
    expect(slugifyDisplayNameForProfileCode('!!!')).toBe('user');
  });

  it('buildPublicProfileCode appends 3-digit suffix', () => {
    expect(buildPublicProfileCode('Anna', 7)).toBe('anna007');
    expect(buildPublicProfileCode('Anna', 999)).toBe('anna999');
    expect(buildPublicProfileCode('Anna', 1000)).toBe('anna999');
    expect(buildPublicProfileCode('Anna', -1)).toBe('anna000');
  });
});
