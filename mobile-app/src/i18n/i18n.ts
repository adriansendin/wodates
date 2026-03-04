import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import esCommon from './locales/es/common.json';

import { normalizeLanguage, SUPPORTED_LANGS } from './normalizeLanguage';

export { normalizeLanguage, SUPPORTED_LANGS };
export type { SupportedLng } from './normalizeLanguage';

let initialized = false;

/**
 * Initializes i18n once. Idempotent: safe to call multiple times.
 * Call before first render to avoid language flicker.
 * Resources are loaded synchronously so no async flicker.
 */
export function initI18n(): void {
  if (initialized) return;
  initialized = true;

  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      supportedLngs: [...SUPPORTED_LANGS],
      fallbackLng: 'en',
      resources: {
        en: { common: enCommon },
        es: { common: esCommon },
      },
      defaultNS: 'common',
      ns: ['common'],
      interpolation: {
        escapeValue: false,
      },
      detection: {
        order: ['navigator'],
        lookupLocalStorage: undefined,
        caches: [],
      },
      react: {
        useSuspense: false,
      },
    });

  i18n.on('languageDetected', (lng: string) => {
    const normalized = normalizeLanguage(lng);
    if (i18n.language !== normalized) {
      i18n.changeLanguage(normalized);
    }
  });

  const detected = i18n.language ?? '';
  const normalized = normalizeLanguage(detected);
  if (normalized !== i18n.language) {
    i18n.changeLanguage(normalized);
  }
}

export default i18n;
