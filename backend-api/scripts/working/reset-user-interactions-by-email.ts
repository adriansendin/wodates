/**
 * Borra todas las interacciones (likes y passes) que un usuario ENVIÓ a otros.
 * Así, al volver a hacer login, en discover volverán a aparecer todas esas personas
 * para poder dar like o pass de nuevo.
 *
 * Uso:
 *   1. Edita la variable USER_EMAIL más abajo.
 *   2. npx tsx scripts/working/reset-user-interactions-by-email.ts
 *
 * Requiere: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env
 */

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// CONFIGURACIÓN: email del usuario cuyas interacciones (likes/passes) borrar
// ============================================================================
const USER_EMAIL = 'usuario@example.com'; // ⬅️ CAMBIA ESTE EMAIL
// ============================================================================

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
 * El id coincide con public.users.id.
 */
async function getUserByEmail(
  client: SupabaseClient,
  email: string
): Promise<{ id: string; email: string } | null> {
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
    console.error(`❌ Usuario con email "${email}" no encontrado en auth.users`);
    return null;
  }

  const userId = authUser.id;

  const { data: userRow, error: userError } = await client
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (userError) {
    console.error(
      `❌ Error al comprobar public.users para ${userId}:`,
      userError.message
    );
    return null;
  }

  if (!userRow) {
    console.error(
      `❌ Usuario con id ${userId} no existe en public.users (auth existe pero perfil no)`
    );
    return null;
  }

  return { id: userId, email: authUser.email ?? email };
}

/**
 * Borra todas las filas de interactions donde from_user = userId.
 * Son los likes y passes que ESE usuario dio a otros.
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

async function main() {
  const config = getSupabaseConfig();
  const client = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n🔍 Buscando usuario por email: ${USER_EMAIL}\n`);

  const user = await getUserByEmail(client, USER_EMAIL);
  if (!user) {
    process.exit(1);
  }

  console.log(`✅ Usuario encontrado: id=${user.id}\n`);
  console.log(`🗑️  Borrando interacciones enviadas por este usuario (likes y passes)...\n`);

  const result = await deleteInteractionsSentByUser(client, user.id);

  if (result.error) {
    console.error(`❌ Error al borrar: ${result.error}`);
    process.exit(1);
  }

  console.log(`✅ Listo. Se borraron ${result.deleted} interacción(es).`);
  console.log(`   Al volver a entrar en la app, en discover volverán a aparecer esas personas.\n`);
}

main().catch((err) => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
