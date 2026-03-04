# i18n (Internationalization)

Minimal i18n for the mobile app: **es** and **en**, with transparent browser language detection and no language selector (for now).

## How it works

- **Entry**: `app/_layout.tsx` imports `../src/i18n/init` first so i18n is initialized before any screen renders (no flicker).
- **Detection**: On web, the browser language is read (`navigator`). `es-*` → `es`, `en-*` → `en`, anything else → `en`.
- **Usage**: Use `useTranslation('common')` and `t('app.title')`, `t('auth.login')`, etc.

## Adding a new key

1. Add the key to both:
   - `src/i18n/locales/es/common.json`
   - `src/i18n/locales/en/common.json`
2. Use it in the app: `t('section.key')` (with namespace `common` by default).

Missing keys fall back to the key path or `fallbackLng` (`en`), so the app won’t break.

## Adding a new language (later)

1. Create `src/i18n/locales/<code>/common.json` with the same structure as `es`/`en`.
2. In `src/i18n/i18n.ts`:
   - Add the code to `SUPPORTED_LANGS`.
   - Import the new JSON and add it to `resources` in `init()`.
   - Extend `normalizeLanguage()` to map the new locale (e.g. `fr-*` → `fr`).
3. No UI change required until you add a language selector.

## Manual testing

- **Web**: Change the browser language (Chrome: Settings → Languages) and reload. Spanish → `es`, English (or other) → `en`.
- **Chrome DevTools**: Application → Storage → clear site data, then override Accept-Language in Network conditions or via a custom profile to test `es` vs `en`.
