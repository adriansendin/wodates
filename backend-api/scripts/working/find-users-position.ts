/**
 * Script para encontrar la posición de chico1 y chica1 en los resultados del feed
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

    console.log('🔍 Buscando posición de chico1 y chica1 en el feed\n');

    // Check chico1's feed
    const { data: chico1Data } = await client
      .from('users')
      .select('id, looking_for, gender, city')
      .eq('id', chico1Id)
      .single();

    if (!chico1Data) {
      console.error('❌ chico1 no encontrado');
      return;
    }

    console.log('👤 chico1:');
    console.log(`   Busca: ${chico1Data.looking_for}`);
    console.log(`   Género: ${chico1Data.gender}`);
    console.log(`   Ciudad: ${chico1Data.city}\n`);

    // Build query for chico1 (buscando female en Barcelona)
    let query1 = client
      .from('users')
      .select('id, gender, looking_for, city')
      .neq('id', chico1Id)
      .lt('active_chats_count', 1)
      .or('is_bot.is.null,is_bot.eq.false')
      .eq('gender', 'female')
      .not('gender', 'is', null)
      .eq('city', 'Barcelona');

    // Get ALL results (no limit) to find chica1
    const { data: allResults1, error: error1 } = await query1;

    if (error1) {
      console.error('❌ Error:', error1.message);
      return;
    }

    console.log(`📊 Total usuarios que cumplen filtros SQL para chico1: ${allResults1?.length || 0}`);
    
    const chica1Position = allResults1?.findIndex((u: any) => u.id === chica1Id);
    if (chica1Position !== undefined && chica1Position >= 0) {
      console.log(`✅ chica1 está en la posición ${chica1Position + 1} de ${allResults1?.length}`);
      console.log(`   ${chica1Position < 10 ? '✅ Está en los primeros 10' : `❌ Está FUERA de los primeros 10 (posición ${chica1Position + 1})`}`);
    } else {
      console.log(`❌ chica1 NO está en los resultados SQL`);
      console.log(`   Esto significa que chica1 NO cumple los filtros SQL básicos`);
    }

    // Check chica1's feed
    const { data: chica1Data } = await client
      .from('users')
      .select('id, looking_for, gender, city')
      .eq('id', chica1Id)
      .single();

    if (!chica1Data) {
      console.error('❌ chica1 no encontrado');
      return;
    }

    console.log('\n👤 chica1:');
    console.log(`   Busca: ${chica1Data.looking_for}`);
    console.log(`   Género: ${chica1Data.gender}`);
    console.log(`   Ciudad: ${chica1Data.city}\n`);

    // Build query for chica1 (buscando male en Barcelona)
    let query2 = client
      .from('users')
      .select('id, gender, looking_for, city')
      .neq('id', chica1Id)
      .lt('active_chats_count', 1)
      .or('is_bot.is.null,is_bot.eq.false')
      .eq('gender', 'male')
      .not('gender', 'is', null)
      .eq('city', 'Barcelona');

    // Get ALL results (no limit) to find chico1
    const { data: allResults2, error: error2 } = await query2;

    if (error2) {
      console.error('❌ Error:', error2.message);
      return;
    }

    console.log(`📊 Total usuarios que cumplen filtros SQL para chica1: ${allResults2?.length || 0}`);
    
    const chico1Position = allResults2?.findIndex((u: any) => u.id === chico1Id);
    if (chico1Position !== undefined && chico1Position >= 0) {
      console.log(`✅ chico1 está en la posición ${chico1Position + 1} de ${allResults2?.length}`);
      console.log(`   ${chico1Position < 10 ? '✅ Está en los primeros 10' : `❌ Está FUERA de los primeros 10 (posición ${chico1Position + 1})`}`);
    } else {
      console.log(`❌ chico1 NO está en los resultados SQL`);
      console.log(`   Esto significa que chico1 NO cumple los filtros SQL básicos`);
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📋 RESUMEN:');
    console.log('='.repeat(80));
    
    if (chica1Position !== undefined && chica1Position >= 0 && chica1Position < 10) {
      console.log('✅ chico1 SÍ debería ver a chica1 (está en posición < 10)');
    } else if (chica1Position !== undefined && chica1Position >= 0) {
      console.log(`⚠️ chico1 NO ve a chica1 porque está en posición ${chica1Position + 1} (límite es 10)`);
    } else {
      console.log('❌ chico1 NO ve a chica1 porque chica1 no cumple los filtros SQL');
    }

    if (chico1Position !== undefined && chico1Position >= 0 && chico1Position < 10) {
      console.log('✅ chica1 SÍ debería ver a chico1 (está en posición < 10)');
    } else if (chico1Position !== undefined && chico1Position >= 0) {
      console.log(`⚠️ chica1 NO ve a chico1 porque está en posición ${chico1Position + 1} (límite es 10)`);
    } else {
      console.log('❌ chica1 NO ve a chico1 porque chico1 no cumple los filtros SQL');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();

