/**
 * Script para que todos los usuarios de la base de datos le den like a un usuario específico
 * 
 * Este script:
 * 1. Busca un usuario por email (hardcodeado en el script)
 * 2. Obtiene todos los demás usuarios de la base de datos
 * 3. Crea likes de todos los usuarios hacia el usuario objetivo
 * 4. Omite likes duplicados si ya existen
 */

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ============================================================================
// CONFIGURACIÓN: Cambia este email por el del usuario que quieres que reciba likes
// ============================================================================
const TARGET_USER_EMAIL = 'test4@example.com'; // ⬅️ CAMBIA ESTE EMAIL
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
 * Busca un usuario por email en auth.users y public.users
 * Maneja la paginación para buscar en todos los usuarios
 */
async function getUserByEmail(
  client: SupabaseClient,
  email: string
): Promise<{ id: string; email: string } | null> {
  try {
    const normalizedSearchEmail = email.toLowerCase().trim();
    let page = 1;
    const perPage = 1000; // Máximo de usuarios por página
    let authUser: { id: string; email?: string } | null = null;
    let totalUsersChecked = 0;

    // Paginar a través de todos los usuarios hasta encontrar el email o llegar al final
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
      totalUsersChecked += users.length;

      console.log(
        `🔍 Buscando en página ${page}: ${users.length} usuarios (total revisados: ${totalUsersChecked})`
      );

      // Buscar el usuario por email (comparación case-insensitive)
      authUser =
        users.find(
          (u: any) =>
            u.email?.toLowerCase().trim() === normalizedSearchEmail
        ) || null;

      // Si lo encontramos, salir del bucle
      if (authUser) {
        console.log(
          `✅ Usuario encontrado en página ${page}: id=${authUser.id}, email=${authUser.email}`
        );
        break;
      }

      // Si obtuvimos menos usuarios que perPage, hemos llegado al final
      if (users.length < perPage) {
        console.log(
          `⚠️ Fin de la lista de usuarios. Revisados ${totalUsersChecked} usuarios en total.`
        );
        break;
      }

      // Pasar a la siguiente página
      page++;
    }

    if (!authUser) {
      console.error(
        `❌ User with email ${email} not found in auth.users after checking ${totalUsersChecked} users across ${page} page(s)`
      );
      return null;
    }

    const userId = authUser.id;

    // Verificar que existe en public.users
    const { data: userData, error: userError } = await client
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      console.error(
        `❌ Error fetching user ${userId} from public.users:`,
        userError.message
      );
      return null;
    }

    if (!userData) {
      console.error(`❌ User ${userId} not found in public.users`);
      return null;
    }

    return {
      id: userId,
      email: authUser.email || email,
    };
  } catch (error) {
    console.error(
      `❌ Unexpected error getting user by email:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

/**
 * Obtiene todos los IDs de usuarios de la base de datos (excepto el usuario objetivo)
 */
async function getAllUserIds(
  client: SupabaseClient,
  excludeUserId: string
): Promise<string[]> {
  try {
    const { data, error } = await client
      .from('users')
      .select('id')
      .neq('id', excludeUserId);

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    // Filtrar IDs válidos
    const userIds = (data ?? [])
      .map((row) => row.id)
      .filter(
        (id): id is string =>
          id !== null &&
          id !== undefined &&
          typeof id === 'string' &&
          id.trim().length > 0
      );

    return userIds;
  } catch (error) {
    throw new Error(
      `Failed to get all user IDs: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Verifica si ya existe un like entre dos usuarios
 */
async function hasExistingLike(
  client: SupabaseClient,
  fromUserId: string,
  toUserId: string
): Promise<boolean> {
  try {
    const { data, error } = await client
      .from('interactions')
      .select('id')
      .eq('from_user', fromUserId)
      .eq('to_user', toUserId)
      .eq('action', 'like')
      .maybeSingle();

    if (error) {
      console.warn(
        `⚠️ Error checking existing like: ${error.message} (continuando...)`
      );
      return false;
    }

    return data !== null;
  } catch (error) {
    console.warn(
      `⚠️ Unexpected error checking existing like: ${
        error instanceof Error ? error.message : String(error)
      } (continuando...)`
    );
    return false;
  }
}

/**
 * Crea un like de un usuario hacia otro
 */
async function createLike(
  client: SupabaseClient,
  fromUserId: string,
  toUserId: string
): Promise<{ success: boolean; skipped: boolean; error?: string }> {
  try {
    // Verificar si ya existe
    const exists = await hasExistingLike(client, fromUserId, toUserId);
    if (exists) {
      return { success: true, skipped: true };
    }

    // Crear el like
    const { error } = await client.from('interactions').insert({
      from_user: fromUserId,
      to_user: toUserId,
      action: 'like',
    });

    if (error) {
      // Si es un error de violación única (duplicado), lo consideramos como skipped
      if (
        error.code === '23505' ||
        error.message.includes('duplicate') ||
        error.message.includes('unique')
      ) {
        return { success: true, skipped: true };
      }

      return {
        success: false,
        skipped: false,
        error: error.message,
      };
    }

    return { success: true, skipped: false };
  } catch (error) {
    return {
      success: false,
      skipped: false,
      error:
        error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function main() {
  const startTime = Date.now();

  console.log('🚀 Iniciando script para dar likes a usuario\n');
  console.log(`📧 Email objetivo: ${TARGET_USER_EMAIL}\n`);

  try {
    // Validar configuración
    if (!TARGET_USER_EMAIL) {
      console.error(
        '❌ ERROR: Debes cambiar TARGET_USER_EMAIL en el script antes de ejecutarlo'
      );
      process.exit(1);
    }

    // Conectar a Supabase
    const config = getSupabaseConfig();
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('✅ Conectado a Supabase\n');

    // Buscar usuario objetivo
    console.log(`🔍 Buscando usuario con email: ${TARGET_USER_EMAIL}...`);
    const targetUser = await getUserByEmail(client, TARGET_USER_EMAIL);

    if (!targetUser) {
      console.error(
        `❌ No se encontró el usuario con email: ${TARGET_USER_EMAIL}`
      );
      process.exit(1);
    }

    console.log(`✅ Usuario encontrado:`);
    console.log(`   ID: ${targetUser.id}`);
    console.log(`   Email: ${targetUser.email}\n`);

    // Obtener todos los demás usuarios
    console.log('🔍 Obteniendo lista de todos los usuarios...');
    const allUserIds = await getAllUserIds(client, targetUser.id);
    console.log(`✅ Encontrados ${allUserIds.length} usuarios\n`);

    if (allUserIds.length === 0) {
      console.log('⚠️ No hay otros usuarios en la base de datos');
      process.exit(0);
    }

    // Crear likes
    console.log(
      `💝 Creando likes de ${allUserIds.length} usuarios hacia ${targetUser.email}...\n`
    );

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    for (let i = 0; i < allUserIds.length; i++) {
      const fromUserId = allUserIds[i];
      const progress = `[${i + 1}/${allUserIds.length}]`;

      const result = await createLike(client, fromUserId, targetUser.id);

      if (result.success) {
        if (result.skipped) {
          skippedCount++;
          if ((i + 1) % 100 === 0 || i === allUserIds.length - 1) {
            console.log(
              `${progress} ✅ Like creado/ya existía (${successCount} creados, ${skippedCount} omitidos)`
            );
          }
        } else {
          successCount++;
          if ((i + 1) % 100 === 0 || i === allUserIds.length - 1) {
            console.log(
              `${progress} ✅ Like creado (${successCount} creados, ${skippedCount} omitidos)`
            );
          }
        }
      } else {
        errorCount++;
        errors.push({
          userId: fromUserId,
          error: result.error || 'Unknown error',
        });
        console.error(
          `${progress} ❌ Error creando like de ${fromUserId}: ${result.error}`
        );
      }
    }

    // Resumen final
    const endTime = Date.now();
    const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN FINAL');
    console.log('='.repeat(80));
    console.log(`Usuario objetivo: ${targetUser.email} (${targetUser.id})`);
    console.log(`Total de usuarios procesados: ${allUserIds.length}`);
    console.log(`✅ Likes creados exitosamente: ${successCount}`);
    console.log(`⏭️  Likes omitidos (ya existían): ${skippedCount}`);
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
