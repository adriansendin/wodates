/**
 * Script para crear perfiles de IA para usuarios que no tienen uno
 *
 * Este script encuentra todos los usuarios en public.users que no tienen
 * un registro en public.user_ai_profiles y les crea un perfil con un summary
 * hardcodeado.
 *
 * Uso:
 *   npx tsx scripts/working/create-missing-ai-profiles.ts
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

const HARDCODED_SUMMARY = `Identidad básica: Daniel, 29 años, vive en Barcelona, busca relaciones donde el respeto no sea negociable, prefiriendo la paciencia y el cariño en la cocina.
Estilo de comunicación: Describe la ciudad de Barcelona, su conexión con la música y la fotografía, y su búsqueda de relaciones respetuosas.
Personalidad: Busca la conexión entre la música y las palabras, es un observador de la ciudad, aprecia la paciencia y el cariño en la cocina, y valora la autenticidad en las relaciones.
Gustos y preferencias: Admira la ciudad de Barcelona, la música, la fotografía, la cocina mediterránea, y las relaciones basadas en el respeto mutuo.
Disgustos y rechazos: No aprecia la negociación o el ego en las relaciones, y se siente atraído por el afecto y la paciencia.
Actividades y vida real: Trabaja como consultor de marketing, disfruta de la cocina y la fotografía, y observa la ciudad de Barcelona.
Trabajo y formación: Se dedica a la consultoría de marketing, buscando conectar marcas con el público.
Valores personales y relacionales: Valora el respeto, el espacio para escuchar, y la paciencia en las relaciones.
Preferencias en relaciones: Busca relaciones basadas en el respeto y el espacio para escuchar.
Patrones de comportamiento: Describe la ciudad de Barcelona, la música, la fotografía, y la búsqueda de relaciones respetuosas.
Frases textuales relevantes: "La ciudad me enseñó que las diferencias son solo excusas para crecer juntas", "La ciudad me enseñó que las diferencias son solo excusas para crecer juntas", "La mezcla de tradición y modernidad que define a las ciudades que nos dejan crecer", "La guitarra y la cámara siempre están presentes en mi mente".`;

/**
 * Obtiene todos los IDs de usuarios de la tabla public.users
 */
async function getAllUserIds(supabase: any): Promise<string[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id');

  if (error) {
    console.error('❌ Error al obtener usuarios:', error);
    throw error;
  }

  return (data || []).map((row: { id: string }) => row.id);
}

/**
 * Obtiene todos los IDs de usuarios que ya tienen un perfil de IA
 */
async function getUsersWithAIProfile(supabase: any): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('user_ai_profiles')
    .select('user_id');

  if (error) {
    console.error('❌ Error al obtener perfiles de IA:', error);
    throw error;
  }

  return new Set((data || []).map((row: { user_id: string }) => row.user_id));
}

/**
 * Crea un perfil de IA para un usuario
 */
async function createAIProfile(
  supabase: any,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('user_ai_profiles')
    .insert({
      user_id: userId,
      summary: HARDCODED_SUMMARY,
      summary_incremental: null,
      summary_updated_at: new Date().toISOString(),
      summary_embedding: null,
    });

  if (error) {
    console.error(`❌ Error al crear perfil para usuario ${userId}:`, error);
    return false;
  }

  return true;
}

/**
 * Función principal
 */
async function createMissingAIProfiles() {
  console.log('🔄 Iniciando creación de perfiles de IA faltantes...\n');

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Obtener todos los usuarios
    console.log('📥 Obteniendo todos los usuarios de public.users...');
    const allUserIds = await getAllUserIds(supabase);
    console.log(`✅ Encontrados ${allUserIds.length} usuarios en total\n`);

    // Obtener usuarios que ya tienen perfil de IA
    console.log('📥 Obteniendo usuarios que ya tienen perfil de IA...');
    const usersWithProfile = await getUsersWithAIProfile(supabase);
    console.log(`✅ Encontrados ${usersWithProfile.size} usuarios con perfil de IA\n`);

    // Encontrar usuarios sin perfil
    const usersWithoutProfile = allUserIds.filter(
      (userId) => !usersWithProfile.has(userId)
    );

    console.log(`📊 Usuarios sin perfil de IA: ${usersWithoutProfile.length}\n`);

    if (usersWithoutProfile.length === 0) {
      console.log('✨ Todos los usuarios ya tienen un perfil de IA!');
      return;
    }

    // Crear perfiles en lotes
    const batchSize = 50;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < usersWithoutProfile.length; i += batchSize) {
      const batch = usersWithoutProfile.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(usersWithoutProfile.length / batchSize);

      console.log(
        `📦 Procesando lote ${batchNumber}/${totalBatches} (${batch.length} usuarios)...`
      );

      // Procesar en paralelo dentro del lote
      const results = await Promise.allSettled(
        batch.map((userId) => createAIProfile(supabase, userId))
      );

      results.forEach((result, index) => {
        const userId = batch[index];
        if (result.status === 'fulfilled' && result.value) {
          successCount++;
        } else {
          errorCount++;
          console.error(`  ❌ Error con usuario ${userId}`);
        }
      });

      // Pequeña pausa entre lotes para no sobrecargar la base de datos
      if (i + batchSize < usersWithoutProfile.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Resumen:');
    console.log(`   Total usuarios: ${allUserIds.length}`);
    console.log(`   Usuarios con perfil: ${usersWithProfile.size}`);
    console.log(`   Usuarios sin perfil: ${usersWithoutProfile.length}`);
    console.log(`   ✅ Perfiles creados: ${successCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);
    console.log('='.repeat(60));

    if (errorCount > 0) {
      console.log(
        '\n⚠️  Algunos perfiles no se pudieron crear. Puede ser necesario ejecutar el script nuevamente.'
      );
      process.exit(1);
    } else {
      console.log('\n✨ Proceso completado exitosamente!');
    }
  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  }
}

// Ejecutar script
createMissingAIProfiles().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
