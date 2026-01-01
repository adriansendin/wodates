/**
 * Script para ejecutar la consulta SQL real del feed y ver qué usuarios aparecen
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });

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

async function main() {
  const userId = process.argv[2] || 'da07b052-39d7-42d8-8bee-78f5631939d2'; // chico1 por defecto

  try {
    const config = getSupabaseConfig();
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log(`🔍 Ejecutando consulta SQL del feed para usuario: ${userId}\n`);

    // Get current user data
    const { data: currentUser, error: userError } = await client
      .from('users')
      .select('id, looking_for, gender, city')
      .eq('id', userId)
      .single();

    if (userError || !currentUser) {
      console.error('❌ Error fetching current user:', userError?.message);
      process.exit(1);
    }

    console.log('Usuario actual:');
    console.log(`  ID: ${currentUser.id}`);
    console.log(`  Género: ${currentUser.gender}`);
    console.log(`  Buscando: ${currentUser.looking_for}`);
    console.log(`  Ciudad: ${currentUser.city || 'NULL'}\n`);

    // Resolve gender filter
    let genderFilter: 'any' | string[] = 'any';
    if (currentUser.looking_for && currentUser.looking_for !== 'both') {
      genderFilter = [currentUser.looking_for];
    }

    // First, count total users that match SQL filters (without limit)
    let countQuery = client
      .from('users')
      .select('id', { count: 'exact', head: true })
      .neq('id', userId)
      .lt('active_chats_count', 1)
      .or('is_bot.is.null,is_bot.eq.false');

    if (genderFilter !== 'any') {
      countQuery = countQuery.in('gender', genderFilter);
    }

    if (currentUser.city) {
      countQuery = countQuery.eq('city', currentUser.city);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('❌ Error contando usuarios:', countError.message);
    } else {
      console.log(`📊 Total usuarios que cumplen filtros SQL: ${count || 0}`);
      console.log(`   Límite de la consulta: 10 usuarios\n`);
    }

    // Build query exactly as in the code
    let query = client
      .from('users')
      .select('id, birthDate, gender, looking_for, bio, city')
      .neq('id', userId)
      .lt('active_chats_count', 1)
      .or('is_bot.is.null,is_bot.eq.false')
      .range(0, 9); // limit 10

    if (genderFilter !== 'any') {
      query = query.in('gender', genderFilter);
    }

    if (currentUser.city) {
      query = query.eq('city', currentUser.city);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error en consulta SQL:', error.message);
      process.exit(1);
    }

    console.log(`📊 Resultados de la consulta SQL (sin filtros TypeScript):`);
    console.log(`   Total usuarios encontrados: ${data?.length || 0}`);
    
    // Check if chica1 is in the results
    const chica1Id = '02d8227d-1a86-48cd-884b-58be9bc04aef';
    const chica1InResults = data?.some((u: any) => u.id === chica1Id);
    console.log(`   ¿chica1 está en estos resultados?: ${chica1InResults ? '✅ SÍ' : '❌ NO'}\n`);

    if (data && data.length > 0) {
      data.forEach((user, index) => {
        console.log(`${index + 1}. ${user.id}`);
        console.log(`   Género: ${user.gender || 'NULL'}`);
        console.log(`   Buscando: ${user.looking_for || 'NULL'}`);
        console.log(`   Ciudad: ${user.city || 'NULL'}`);
        
        // Check if this is chico1 or chica1
        if (user.id === 'da07b052-39d7-42d8-8bee-78f5631939d2') {
          console.log(`   ⭐ Este es chico1`);
        } else if (user.id === '02d8227d-1a86-48cd-884b-58be9bc04aef') {
          console.log(`   ⭐ Este es chica1`);
        }
        console.log('');
      });
    } else {
      console.log('⚠️ No se encontraron usuarios en la consulta SQL');
    }

    // Now check excluded IDs (interactions)
    const excludedIds = new Set<string>();
    const [likes, passes, receivedPasses] = await Promise.all([
      client
        .from('interactions')
        .select('to_user')
        .eq('from_user', userId)
        .eq('action', 'like'),
      client
        .from('interactions')
        .select('to_user')
        .eq('from_user', userId)
        .eq('action', 'pass'),
      client
        .from('interactions')
        .select('from_user')
        .eq('to_user', userId)
        .eq('action', 'pass'),
    ]);

    (likes.data || []).forEach((row: any) => {
      if (row?.to_user) excludedIds.add(row.to_user);
    });
    (passes.data || []).forEach((row: any) => {
      if (row?.to_user) excludedIds.add(row.to_user);
    });
    (receivedPasses.data || []).forEach((row: any) => {
      if (row?.from_user) excludedIds.add(row.from_user);
    });

    console.log(`\n🚫 Usuarios excluidos por interacciones: ${excludedIds.size}`);
    if (excludedIds.size > 0) {
      Array.from(excludedIds).forEach((id) => {
        if (id === 'da07b052-39d7-42d8-8bee-78f5631939d2') {
          console.log(`   - chico1 (excluido)`);
        } else if (id === '02d8227d-1a86-48cd-884b-58be9bc04aef') {
          console.log(`   - chica1 (excluido)`);
        } else {
          console.log(`   - ${id}`);
        }
      });
    }

    // Check bidirectional filter
    const currentUserGender = currentUser.gender;
    console.log(`\n🔍 Verificando filtro bidireccional:`);
    if (data && data.length > 0) {
      const filtered = data.filter((row) => {
        if (excludedIds.has(row.id)) {
          return false;
        }

        const candidateGender = row.gender;
        const candidateLookingFor = row.looking_for;

        // Check if current user is looking for candidate's gender
        let currentLookingForCandidate = false;
        if (!currentUser.looking_for || currentUser.looking_for === 'both') {
          currentLookingForCandidate = true;
        } else if (currentUser.looking_for === 'male' && candidateGender === 'male') {
          currentLookingForCandidate = true;
        } else if (currentUser.looking_for === 'female' && candidateGender === 'female') {
          currentLookingForCandidate = true;
        }

        // Check if candidate is looking for current user's gender
        let candidateLookingForCurrent = false;
        if (!currentUserGender) {
          candidateLookingForCurrent = false;
        } else if (!candidateLookingFor || candidateLookingFor === 'both') {
          candidateLookingForCurrent = true;
        } else if (candidateLookingFor === 'male' && currentUserGender === 'male') {
          candidateLookingForCurrent = true;
        } else if (candidateLookingFor === 'female' && currentUserGender === 'female') {
          candidateLookingForCurrent = true;
        }

        return currentLookingForCandidate && candidateLookingForCurrent;
      });

      console.log(`\n📋 Resultados después del filtro bidireccional: ${filtered.length}`);
      filtered.forEach((user, index) => {
        console.log(`${index + 1}. ${user.id}`);
        if (user.id === 'da07b052-39d7-42d8-8bee-78f5631939d2') {
          console.log(`   ⭐ Este es chico1`);
        } else if (user.id === '02d8227d-1a86-48cd-884b-58be9bc04aef') {
          console.log(`   ⭐ Este es chica1`);
        }
      });

      // Check if chico1 or chica1 are in the filtered results
      const chico1InResults = filtered.some((u) => u.id === 'da07b052-39d7-42d8-8bee-78f5631939d2');
      const chica1InResults = filtered.some((u) => u.id === '02d8227d-1a86-48cd-884b-58be9bc04aef');

      console.log(`\n📊 Resumen:`);
      console.log(`   chico1 en resultados: ${chico1InResults ? '✅ SÍ' : '❌ NO'}`);
      console.log(`   chica1 en resultados: ${chica1InResults ? '✅ SÍ' : '❌ NO'}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();

