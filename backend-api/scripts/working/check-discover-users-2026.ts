/**
 * Script para verificar por qué los usuarios chico2026_1 y chica2026_1 no aparecen en el discover
 * 
 * Uso: npx tsx scripts/working/check-discover-users-2026.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });

interface UserData {
  id: string;
  email: string;
  name: string;
  gender: string | null;
  looking_for: string | null;
  city: string | null;
  active_chats_count: number;
  is_bot: boolean | null;
  birthDate: string | null;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return { url, serviceRoleKey };
}

async function getUserByEmail(
  client: any,
  email: string
): Promise<UserData | null> {
  // First get user from auth.users by email
  const { data: authUsers, error: authError } = await client.auth.admin.listUsers();

  if (authError) {
    console.error(`❌ Error fetching auth users:`, authError.message);
    return null;
  }

  const authUser = authUsers.users.find((u: any) => u.email === email);

  if (!authUser) {
    console.error(`❌ User with email ${email} not found in auth.users`);
    return null;
  }

  const userId = authUser.id;

  // Get user from public.users
  const { data: userData, error: userError } = await client
    .from('users')
    .select('id, gender, looking_for, city, active_chats_count, is_bot, birthDate')
    .eq('id', userId)
    .maybeSingle();

  if (userError) {
    console.error(`❌ Error fetching user ${userId}:`, userError.message);
    return null;
  }

  if (!userData) {
    console.error(`❌ User ${userId} not found in public.users`);
    return null;
  }

  const metadata = authUser.user_metadata as Record<string, unknown> | null;
  const displayName =
    metadata && typeof metadata.display_name === 'string'
      ? metadata.display_name.trim()
      : '';

  return {
    ...userData,
    email: authUser.email || 'N/A',
    name: displayName || authUser.email || 'Usuario',
  } as UserData;
}

async function getInteractions(
  client: any,
  userId1: string,
  userId2: string
): Promise<Array<{ from_user: string; to_user: string; action: string }>> {
  const { data, error } = await client
    .from('interactions')
    .select('from_user, to_user, action')
    .or(`and(from_user.eq.${userId1},to_user.eq.${userId2}),and(from_user.eq.${userId2},to_user.eq.${userId1})`);

  if (error) {
    console.error('❌ Error fetching interactions:', error.message);
    return [];
  }

  return (data || []) as Array<{ from_user: string; to_user: string; action: string }>;
}

function checkGenderFilter(
  user1LookingFor: string | null,
  user2Gender: string | null
): boolean {
  if (!user2Gender) {
    return false;
  }

  if (!user1LookingFor || user1LookingFor === 'both') {
    return true;
  }

  if (user1LookingFor === 'male') {
    return user2Gender === 'male';
  }

  if (user1LookingFor === 'female') {
    return user2Gender === 'female';
  }

  return false;
}

function printUserInfo(user: UserData, label: string) {
  console.log(`\n${label}:`);
  console.log(`  ID: ${user.id}`);
  console.log(`  Nombre: ${user.name}`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Género: ${user.gender || 'NULL ⚠️'}`);
  console.log(`  Buscando: ${user.looking_for || 'NULL ⚠️'}`);
  console.log(`  Ciudad: ${user.city || 'NULL'}`);
  console.log(`  Chats activos: ${user.active_chats_count}`);
  console.log(`  Es bot: ${user.is_bot ?? 'NULL'}`);
  console.log(`  Fecha nacimiento: ${user.birthDate || 'NULL'}`);
}

async function simulateFeedQuery(
  client: any,
  currentUser: UserData,
  targetUser: UserData
): Promise<{ passes: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  let passes = true;

  // Check SQL filters
  console.log(`\n🔍 Simulando consulta SQL para ${currentUser.name} buscando a ${targetUser.name}:`);

  // 1. id != currentUser.id
  if (currentUser.id === targetUser.id) {
    passes = false;
    reasons.push('❌ Es el mismo usuario');
  } else {
    reasons.push('✅ No es el mismo usuario');
  }

  // 2. active_chats_count < 1
  if (targetUser.active_chats_count >= 1) {
    passes = false;
    reasons.push(`❌ ${targetUser.name} tiene ${targetUser.active_chats_count} chats activos (debe ser 0)`);
  } else {
    reasons.push(`✅ ${targetUser.name} tiene 0 chats activos`);
  }

  // 3. is_bot IS NULL OR is_bot = false
  if (targetUser.is_bot === true) {
    passes = false;
    reasons.push(`❌ ${targetUser.name} está marcado como bot`);
  } else {
    reasons.push(`✅ ${targetUser.name} no es bot`);
  }

  // 4. gender IN (genderFilter) - solo si looking_for != 'any'
  const genderFilter = resolveGenderFilter(currentUser.looking_for);
  if (genderFilter !== 'any') {
    if (!targetUser.gender || !genderFilter.includes(targetUser.gender)) {
      passes = false;
      reasons.push(
        `❌ Filtro SQL de género: ${currentUser.name} busca ${currentUser.looking_for} (${genderFilter.join(', ')}) pero ${targetUser.name} tiene género ${targetUser.gender || 'NULL'}`
      );
    } else {
      reasons.push(
        `✅ Filtro SQL de género: ${targetUser.name} tiene género ${targetUser.gender} que está en [${genderFilter.join(', ')}]`
      );
    }
  } else {
    reasons.push(`✅ Filtro SQL de género: ${currentUser.name} busca 'both' o NULL, no se filtra por género en SQL`);
  }

  // 5. city = currentUser.city (solo si currentUser tiene city)
  if (currentUser.city) {
    if (targetUser.city !== currentUser.city) {
      passes = false;
      reasons.push(
        `❌ Filtro SQL de ciudad: ${currentUser.name} está en ${currentUser.city} pero ${targetUser.name} está en ${targetUser.city || 'NULL'}`
      );
    } else {
      reasons.push(`✅ Filtro SQL de ciudad: Ambos están en ${currentUser.city}`);
    }
  } else {
    reasons.push(`✅ Filtro SQL de ciudad: ${currentUser.name} no tiene ciudad, no se filtra por ciudad`);
  }

  // Check TypeScript filters
  console.log(`\n🔍 Verificando filtros TypeScript:`);

  // Check interactions
  const interactions = await getInteractions(client, currentUser.id, targetUser.id);
  if (interactions.length > 0) {
    passes = false;
    reasons.push('❌ Hay interacciones previas:');
    interactions.forEach((interaction) => {
      const action = interaction.action === 'like' ? 'like' : 'pass';
      reasons.push(`   - ${interaction.from_user === currentUser.id ? currentUser.name : targetUser.name} → ${interaction.to_user === currentUser.id ? currentUser.name : targetUser.name}: ${action}`);
    });
  } else {
    reasons.push('✅ No hay interacciones previas');
  }

  // Bidirectional gender filter
  const currentUserGender = normalizeGender(currentUser.gender);
  const targetUserGender = normalizeGender(targetUser.gender);
  const targetUserLookingFor = targetUser.looking_for;

  // Check if current user is looking for target's gender
  const currentLookingForTarget = checkGenderFilter(currentUser.looking_for, targetUserGender);
  if (!currentLookingForTarget) {
    passes = false;
    reasons.push(
      `❌ Filtro bidireccional: ${currentUser.name} (busca: ${currentUser.looking_for || 'NULL'}) NO busca el género de ${targetUser.name} (${targetUser.gender || 'NULL'})`
    );
  } else {
    reasons.push(
      `✅ Filtro bidireccional: ${currentUser.name} busca el género de ${targetUser.name}`
    );
  }

  // Check if target user is looking for current user's gender
  if (!currentUserGender) {
    passes = false;
    reasons.push(
      `❌ Filtro bidireccional: ${currentUser.name} NO tiene género definido (NULL) - esto causa que el filtro bidireccional falle`
    );
  } else {
    const targetLookingForCurrent = checkGenderFilter(targetUserLookingFor, currentUserGender);
    if (!targetLookingForCurrent) {
      passes = false;
      reasons.push(
        `❌ Filtro bidireccional: ${targetUser.name} (busca: ${targetUserLookingFor || 'NULL'}) NO busca el género de ${currentUser.name} (${currentUser.gender})`
      );
    } else {
      reasons.push(
        `✅ Filtro bidireccional: ${targetUser.name} busca el género de ${currentUser.name}`
      );
    }
  }

  return { passes, reasons };
}

function resolveGenderFilter(lookingFor: string | null): 'any' | string[] {
  if (!lookingFor || lookingFor === 'both') {
    return 'any';
  }

  if (lookingFor === 'male') {
    return ['male'];
  }

  if (lookingFor === 'female') {
    return ['female'];
  }

  return 'any';
}

function normalizeGender(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (['male', 'female', 'non_binary'].includes(normalized)) {
    return normalized;
  }

  return null;
}

async function checkFeedPosition(
  client: any,
  currentUser: UserData,
  targetUser: UserData
): Promise<void> {
  console.log(`\n🔍 Verificando posición de ${targetUser.name} en el feed de ${currentUser.name}:`);

  const genderFilter = resolveGenderFilter(currentUser.looking_for);
  
  let query = client
    .from('users')
    .select('id, gender, looking_for, city')
    .neq('id', currentUser.id)
    .lt('active_chats_count', 1)
    .or('is_bot.is.null,is_bot.eq.false')
    .order('id', { ascending: false });

  if (genderFilter !== 'any') {
    query = query.in('gender', genderFilter).not('gender', 'is', null);
  }

  if (currentUser.city) {
    query = query.eq('city', currentUser.city);
  }

  const { data: allResults, error } = await query;

  if (error) {
    console.error(`❌ Error en consulta SQL:`, error.message);
    return;
  }

  console.log(`📊 Total usuarios que cumplen filtros SQL: ${allResults?.length || 0}`);
  
  const targetPosition = allResults?.findIndex((u: any) => u.id === targetUser.id);
  if (targetPosition !== undefined && targetPosition >= 0) {
    console.log(`✅ ${targetUser.name} está en la posición ${targetPosition + 1} de ${allResults?.length}`);
    console.log(`   ${targetPosition < 50 ? '✅ Está en los primeros 50 (carga inicial)' : `⚠️ Está FUERA de los primeros 50 (posición ${targetPosition + 1}) - necesitaría scroll/paginación`}`);
  } else {
    console.log(`❌ ${targetUser.name} NO está en los resultados SQL`);
    console.log(`   Esto significa que ${targetUser.name} NO cumple los filtros SQL básicos`);
  }
}

async function main() {
  console.log('🔍 Verificando usuarios chico2026_1 y chica2026_1 en el discover\n');

  try {
    const config = getSupabaseConfig();
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get users by email
    const chico2026_1 = await getUserByEmail(client, 'chico2026_1@example.com');
    const chica2026_1 = await getUserByEmail(client, 'chica2026_1@example.com');

    if (!chico2026_1) {
      console.error('❌ No se encontró chico2026_1@example.com');
      process.exit(1);
    }

    if (!chica2026_1) {
      console.error('❌ No se encontró chica2026_1@example.com');
      process.exit(1);
    }

    printUserInfo(chico2026_1, '👤 chico2026_1');
    printUserInfo(chica2026_1, '👤 chica2026_1');

    // Check both directions
    console.log('\n' + '='.repeat(80));
    console.log('\n📋 VERIFICACIÓN: chico2026_1 → chica2026_1');
    const result1 = await simulateFeedQuery(client, chico2026_1, chica2026_1);
    console.log('\n📋 Resultado detallado:');
    result1.reasons.forEach((reason) => console.log(`  ${reason}`));
    console.log(`\n${result1.passes ? '✅' : '❌'} chico2026_1 ${result1.passes ? 'SÍ' : 'NO'} vería a chica2026_1 en el discover`);

    // Check position in feed
    if (result1.passes) {
      await checkFeedPosition(client, chico2026_1, chica2026_1);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📋 VERIFICACIÓN: chica2026_1 → chico2026_1');
    const result2 = await simulateFeedQuery(client, chica2026_1, chico2026_1);
    console.log('\n📋 Resultado detallado:');
    result2.reasons.forEach((reason) => console.log(`  ${reason}`));
    console.log(`\n${result2.passes ? '✅' : '❌'} chica2026_1 ${result2.passes ? 'SÍ' : 'NO'} vería a chico2026_1 en el discover`);

    // Check position in feed
    if (result2.passes) {
      await checkFeedPosition(client, chica2026_1, chico2026_1);
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 RESUMEN FINAL:');
    if (result1.passes && result2.passes) {
      console.log('✅ Ambos usuarios deberían verse mutuamente en el discover');
      console.log('\n💡 CÓMO SE CARGA EL DISCOVER:');
      console.log('   - La carga inicial trae 50 usuarios (limit=50, offset=0)');
      console.log('   - Al hacer scroll, carga 20 más (limit=20, offset=50, 70, 90...)');
      console.log('   - Los usuarios se ordenan por ID descendente (más nuevos primero)');
      console.log('   - Si los usuarios están más allá de la posición 50, necesitarás hacer scroll para verlos');
    } else {
      console.log('❌ Los usuarios NO se ven mutuamente por las siguientes razones:');
      if (!result1.passes) {
        console.log(`\n  chico2026_1 → chica2026_1:`);
        result1.reasons.filter((r) => r.startsWith('❌')).forEach((r) => console.log(`    ${r}`));
      }
      if (!result2.passes) {
        console.log(`\n  chica2026_1 → chico2026_1:`);
        result2.reasons.filter((r) => r.startsWith('❌')).forEach((r) => console.log(`    ${r}`));
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();

