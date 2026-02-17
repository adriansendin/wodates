/**
 * Marca como "deleted" (soft delete) a los usuarios cuya ciudad en public.users coincide con:
 *   - Liverpool (exacto)
 *   - Liverpool + número (ej: Liverpool1, Liverpool2, Liverpool123)
 *   - Valencia (exacto)
 *
 * Usa auth.admin.deleteUser(userId, true) para soft delete.
 * También actualiza show_bio_in_feed = false en public.users.
 *
 * Uso:
 *   npx tsx scripts/working/mark-users-deleted-by-city.ts
 *
 * Modo dry-run (solo muestra qué haría, sin ejecutar):
 *   DRY_RUN=1 npx tsx scripts/working/mark-users-deleted-by-city.ts
 *
 * Requiere: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env
 */

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return { url, serviceRoleKey };
}

/**
 * Comprueba si la ciudad coincide con los criterios:
 * - Liverpool (exacto)
 * - Liverpool + número (ej: Liverpool1, Liverpool2)
 * - Valencia (exacto)
 * - Valencia2 (exacto)
 */
function matchesCityCriteria(city: string | null): boolean {
  if (!city || typeof city !== 'string') return false;
  const trimmed = city.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();

  // Valencia (exacto, case insensitive)
  if (lower === 'valencia') return true;

  // Valencia2 (exacto, case insensitive)
  if (lower === 'valencia2') return true;

  // Liverpool (exacto)
  if (lower === 'liverpool') return true;

  // Liverpool + número (ej: Liverpool1, Liverpool2, Liverpool123)
  if (/^liverpool\d+$/i.test(trimmed)) return true;

  return false;
}

/**
 * Obtiene usuarios de public.users cuya ciudad coincide con los criterios.
 * Usamos ilike para Liverpool% y luego filtramos en código para Liverpool exacto o Liverpool+digits.
 */
async function getUsersToMarkDeleted(
  client: SupabaseClient
): Promise<Array<{ id: string; city: string | null }>> {
  const { data, error } = await client
    .from('users')
    .select('id, city')
    .or('city.ilike.Liverpool%,city.ilike.Valencia%');

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{ id: string; city: string | null }>;
  return rows.filter((row) => matchesCityCriteria(row.city));
}

/**
 * Comprueba si el usuario ya está soft-deleted en auth.
 */
async function isUserAlreadyDeleted(
  client: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await client.auth.admin.getUserById(userId);

  if (error || !data?.user) {
    // Si no existe o hay error, consideramos que no está "deleted" para no intentar borrar de nuevo
    return false;
  }

  const user = data.user as { deleted_at?: string | null };
  return !!user.deleted_at;
}

/**
 * Marca el usuario como deleted (soft delete en auth + hide from feed).
 */
async function markUserAsDeleted(
  client: SupabaseClient,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error: authError } = await client.auth.admin.deleteUser(userId, true);

  if (authError) {
    return { ok: false, error: authError.message };
  }

  const { error: updateError } = await client
    .from('users')
    .update({ show_bio_in_feed: false })
    .eq('id', userId);

  if (updateError) {
    console.warn(
      `  ⚠️  Auth soft-delete OK, but failed to set show_bio_in_feed=false: ${updateError.message}`
    );
  }

  return { ok: true };
}

async function main() {
  const config = getSupabaseConfig();
  const client = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('\n🔍 Buscando usuarios con city = Liverpool, Liverpool+Número o Valencia...\n');

  const users = await getUsersToMarkDeleted(client);

  if (users.length === 0) {
    console.log('✅ No se encontraron usuarios que coincidan con los criterios.');
    return;
  }

  console.log(`📋 Encontrados ${users.length} usuario(s):\n`);
  users.forEach((u, i) => {
    console.log(`   ${i + 1}. id=${u.id}  city="${u.city ?? 'null'}"`);
  });

  if (DRY_RUN) {
    console.log('\n⚠️  DRY_RUN=1: No se ejecutará ninguna acción.');
    console.log('   Ejecuta sin DRY_RUN para marcar estos usuarios como deleted.\n');
    return;
  }

  console.log('\n🗑️  Marcando como deleted (soft delete)...\n');

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const user of users) {
    const alreadyDeleted = await isUserAlreadyDeleted(client, user.id);
    if (alreadyDeleted) {
      console.log(`   ⏭️  ${user.id} (${user.city ?? 'null'}): ya estaba deleted, omitiendo`);
      skipCount++;
      continue;
    }

    const result = await markUserAsDeleted(client, user.id);

    if (result.ok) {
      console.log(`   ✅ ${user.id} (${user.city ?? 'null'}): marcado como deleted`);
      successCount++;
    } else {
      console.error(`   ❌ ${user.id} (${user.city ?? 'null'}): ${result.error}`);
      errorCount++;
    }
  }

  console.log('\n📊 Resumen:');
  console.log(`   Marcados como deleted: ${successCount}`);
  if (skipCount > 0) console.log(`   Omitidos (ya deleted): ${skipCount}`);
  if (errorCount > 0) console.log(`   Errores: ${errorCount}`);
  console.log('');
}

main().catch((err) => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
