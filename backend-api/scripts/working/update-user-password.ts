/**
 * One-off maintenance script: set a user's password in Supabase Auth (admin API).
 *
 * Never hardcode credentials. Set TARGET_EMAIL and NEW_PASSWORD in backend-api/.env
 * or export them only for the session.
 *
 * Usage (from backend-api):
 *   npx tsx scripts/working/update-user-password.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Obtener __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar configurados en .env');
  process.exit(1);
}

const targetEmailCandidate = process.env.TARGET_EMAIL?.trim();
const newPasswordCandidate = process.env.NEW_PASSWORD;

if (
  !targetEmailCandidate ||
  !newPasswordCandidate ||
  newPasswordCandidate.length < 8
) {
  console.error(
    '❌ Set TARGET_EMAIL and NEW_PASSWORD (min 8 chars) in .env or the environment before running.'
  );
  process.exit(1);
}

/** Validated inputs (never logged in full — password omitted). */
const targetEmail = targetEmailCandidate;
const newPassword = newPasswordCandidate;

async function updateUserPassword() {
  console.log('🔄 Iniciando actualización de contraseña...\n');
  console.log(`📧 Email objetivo: ${targetEmail}`);
  console.log('🔑 Nueva contraseña: (no se muestra en consola)\n');

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Buscar usuario por email (con paginación)
  console.log('📥 Buscando usuario...');
  const normalizedSearchEmail = targetEmail.toLowerCase().trim();
  let page = 1;
  const perPage = 1000;
  let user: { id: string; email?: string; user_metadata?: any } | null = null;

  while (!user) {
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (listError) {
      console.error(`❌ Error al obtener usuarios (página ${page}):`, listError);
      process.exit(1);
    }

    const users = usersData.users || [];

    // Buscar usuario con email coincidente (case-insensitive)
    user =
      users.find(
        (u) => u.email?.toLowerCase().trim() === normalizedSearchEmail
      ) || null;

    if (user) {
      break;
    }

    // Si obtuvimos menos usuarios que perPage, hemos llegado al final
    if (users.length < perPage) {
      break;
    }

    // Pasar a la siguiente página
    page++;
  }

  if (!user) {
    console.error(`❌ Error: No se encontró el usuario con email ${targetEmail}`);
    process.exit(1);
  }

  console.log(`✅ Usuario encontrado:`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Nombre: ${user.user_metadata?.display_name || 'N/A'}\n`);

  // Actualizar contraseña
  console.log('🔄 Actualizando contraseña...');
  const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    {
      password: newPassword,
    }
  );

  if (updateError) {
    console.error(`❌ Error al actualizar contraseña: ${updateError.message}`);
    process.exit(1);
  }

  if (!updateData.user) {
    console.error('❌ Error: Supabase no retornó el usuario actualizado');
    process.exit(1);
  }

  console.log('✅ Contraseña actualizada correctamente!\n');
  console.log('='.repeat(60));
  console.log('📊 Resumen:');
  console.log(`   Email: ${targetEmail}`);
  console.log('   Nueva contraseña: (redacted)');
  console.log(`   Estado: ✅ Actualizado`);
  console.log('='.repeat(60));
  console.log('\n✨ Actualización completada exitosamente!');
}

// Ejecutar script
updateUserPassword().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});

