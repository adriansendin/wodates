/**
 * Script para insertar el email al inicio de la bio de todos los usuarios
 * 
 * Este script:
 * 1. Obtiene todos los usuarios de public.users
 * 2. Para cada usuario, obtiene su email de auth.users.email
 * 3. Inserta el email al inicio de la columna bio en public.users
 */

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
 * Obtiene todos los usuarios de public.users
 */
async function getAllUsers(
  client: SupabaseClient
): Promise<Array<{ id: string; bio: string | null }>> {
  try {
    const { data, error } = await client
      .from('users')
      .select('id, bio');

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      bio: row.bio,
    }));
  } catch (error) {
    throw new Error(
      `Failed to get all users: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Obtiene el email de un usuario desde auth.users
 */
async function getUserEmail(
  client: SupabaseClient,
  userId: string
): Promise<string | null> {
  try {
    const { data, error } = await client.auth.admin.getUserById(userId);

    if (error) {
      console.warn(
        `⚠️ Error fetching email for user ${userId}: ${error.message}`
      );
      return null;
    }

    if (!data?.user) {
      console.warn(`⚠️ User ${userId} not found in auth.users`);
      return null;
    }

    return data.user.email || null;
  } catch (error) {
    console.warn(
      `⚠️ Unexpected error fetching email for user ${userId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

/**
 * Actualiza la bio de un usuario insertando el email al inicio
 */
async function updateUserBio(
  client: SupabaseClient,
  userId: string,
  email: string,
  currentBio: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // Si la bio es null o vacía, simplemente usar el email
    // Si tiene contenido, insertar el email al inicio seguido de un espacio
    const newBio = currentBio
      ? `${email} ${currentBio}`
      : email;

    const { error } = await client
      .from('users')
      .update({ bio: newBio })
      .eq('id', userId);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function main() {
  const startTime = Date.now();

  console.log('🚀 Iniciando script para insertar emails en bio\n');

  try {
    // Conectar a Supabase
    const config = getSupabaseConfig();
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('✅ Conectado a Supabase\n');

    // Obtener todos los usuarios
    console.log('🔍 Obteniendo lista de todos los usuarios...');
    const allUsers = await getAllUsers(client);
    console.log(`✅ Encontrados ${allUsers.length} usuarios\n`);

    if (allUsers.length === 0) {
      console.log('⚠️ No hay usuarios en la base de datos');
      process.exit(0);
    }

    // Procesar usuarios
    console.log(
      `📝 Procesando ${allUsers.length} usuarios para insertar email en bio...\n`
    );

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    for (let i = 0; i < allUsers.length; i++) {
      const user = allUsers[i];
      const progress = `[${i + 1}/${allUsers.length}]`;

      // Obtener email del usuario
      const email = await getUserEmail(client, user.id);

      if (!email) {
        skippedCount++;
        console.log(
          `${progress} ⏭️  Usuario ${user.id}: No se pudo obtener email (omitido)`
        );
        continue;
      }

      // Verificar si el email ya está al inicio de la bio
      if (user.bio && user.bio.trim().startsWith(email)) {
        skippedCount++;
        if ((i + 1) % 100 === 0 || i === allUsers.length - 1) {
          console.log(
            `${progress} ⏭️  Usuario ${user.id}: Email ya está al inicio (${successCount} actualizados, ${skippedCount} omitidos)`
          );
        }
        continue;
      }

      // Actualizar bio
      const result = await updateUserBio(
        client,
        user.id,
        email,
        user.bio
      );

      if (result.success) {
        successCount++;
        if ((i + 1) % 100 === 0 || i === allUsers.length - 1) {
          console.log(
            `${progress} ✅ Usuario ${user.id}: Bio actualizada (${successCount} actualizados, ${skippedCount} omitidos)`
          );
        }
      } else {
        errorCount++;
        errors.push({
          userId: user.id,
          error: result.error || 'Unknown error',
        });
        console.error(
          `${progress} ❌ Usuario ${user.id}: Error actualizando bio - ${result.error}`
        );
      }
    }

    // Resumen final
    const endTime = Date.now();
    const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN FINAL');
    console.log('='.repeat(80));
    console.log(`Total de usuarios procesados: ${allUsers.length}`);
    console.log(`✅ Bios actualizadas exitosamente: ${successCount}`);
    console.log(`⏭️  Usuarios omitidos: ${skippedCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`⏱️  Tiempo total: ${elapsedSeconds} segundos`);
    console.log('='.repeat(80));

    if (errors.length > 0) {
      console.log('\n⚠️ Errores encontrados:');
      errors.slice(0, 10).forEach((err) => {
        console.log(`   - ${err.userId}: ${err.error}`);
      });
      if (errors.length > 10) {
        console.log(`   ... y ${errors.length - 10} errores más`);
      }
    }

    if (errorCount > 0) {
      console.log(
        `\n⚠️ El script completó con ${errorCount} error(es). Revisa los detalles arriba.`
      );
      process.exit(1);
    } else {
      console.log('\n✅ Script completado exitosamente!');
    }
  } catch (error) {
    const endTime = Date.now();
    const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);

    console.error('\n❌ Error fatal en la ejecución del script:');
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
      if (error.stack) {
        console.error(`   Stack trace: ${error.stack}`);
      }
    } else {
      console.error(`   Error desconocido: ${JSON.stringify(error)}`);
    }
    console.error(`\n⏱️  El script falló después de ${elapsedSeconds} segundos`);
    process.exit(1);
  }
}

// Ejecutar el script
main();
