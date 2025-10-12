/**
 * Script de migración para actualizar display_name en auth.users
 * 
 * Este script actualiza los metadatos de usuarios que no tienen display_name
 * generando un nombre a partir de su email.
 * 
 * Uso:
 *   npx tsx scripts/migrate-user-names.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar configurados en .env');
  process.exit(1);
}

async function migrateUserNames() {
  console.log('🔄 Iniciando migración de nombres de usuario...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Obtener todos los usuarios
  console.log('📥 Obteniendo lista de usuarios...');
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000, // Ajustar si tienes más de 1000 usuarios
  });

  if (error) {
    console.error('❌ Error al obtener usuarios:', error);
    return;
  }

  const users = data.users;
  console.log(`✅ Se encontraron ${users.length} usuarios\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users) {
    const metadata = user.user_metadata || {};
    const currentDisplayName = metadata.display_name;

    // Si ya tiene display_name, omitir
    if (currentDisplayName && currentDisplayName.trim()) {
      console.log(`⏭️  Usuario ${user.email}: Ya tiene display_name "${currentDisplayName}"`);
      skipped++;
      continue;
    }

    // Generar display_name a partir del email
    const displayName = user.email?.split('@')[0] || 'User';

    console.log(`🔄 Actualizando usuario ${user.email}...`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Nuevo display_name: ${displayName}`);

    // Actualizar metadatos del usuario
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...metadata,
          display_name: displayName,
        },
      }
    );

    if (updateError) {
      console.error(`   ❌ Error: ${updateError.message}\n`);
      errors++;
    } else {
      console.log(`   ✅ Actualizado correctamente\n`);
      updated++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Resumen de migración:');
  console.log(`   Total de usuarios: ${users.length}`);
  console.log(`   ✅ Actualizados: ${updated}`);
  console.log(`   ⏭️  Omitidos (ya tenían nombre): ${skipped}`);
  console.log(`   ❌ Errores: ${errors}`);
  console.log('='.repeat(60));

  if (updated > 0) {
    console.log('\n✨ Migración completada exitosamente!');
    console.log('💡 Reinicia el backend para que los cambios surtan efecto.');
  } else if (skipped === users.length) {
    console.log('\n✅ Todos los usuarios ya tienen display_name configurado.');
  } else {
    console.log('\n⚠️  Hubo problemas durante la migración. Revisa los errores arriba.');
  }
}

// Ejecutar migración
migrateUserNames().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});

