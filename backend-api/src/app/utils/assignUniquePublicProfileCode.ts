import type { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { InternalError } from '../../domain/errors/DomainError';
import {
  buildPublicProfileCode,
  randomPublicProfileSuffix,
  slugifyDisplayNameForProfileCode,
} from '../../domain/utils/publicProfileCode';

const MAX_RANDOM_ATTEMPTS = 48;

async function isPublicProfileCodeTaken(
  client: SupabaseClient,
  code: string
): Promise<boolean> {
  const { data, error } = await client
    .from('users')
    .select('id')
    .eq('public_profile_code', code)
    .maybeSingle();

  if (error) {
    throw new InternalError(
      'Failed to check public profile code uniqueness',
      error
    );
  }

  return data != null;
}

/**
 * Reserves a unique `public.users.public_profile_code` before insert/update.
 */
export async function assignUniquePublicProfileCode(
  client: SupabaseClient,
  displayName: string
): Promise<string> {
  const seed =
    typeof displayName === 'string' && displayName.trim().length > 0
      ? displayName
      : 'user';

  for (let i = 0; i < MAX_RANDOM_ATTEMPTS; i++) {
    const candidate = buildPublicProfileCode(seed, randomPublicProfileSuffix());
    const taken = await isPublicProfileCodeTaken(client, candidate);
    if (!taken) {
      return candidate;
    }
  }

  const base = slugifyDisplayNameForProfileCode(seed);
  for (let j = 0; j < 16; j++) {
    const hex = randomBytes(4).toString('hex');
    const candidate = `${base}${hex}`.slice(0, 48);
    const taken = await isPublicProfileCodeTaken(client, candidate);
    if (!taken) {
      return candidate;
    }
  }

  throw new InternalError(
    'Could not allocate a unique public_profile_code after retries'
  );
}
