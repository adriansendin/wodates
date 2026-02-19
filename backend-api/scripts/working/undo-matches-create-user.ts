/**
 * Deshace los matches y likes de todos los usuarios creados por create-user.ts.
 * Deja a cada usuario como si no hubiera dado like a nadie:
 *   - Borra todas las interacciones (likes) que el usuario envió (from_user = userId)
 *   - Borra todos los matches/chats en los que participa (incl. Doc Love)
 *
 * IMPORTANTE: Las variables iter y usersToCreate deben coincidir con create-user.ts.
 *
 * Uso:
 *   npx tsx scripts/working/undo-matches-create-user.ts
 *
 * Requiere: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env
 */

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseMatchRepository } from '../../src/data/repositories/SupabaseMatchRepository';

// ============================================================================
// CONFIGURACIÓN: debe coincidir con create-user.ts
// ============================================================================
const iter: string = '';
const usersToCreate: number = 20;

const USER_NAMES: string[] = [
  'leila',
  'daniel',
  'marco',
  'nadim',
  'sophie',
  'Chloe',
  'maya',
  'arjun',
  'jordan',
  'elin',
  'samira',
  'tomasa',
  'martin',
  'owena',
  'ibrahim',
  'amin',
  'leo',
  'fran',
  'noah',
  'peter',
];
// ============================================================================

const EMAILS_TO_PROCESS = USER_NAMES.slice(0, usersToCreate).map(
  (name) => `${name}${iter}@example.com`
);

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
 * Busca un usuario por email en auth.users (con paginación).
 */
async function getUserByEmail(
  client: SupabaseClient,
  email: string
): Promise<{ id: string; email: string; name?: string } | null> {
  const normalizedSearchEmail = email.toLowerCase().trim();
  let page = 1;
  const perPage = 1000;
  let authUser: { id: string; email?: string } | null = null;

  while (!authUser) {
    const { data, error: authError } = await client.auth.admin.listUsers({
      page,
      perPage,
    });

    if (authError) {
      console.error(
        `❌ Error fetching auth users (page ${page}):`,
        authError.message
      );
      return null;
    }

    const users = data.users || [];
    authUser =
      users.find(
        (u: { email?: string }) =>
          u.email?.toLowerCase().trim() === normalizedSearchEmail
      ) || null;

    if (authUser) break;
    if (users.length < perPage) break;
    page++;
  }

  if (!authUser) {
    return null;
  }

  const userId = authUser.id;

  const { data: userRow, error: userError } = await client
    .from('users')
    .select('id, name')
    .eq('id', userId)
    .maybeSingle();

  if (userError || !userRow) {
    return null;
  }

  return {
    id: userId,
    email: authUser.email ?? email,
    name: userRow.name ?? undefined,
  };
}

/**
 * Borra todas las interacciones (likes/passes) donde from_user = userId.
 */
async function deleteInteractionsSentByUser(
  client: SupabaseClient,
  userId: string
): Promise<{ deleted: number; error?: string }> {
  const { data, error } = await client
    .from('interactions')
    .delete()
    .eq('from_user', userId)
    .select('id');

  if (error) {
    return { deleted: 0, error: error.message };
  }

  const deleted = Array.isArray(data) ? data.length : 0;
  return { deleted };
}

/**
 * Deshace matches y likes para un usuario.
 */
async function undoMatchesForUser(
  client: SupabaseClient,
  matchRepository: SupabaseMatchRepository,
  userId: string,
  _userName: string,
  _userEmail: string
): Promise<{ likesDeleted: number; matchesDeleted: number; errors: string[] }> {
  const errors: string[] = [];
  let likesDeleted = 0;
  let matchesDeleted = 0;

  // 1. Borrar likes que el usuario envió
  const likesResult = await deleteInteractionsSentByUser(client, userId);
  if (likesResult.error) {
    errors.push(`Likes: ${likesResult.error}`);
  } else {
    likesDeleted = likesResult.deleted;
  }

  // 2. Obtener todos los matches del usuario
  const matchesResult = await matchRepository.findByUserId(userId);
  if (!matchesResult.success) {
    errors.push(`Matches: ${matchesResult.error.message}`);
    return { likesDeleted, matchesDeleted, errors };
  }

  const matches = matchesResult.data;

  // 3. Borrar cada match (chat + participantes + mensajes)
  for (const match of matches) {
    const deleteResult = await matchRepository.delete(match.id);
    if (!deleteResult.success) {
      errors.push(`Match ${match.id}: ${deleteResult.error.message}`);
    } else {
      matchesDeleted++;
    }
  }

  return { likesDeleted, matchesDeleted, errors };
}

async function main() {
  const config = getSupabaseConfig();
  const client = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const matchRepository = new SupabaseMatchRepository(config);

  console.log('\n🔄 Deshaciendo matches y likes de usuarios create-user.ts\n');
  console.log(`📋 Emails a procesar: ${EMAILS_TO_PROCESS.length}\n`);

  let totalLikesDeleted = 0;
  let totalMatchesDeleted = 0;
  const notFound: string[] = [];
  const failed: string[] = [];

  for (let i = 0; i < EMAILS_TO_PROCESS.length; i++) {
    const email = EMAILS_TO_PROCESS[i] ?? '';
    const displayName = (USER_NAMES[i] ?? email) || 'unknown';

    const user = await getUserByEmail(client, email);
    if (!user) {
      notFound.push(email);
      console.log(`   ⏭️  [${i + 1}/${EMAILS_TO_PROCESS.length}] ${displayName}: no encontrado`);
      continue;
    }

    const userName = user.name ?? displayName;

    const result = await undoMatchesForUser(
      client,
      matchRepository,
      user.id,
      userName,
      user.email
    );

    if (result.errors.length > 0) {
      failed.push(email);
      console.error(
        `   ❌ [${i + 1}/${EMAILS_TO_PROCESS.length}] ${userName}:`,
        result.errors.join('; ')
      );
    } else {
      totalLikesDeleted += result.likesDeleted;
      totalMatchesDeleted += result.matchesDeleted;
      console.log(
        `   ✅ [${i + 1}/${EMAILS_TO_PROCESS.length}] ${userName}: ` +
          `${result.likesDeleted} like(s), ${result.matchesDeleted} match(es) eliminados`
      );
    }

    if (i < EMAILS_TO_PROCESS.length - 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  // Resumen
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN');
  console.log('='.repeat(60));
  console.log(`✅ Likes eliminados (total): ${totalLikesDeleted}`);
  console.log(`✅ Matches eliminados (total): ${totalMatchesDeleted}`);
  if (notFound.length > 0) {
    console.log(`\n⏭️  No encontrados (${notFound.length}):`);
    notFound.forEach((e) => console.log(`   - ${e}`));
  }
  if (failed.length > 0) {
    console.log(`\n❌ Con errores (${failed.length}):`);
    failed.forEach((e) => console.log(`   - ${e}`));
    process.exit(1);
  }

  console.log('\n✅ Script completado. Los usuarios quedan como si no hubieran dado like a nadie.\n');
}

main().catch((err) => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
