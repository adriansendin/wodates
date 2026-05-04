/**
 * Rellena `public.users.public_profile_code` para usuarios activos (auth.users.deleted_at IS NULL)
 * usando la misma lógica que el registro (`assignUniquePublicProfileCode`).
 *
 * Solo actualiza filas donde el código falta (NULL o solo espacios). No sobrescribe códigos existentes.
 *
 * Uso:
 *   npx tsx scripts/working/backfill-public-profile-codes.ts
 *   npx tsx scripts/working/backfill-public-profile-codes.ts --dry-run
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { assignUniquePublicProfileCode } from '../../src/app/utils/assignUniquePublicProfileCode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const dryRun =
  process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';

const MAX_UPDATE_ATTEMPTS = 8;

function isUniqueViolation(err: {
  code?: string;
  message?: string;
}): boolean {
  return (
    err.code === '23505' ||
    (typeof err.message === 'string' &&
      err.message.toLowerCase().includes('duplicate'))
  );
}

function needsPublicProfileCode(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== 'string') return true;
  return value.trim().length === 0;
}

function displayNameSeedFromAuthUser(user: {
  email?: string;
  user_metadata?: { display_name?: string };
}): string {
  const fromMeta =
    typeof user.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name.trim()
      : '';
  if (fromMeta.length > 0) return fromMeta;
  const email = typeof user.email === 'string' ? user.email.trim() : '';
  if (email.length > 0) return email;
  return 'user';
}

async function fetchAllNonDeletedAuthUserIds(
  supabase: SupabaseClient
): Promise<
  Map<
    string,
    { email?: string; user_metadata?: { display_name?: string } }
  >
> {
  const byId = new Map<
    string,
    { email?: string; user_metadata?: { display_name?: string } }
  >();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      throw new Error(`listUsers page ${page}: ${error.message}`);
    }
    const users = data?.users ?? [];
    for (const u of users) {
      const deletedAt = (u as { deleted_at?: string | null }).deleted_at ?? null;
      if (deletedAt != null && String(deletedAt).length > 0) continue;
      byId.set(u.id, {
        email: u.email,
        user_metadata:
          u.user_metadata as { display_name?: string } | undefined,
      });
    }
    if (users.length < perPage) break;
    page++;
  }

  return byId;
}

function chunkIds<T>(ids: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size));
  }
  return out;
}

async function upsertPublicProfileCode(
  client: SupabaseClient,
  userId: string,
  displayNameSeed: string
): Promise<string> {
  for (let attempt = 0; attempt < MAX_UPDATE_ATTEMPTS; attempt++) {
    const public_profile_code = await assignUniquePublicProfileCode(
      client,
      displayNameSeed
    );
    const { error } = await client
      .from('users')
      .update({ public_profile_code })
      .eq('id', userId);

    if (!error) {
      return public_profile_code;
    }
    if (
      isUniqueViolation(error) &&
      attempt < MAX_UPDATE_ATTEMPTS - 1
    ) {
      console.warn(
        `[backfill-public-profile-codes] unique violation for ${userId}, retry ${attempt + 1}`
      );
      continue;
    }
    throw new Error(error.message ?? String(error));
  }
  throw new Error(
    `[backfill-public-profile-codes] failed after ${MAX_UPDATE_ATTEMPTS} attempts (${userId})`
  );
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      '❌ SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar configurados en .env'
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(
    dryRun
      ? '[backfill-public-profile-codes] DRY RUN (no se escribe en BD)\n'
      : '[backfill-public-profile-codes] Modo escritura\n'
  );

  const authById = await fetchAllNonDeletedAuthUserIds(supabase);
  const activeIds = [...authById.keys()];
  console.log(
    `Usuarios en auth sin deleted_at: ${activeIds.length}`
  );

  let wouldUpdate = 0;
  let updated = 0;
  let skippedHasCode = 0;
  let skippedNoProfileRow = 0;
  const errors: { id: string; message: string }[] = [];

  const batches = chunkIds(activeIds, 400);
  for (const batch of batches) {
    const { data: rows, error: selErr } = await supabase
      .from('users')
      .select('id, public_profile_code')
      .in('id', batch);

    if (selErr) {
      console.error('Error select users:', selErr);
      process.exit(1);
    }

    const rowMap = new Map(
      (rows ?? []).map((r) => [r.id as string, r.public_profile_code])
    );

    for (const id of batch) {
      const code = rowMap.get(id);
      if (code === undefined) {
        skippedNoProfileRow++;
        continue;
      }
      if (!needsPublicProfileCode(code)) {
        skippedHasCode++;
        continue;
      }

      const authUser = authById.get(id);
      const seed = authUser
        ? displayNameSeedFromAuthUser(authUser)
        : 'user';

      wouldUpdate++;
      if (dryRun) {
        console.log(`  [dry-run] ${id} -> (nuevo código desde seed: "${seed.slice(0, 40)}${seed.length > 40 ? '…' : ''}")`);
        continue;
      }

      try {
        const assigned = await upsertPublicProfileCode(supabase, id, seed);
        updated++;
        console.log(`  OK ${id} -> ${assigned}`);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push({ id, message });
        console.error(`  ERROR ${id}: ${message}`);
      }
    }
  }

  console.log('\n--- Resumen ---');
  console.log(`Sin fila en public.users: ${skippedNoProfileRow}`);
  console.log(`Ya tenían código: ${skippedHasCode}`);
  console.log(
    dryRun
      ? `Pendientes de asignar (simulado): ${wouldUpdate}`
      : `Asignados: ${updated} / objetivo ${wouldUpdate}`
  );
  if (errors.length > 0) {
    console.log(`Fallidos: ${errors.length}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
