/**
 * Script para debuggear por qué el feed está vacío para usuarios nuevos
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
  const chico1Id = 'da07b052-39d7-42d8-8bee-78f5631939d2';
  const chica1Id = '02d8227d-1a86-48cd-884b-58be9bc04aef';

  try {
    const config = getSupabaseConfig();
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('🔍 Debug: Por qué el feed está vacío para usuarios nuevos\n');

    // Check both users
    for (const [name, userId] of [
      ['chico1', chico1Id],
      ['chica1', chica1Id],
    ]) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`👤 Analizando feed para: ${name} (${userId})`);
      console.log('='.repeat(80));

      // 1. Get current user data
      const { data: currentUser, error: userError } = await client
        .from('users')
        .select('id, looking_for, gender, city, active_chats_count, is_bot')
        .eq('id', userId)
        .single();

      if (userError || !currentUser) {
        console.error(`❌ Error obteniendo usuario:`, userError?.message);
        continue;
      }

      console.log(`\n📋 Datos del usuario:`);
      console.log(`   Género: ${currentUser.gender || 'NULL ⚠️'}`);
      console.log(`   Buscando: ${currentUser.looking_for || 'NULL ⚠️'}`);
      console.log(`   Ciudad: ${currentUser.city || 'NULL'}`);
      console.log(`   Chats activos: ${currentUser.active_chats_count}`);
      console.log(`   Es bot: ${currentUser.is_bot ?? 'NULL'}`);

      // 2. Check interactions (should be empty for new users)
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

      const excludedIds = new Set<string>();
      (likes.data || []).forEach((row: any) => {
        if (row?.to_user) excludedIds.add(row.to_user);
      });
      (passes.data || []).forEach((row: any) => {
        if (row?.to_user) excludedIds.add(row.to_user);
      });
      (receivedPasses.data || []).forEach((row: any) => {
        if (row?.from_user) excludedIds.add(row.from_user);
      });

      console.log(`\n🚫 Interacciones (usuarios excluidos): ${excludedIds.size}`);
      if (excludedIds.size > 0) {
        console.log(`   ⚠️ Hay ${excludedIds.size} usuarios excluidos por interacciones`);
        Array.from(excludedIds).forEach((id) => console.log(`      - ${id}`));
      } else {
        console.log(`   ✅ No hay interacciones (correcto para usuarios nuevos)`);
      }

      // 3. Build SQL query exactly as in code
      let genderFilter: 'any' | string[] = 'any';
      if (currentUser.looking_for && currentUser.looking_for !== 'both') {
        genderFilter = [currentUser.looking_for];
      }

      console.log(`\n🔍 Construyendo consulta SQL:`);
      console.log(`   Filtro de género: ${genderFilter === 'any' ? 'cualquiera' : genderFilter.join(', ')}`);
      console.log(`   Filtro de ciudad: ${currentUser.city || 'ninguno'}`);

      let query = client
        .from('users')
        .select('id, birthDate, gender, looking_for, bio, city')
        .neq('id', userId)
        .lt('active_chats_count', 1)
        .or('is_bot.is.null,is_bot.eq.false');

      if (genderFilter !== 'any') {
        query = query.in('gender', genderFilter);
      }

      if (currentUser.city) {
        query = query.eq('city', currentUser.city);
      }

      // First, count total
      const countQuery = query.select('id', { count: 'exact', head: true });
      const { count } = await countQuery;
      console.log(`   Total usuarios que cumplen filtros SQL: ${count || 0}`);

      // Then get first 10
      const { data: sqlResults, error: sqlError } = await query.range(0, 9);

      if (sqlError) {
        console.error(`❌ Error en consulta SQL:`, sqlError.message);
        continue;
      }

      console.log(`   Usuarios devueltos por SQL (primeros 10): ${sqlResults?.length || 0}`);

      if (!sqlResults || sqlResults.length === 0) {
        console.log(`\n❌ PROBLEMA: La consulta SQL no devuelve ningún usuario`);
        console.log(`   Esto significa que no hay usuarios que cumplan los filtros básicos`);
        continue;
      }

      // 4. Apply TypeScript filters
      console.log(`\n🔍 Aplicando filtros TypeScript:`);

      const currentUserGender = currentUser.gender;
      const filtered = sqlResults.filter((row: any) => {
        // Exclude by interactions
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

        if (!currentLookingForCandidate) {
          return false;
        }

        // Check if candidate is looking for current user's gender
        if (!currentUserGender) {
          return false; // This is the bug!
        }

        let candidateLookingForCurrent = false;
        if (!candidateLookingFor || candidateLookingFor === 'both') {
          candidateLookingForCurrent = true;
        } else if (candidateLookingFor === 'male' && currentUserGender === 'male') {
          candidateLookingForCurrent = true;
        } else if (candidateLookingFor === 'female' && currentUserGender === 'female') {
          candidateLookingForCurrent = true;
        }

        return candidateLookingForCurrent;
      });

      console.log(`   Usuarios después de filtros TypeScript: ${filtered.length}`);

      if (filtered.length === 0) {
        console.log(`\n❌ PROBLEMA: Después de los filtros TypeScript quedan 0 usuarios`);
        console.log(`\n🔍 Analizando por qué se filtran:`);

        sqlResults.forEach((row: any) => {
          const isExcluded = excludedIds.has(row.id);
          const candidateGender = row.gender;
          const candidateLookingFor = row.looking_for;

          // Check filters
          let currentLookingForCandidate = false;
          if (!currentUser.looking_for || currentUser.looking_for === 'both') {
            currentLookingForCandidate = true;
          } else if (currentUser.looking_for === 'male' && candidateGender === 'male') {
            currentLookingForCandidate = true;
          } else if (currentUser.looking_for === 'female' && candidateGender === 'female') {
            currentLookingForCandidate = true;
          }

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

          console.log(`\n   Usuario: ${row.id}`);
          console.log(`     Género: ${candidateGender || 'NULL'}`);
          console.log(`     Buscando: ${candidateLookingFor || 'NULL'}`);
          console.log(`     Excluido por interacciones: ${isExcluded ? 'SÍ ❌' : 'NO ✅'}`);
          console.log(`     Usuario actual busca candidato: ${currentLookingForCandidate ? 'SÍ ✅' : 'NO ❌'}`);
          console.log(`     Candidato busca usuario actual: ${candidateLookingForCurrent ? 'SÍ ✅' : 'NO ❌'}`);

          if (isExcluded) {
            console.log(`     ⚠️ RAZÓN: Excluido por interacciones previas`);
          } else if (!currentLookingForCandidate) {
            console.log(`     ⚠️ RAZÓN: ${name} (busca: ${currentUser.looking_for}) NO busca género ${candidateGender}`);
          } else if (!candidateLookingForCurrent) {
            console.log(`     ⚠️ RAZÓN: Candidato (busca: ${candidateLookingFor}) NO busca género ${currentUserGender}`);
          }
        });
      } else {
        console.log(`\n✅ Usuarios que pasarían los filtros:`);
        filtered.forEach((row: any, index: number) => {
          console.log(`   ${index + 1}. ${row.id} (género: ${row.gender}, busca: ${row.looking_for})`);
        });
      }

      // 5. Check if the other user is in SQL results
      const otherUserId = name === 'chico1' ? chica1Id : chico1Id;
      const otherUserInResults = sqlResults?.some((r: any) => r.id === otherUserId);
      console.log(`\n🔍 ¿El otro usuario está en los resultados SQL?: ${otherUserInResults ? '✅ SÍ' : '❌ NO'}`);

      if (!otherUserInResults) {
        console.log(`   ⚠️ El otro usuario no está en los primeros 10 resultados de la consulta SQL`);
        console.log(`   Esto puede ser porque:`);
        console.log(`     1. Hay más de 10 usuarios que cumplen los filtros`);
        console.log(`     2. El otro usuario no cumple los filtros SQL básicos`);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();

