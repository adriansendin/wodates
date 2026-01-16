/**
 * Script para copiar los datos de user_ai_profiles de un usuario a otro
 * 
 * Este script copia los datos de user_ai_profiles de test@example.com a koko32@example.com
 * 
 * Uso:
 *   npx tsx scripts/working/copy-user-ai-profile.ts
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

const SOURCE_EMAIL = 'koko31@example.com';
const TARGET_EMAIL = 'lisa@example.com';

type UserAIProfileRow = {
  user_id: string;
  summary: string | null;
  summary_incremental: string | null;
  summary_updated_at: string;
  summary_embedding: number[] | string | null;
};

/**
 * Busca un usuario por email y retorna su ID
 */
async function getUserIdFromEmail(
  supabase: ReturnType<typeof createClient>,
  email: string
): Promise<string | null> {
  const normalizedSearchEmail = email.toLowerCase().trim();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (listError) {
      console.error(`❌ Error al obtener usuarios (página ${page}):`, listError);
      return null;
    }

    const users = usersData.users || [];

    // Buscar usuario con email coincidente (case-insensitive)
    const user = users.find(
      (u) => u.email?.toLowerCase().trim() === normalizedSearchEmail
    );

    if (user) {
      return user.id;
    }

    // Si obtuvimos menos usuarios que perPage, hemos llegado al final
    if (users.length < perPage) {
      break;
    }

    // Pasar a la siguiente página
    page++;
  }

  return null;
}

/**
 * Obtiene los datos de user_ai_profiles para un usuario
 */
async function getUserAIProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<UserAIProfileRow | null> {
  const { data, error } = await supabase
    .from('user_ai_profiles')
    .select('user_id, summary, summary_incremental, summary_updated_at, summary_embedding')
    .eq('user_id', userId)
    .maybeSingle<UserAIProfileRow>();

  if (error) {
    console.error(`❌ Error al obtener user_ai_profiles:`, error);
    return null;
  }

  return data;
}

/**
 * Copia los datos de user_ai_profiles de un usuario a otro
 */
async function copyUserAIProfile() {
  console.log('🔄 Iniciando copia de user_ai_profiles...\n');
  console.log(`📧 Usuario origen: ${SOURCE_EMAIL}`);
  console.log(`📧 Usuario destino: ${TARGET_EMAIL}\n`);

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Buscar usuario origen
  console.log(`🔍 Buscando usuario origen: ${SOURCE_EMAIL}...`);
  const sourceUserId = await getUserIdFromEmail(supabase, SOURCE_EMAIL);

  if (!sourceUserId) {
    console.error(`❌ Error: No se encontró el usuario con email ${SOURCE_EMAIL}`);
    process.exit(1);
  }

  console.log(`✅ Usuario origen encontrado:`);
  console.log(`   ID: ${sourceUserId}`);
  console.log(`   Email: ${SOURCE_EMAIL}\n`);

  // Obtener datos de user_ai_profiles del usuario origen
  console.log(`📥 Obteniendo datos de user_ai_profiles del usuario origen...`);
  const sourceProfile = await getUserAIProfile(supabase, sourceUserId);

  if (!sourceProfile) {
    console.error(`❌ Error: No se encontró user_ai_profiles para el usuario ${SOURCE_EMAIL}`);
    process.exit(1);
  }

  console.log(`✅ Datos de user_ai_profiles obtenidos:`);
  console.log(`   Summary: ${sourceProfile.summary ? 'Presente' : 'Nulo'}`);
  console.log(`   Summary Incremental: ${sourceProfile.summary_incremental ? 'Presente' : 'Nulo'}`);
  console.log(`   Summary Updated At: ${sourceProfile.summary_updated_at}`);
  console.log(`   Summary Embedding: ${sourceProfile.summary_embedding ? 'Presente' : 'Nulo'}\n`);

  // Buscar usuario destino
  console.log(`🔍 Buscando usuario destino: ${TARGET_EMAIL}...`);
  const targetUserId = await getUserIdFromEmail(supabase, TARGET_EMAIL);

  if (!targetUserId) {
    console.error(`❌ Error: No se encontró el usuario con email ${TARGET_EMAIL}`);
    process.exit(1);
  }

  console.log(`✅ Usuario destino encontrado:`);
  console.log(`   ID: ${targetUserId}`);
  console.log(`   Email: ${TARGET_EMAIL}\n`);

  // Preparar datos para copiar
  // El embedding puede ser un array o un string JSON, necesitamos manejarlo correctamente
  let embeddingValue: string | null = null;
  if (sourceProfile.summary_embedding !== null && sourceProfile.summary_embedding !== undefined) {
    if (typeof sourceProfile.summary_embedding === 'string') {
      // Ya es un string JSON, usarlo directamente
      embeddingValue = sourceProfile.summary_embedding;
    } else if (Array.isArray(sourceProfile.summary_embedding)) {
      // Es un array, convertirlo a JSON string
      embeddingValue = JSON.stringify(sourceProfile.summary_embedding);
    }
  }

  const profileData = {
    user_id: targetUserId,
    summary: sourceProfile.summary,
    summary_incremental: sourceProfile.summary_incremental,
    summary_updated_at: sourceProfile.summary_updated_at,
    summary_embedding: embeddingValue,
  };

  // Verificar si ya existe un perfil para el usuario destino
  const existingProfile = await getUserAIProfile(supabase, targetUserId);

  if (existingProfile) {
    console.log(`⚠️  Ya existe un perfil para el usuario destino. Actualizando...`);
    
    const { data, error } = await supabase
      .from('user_ai_profiles')
      .update({
        summary: profileData.summary,
        summary_incremental: profileData.summary_incremental,
        summary_updated_at: profileData.summary_updated_at,
        summary_embedding: profileData.summary_embedding,
      })
      .eq('user_id', targetUserId)
      .select()
      .single();

    if (error) {
      console.error(`❌ Error al actualizar user_ai_profiles:`, error);
      process.exit(1);
    }

    console.log(`✅ Perfil actualizado correctamente!\n`);
  } else {
    console.log(`📝 Creando nuevo perfil para el usuario destino...`);
    
    const { data, error } = await supabase
      .from('user_ai_profiles')
      .insert(profileData)
      .select()
      .single();

    if (error) {
      console.error(`❌ Error al crear user_ai_profiles:`, error);
      process.exit(1);
    }

    console.log(`✅ Perfil creado correctamente!\n`);
  }

  console.log('='.repeat(60));
  console.log('📊 Resumen:');
  console.log(`   Usuario origen: ${SOURCE_EMAIL} (${sourceUserId})`);
  console.log(`   Usuario destino: ${TARGET_EMAIL} (${targetUserId})`);
  console.log(`   Estado: ✅ Copia completada`);
  console.log('='.repeat(60));
  console.log('\n✨ Copia completada exitosamente!');
}

// Ejecutar script
copyUserAIProfile().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
