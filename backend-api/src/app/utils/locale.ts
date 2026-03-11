import { FastifyRequest } from 'fastify';
import { Locale, normalizeLocale } from '../ai/ai-settings';

export { normalizeLocale };

/**
 * Gets the user's preferred locale from the request.
 * Checks, in order: body.locale (for POST), X-App-Locale header, Accept-Language header, then defaults to 'en'.
 */
export function getLocaleFromRequest(
  request: FastifyRequest,
  bodyLocale?: string | null
): Locale {
  if (bodyLocale !== undefined && bodyLocale !== null) {
    return normalizeLocale(bodyLocale);
  }
  const header =
    (request.headers['x-app-locale'] as string) ??
    (request.headers['accept-language'] as string);
  return normalizeLocale(header ?? undefined);
}
