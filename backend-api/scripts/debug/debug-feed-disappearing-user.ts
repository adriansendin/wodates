/**
 * Script de diagnóstico para identificar por qué un usuario desaparece del feed
 * 
 * Este script verifica:
 * 1. Si Doc Love está marcado como bot
 * 2. El active_chats_count del usuario B
 * 3. Los filtros que se aplican en el feed
 * 4. Si hay interacciones previas que excluyen al usuario
 * 
 * Uso:
 *   npx tsx scripts/debug/debug-feed-disappearing-user.ts <userIdB>
 */

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  return { url, serviceRoleKey };
}

async function getDocLoveInfo(client: SupabaseClient) {
  console.log('\n=== DOC LOVE INFO ===');
  
  // Get Doc Love user ID (with pagination)
  const searchEmail = 'doclove@wodates.com';
  const normalizedSearchEmail = searchEmail.toLowerCase().trim();
  let page = 1;
  const perPage = 1000;
  let docLoveUser = null;

  while (!docLoveUser) {
    const { data: authUsers, error: authError } = await client.auth.admin.listUsers({
      page,
      perPage,
    });

    if (authError) {
      console.error(`Error fetching auth users (page ${page}):`, authError);
      return null;
    }

    const users = authUsers.users || [];

    // Search for Doc Love by email (case-insensitive)
    docLoveUser =
      users.find(
        (user) => user.email?.toLowerCase().trim() === normalizedSearchEmail
      ) || null;

    if (docLoveUser) {
      break;
    }

    // If we got fewer users than perPage, we've reached the end
    if (users.length < perPage) {
      break;
    }

    // Move to next page
    page++;
  }

  if (!docLoveUser) {
    console.error('❌ Doc Love user not found in auth.users');
    return null;
  }

  console.log(`✅ Doc Love found in auth.users: ${docLoveUser.id}`);

  // Get Doc Love info from public.users
  const { data: publicUser, error: publicError } = await client
    .from('users')
    .select('id, is_bot, active_chats_count, city, gender, looking_for')
    .eq('id', docLoveUser.id)
    .single();

  if (publicError || !publicUser) {
    console.error('❌ Doc Love not found in public.users:', publicError);
    return null;
  }

  console.log(`   is_bot: ${publicUser.is_bot} ${publicUser.is_bot ? '✅' : '❌ PROBLEMA!'}`);
  console.log(`   active_chats_count: ${publicUser.active_chats_count ?? 0}`);
  console.log(`   city: ${publicUser.city ?? 'null'}`);
  console.log(`   gender: ${publicUser.gender ?? 'null'}`);
  console.log(`   looking_for: ${publicUser.looking_for ?? 'null'}`);

  return docLoveUser.id;
}

async function getUserInfo(client: SupabaseClient, userId: string) {
  console.log(`\n=== USER INFO (${userId}) ===`);

  const { data: user, error } = await client
    .from('users')
    .select('id, is_bot, active_chats_count, city, gender, looking_for, bio')
    .eq('id', userId)
    .single();

  if (error || !user) {
    console.error(`❌ User not found:`, error);
    return null;
  }

  console.log(`   is_bot: ${user.is_bot ?? false}`);
  console.log(`   active_chats_count: ${user.active_chats_count ?? 0} ${(user.active_chats_count ?? 0) >= 1 ? '❌ PROBLEMA!' : '✅'}`);
  console.log(`   city: ${user.city ?? 'null'}`);
  console.log(`   gender: ${user.gender ?? 'null'}`);
  console.log(`   looking_for: ${user.looking_for ?? 'null'}`);
  console.log(`   bio: ${user.bio ? `${user.bio.substring(0, 50)}...` : 'null'}`);

  return user;
}

async function getChatsInfo(client: SupabaseClient, userId: string, docLoveId: string) {
  console.log(`\n=== CHATS INFO (${userId}) ===`);

  // Get all chats for this user
  const { data: participants, error: participantsError } = await client
    .from('chat_participants')
    .select('chat_id, user_id')
    .eq('user_id', userId);

  if (participantsError) {
    console.error('Error fetching chat participants:', participantsError);
    return;
  }

  const chatIds = participants?.map((p) => p.chat_id) ?? [];
  console.log(`   Total chats: ${chatIds.length}`);

  if (chatIds.length === 0) {
    return;
  }

  // Get all participants for these chats
  const { data: allParticipants, error: allParticipantsError } = await client
    .from('chat_participants')
    .select('chat_id, user_id')
    .in('chat_id', chatIds);

  if (allParticipantsError) {
    console.error('Error fetching all participants:', allParticipantsError);
    return;
  }

  // Group by chat_id
  const chatsMap = new Map<string, string[]>();
  for (const p of allParticipants ?? []) {
    if (!chatsMap.has(p.chat_id)) {
      chatsMap.set(p.chat_id, []);
    }
    chatsMap.get(p.chat_id)!.push(p.user_id);
  }

  // Get bot status for all participants
  const allParticipantIds = Array.from(
    new Set(
      Array.from(chatsMap.values())
        .flat()
        .filter((id) => id !== userId)
    )
  );

  const { data: users, error: usersError } = await client
    .from('users')
    .select('id, is_bot')
    .in('id', allParticipantIds);

  if (usersError) {
    console.error('Error fetching user bot status:', usersError);
    return;
  }

  const botUserIds = new Set(
    (users ?? []).filter((u) => u.is_bot === true).map((u) => u.id)
  );

  console.log(`   Bot participants: ${botUserIds.size}`);
  console.log(`   Doc Love is bot: ${botUserIds.has(docLoveId) ? '✅' : '❌ PROBLEMA!'}`);

  // Count active chats (excluding bots)
  let activeChatsCount = 0;
  for (const [chatId, participantIds] of chatsMap.entries()) {
    const otherParticipantId = participantIds.find((id) => id !== userId);
    if (!otherParticipantId) {
      continue;
    }

    // Exclude bots
    if (botUserIds.has(otherParticipantId)) {
      console.log(`   Chat ${chatId}: Excluded (bot: ${otherParticipantId === docLoveId ? 'Doc Love' : otherParticipantId})`);
      continue;
    }

    activeChatsCount++;
    console.log(`   Chat ${chatId}: Active (with user: ${otherParticipantId})`);
  }

  console.log(`   Calculated active_chats_count: ${activeChatsCount}`);
}

async function getInteractionsInfo(client: SupabaseClient, userIdA: string, userIdB: string) {
  console.log(`\n=== INTERACTIONS INFO (A -> B) ===`);

  // Get likes from A to B
  const { data: likes, error: likesError } = await client
    .from('interactions')
    .select('id, action, created_at')
    .eq('from_user', userIdA)
    .eq('to_user', userIdB);

  if (likesError) {
    console.error('Error fetching likes:', likesError);
  } else {
    console.log(`   Likes from A to B: ${likes?.length ?? 0}`);
    if (likes && likes.length > 0) {
      console.log(`   ❌ PROBLEMA! User A already liked User B`);
    }
  }

  // Get passes from A to B
  const { data: passes, error: passesError } = await client
    .from('interactions')
    .select('id, action, created_at')
    .eq('from_user', userIdA)
    .eq('to_user', userIdB)
    .eq('action', 'pass');

  if (passesError) {
    console.error('Error fetching passes:', passesError);
  } else {
    console.log(`   Passes from A to B: ${passes?.length ?? 0}`);
    if (passes && passes.length > 0) {
      console.log(`   ❌ PROBLEMA! User A already passed User B`);
    }
  }

  // Get passes from B to A
  const { data: receivedPasses, error: receivedPassesError } = await client
    .from('interactions')
    .select('id, action, created_at')
    .eq('from_user', userIdB)
    .eq('to_user', userIdA)
    .eq('action', 'pass');

  if (receivedPassesError) {
    console.error('Error fetching received passes:', receivedPassesError);
  } else {
    console.log(`   Passes from B to A: ${receivedPasses?.length ?? 0}`);
    if (receivedPasses && receivedPasses.length > 0) {
      console.log(`   ❌ PROBLEMA! User B passed User A (bidirectional exclusion)`);
    }
  }
}

async function checkFeedFilters(client: SupabaseClient, userIdA: string, userIdB: string) {
  console.log(`\n=== FEED FILTERS CHECK ===`);

  // Get user A info
  const { data: userA, error: userAError } = await client
    .from('users')
    .select('id, city, gender, looking_for')
    .eq('id', userIdA)
    .single();

  if (userAError || !userA) {
    console.error('Error fetching user A:', userAError);
    return;
  }

  // Get user B info
  const { data: userB, error: userBError } = await client
    .from('users')
    .select('id, city, gender, looking_for, active_chats_count, is_bot')
    .eq('id', userIdB)
    .single();

  if (userBError || !userB) {
    console.error('Error fetching user B:', userBError);
    return;
  }

  console.log(`\nChecking if User B passes feed filters for User A:`);

  // Filter 1: active_chats_count < 1
  const activeChatsCount = userB.active_chats_count ?? 0;
  console.log(`   1. active_chats_count < 1: ${activeChatsCount} ${activeChatsCount < 1 ? '✅' : '❌ FAIL'}`);

  // Filter 2: is_bot = false or null
  const isBot = userB.is_bot ?? false;
  console.log(`   2. is_bot = false/null: ${!isBot} ${!isBot ? '✅' : '❌ FAIL'}`);

  // Filter 3: city match (if user A has city)
  if (userA.city) {
    const cityMatch = userB.city === userA.city;
    console.log(`   3. city match: ${cityMatch} ${cityMatch ? '✅' : '❌ FAIL'} (A: ${userA.city}, B: ${userB.city ?? 'null'})`);
  } else {
    console.log(`   3. city match: ✅ (User A has no city filter)`);
  }

  // Filter 4: gender filter (bidirectional)
  // Check if A is looking for B's gender
  const aLookingFor = userA.looking_for;
  const bGender = userB.gender;
  let aLookingForB = false;
  
  if (!aLookingFor || aLookingFor === 'both') {
    aLookingForB = true;
  } else if (aLookingFor === 'male' && bGender === 'male') {
    aLookingForB = true;
  } else if (aLookingFor === 'female' && bGender === 'female') {
    aLookingForB = true;
  }

  console.log(`   4. A looking for B's gender: ${aLookingForB} ${aLookingForB ? '✅' : '❌ FAIL'} (A looking_for: ${aLookingFor ?? 'null'}, B gender: ${bGender ?? 'null'})`);

  // Check if B is looking for A's gender
  const bLookingFor = userB.looking_for;
  const aGender = userA.gender;
  let bLookingForA = false;
  
  if (!bLookingFor || bLookingFor === 'both') {
    bLookingForA = true;
  } else if (bLookingFor === 'male' && aGender === 'male') {
    bLookingForA = true;
  } else if (bLookingFor === 'female' && aGender === 'female') {
    bLookingForA = true;
  }

  console.log(`   5. B looking for A's gender: ${bLookingForA} ${bLookingForA ? '✅' : '❌ FAIL'} (B looking_for: ${bLookingFor ?? 'null'}, A gender: ${aGender ?? 'null'})`);

  // Summary
  const allPass = activeChatsCount < 1 && !isBot && (aLookingForB && bLookingForA);
  console.log(`\n   RESULT: ${allPass ? '✅ User B SHOULD appear in feed' : '❌ User B will NOT appear in feed'}`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: npx tsx scripts/debug/debug-feed-disappearing-user.ts <userIdB> [userIdA]');
    console.error('  userIdB: ID del usuario que desapareció del feed');
    console.error('  userIdA: ID del usuario que está viendo el feed (opcional, para verificar interacciones)');
    process.exit(1);
  }

  const userIdB = args[0];
  const userIdA = args[1];

  console.log('🔍 DIAGNÓSTICO: Usuario desapareciendo del feed\n');
  console.log(`User B (desaparecido): ${userIdB}`);
  if (userIdA) {
    console.log(`User A (viendo feed): ${userIdA}`);
  }

  try {
    const config = getSupabaseConfig();
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Check Doc Love
    const docLoveId = await getDocLoveInfo(client);
    if (!docLoveId) {
      console.error('\n❌ No se puede continuar sin Doc Love');
      process.exit(1);
    }

    // 2. Get User B info
    const userB = await getUserInfo(client, userIdB);
    if (!userB) {
      console.error('\n❌ No se puede continuar sin User B');
      process.exit(1);
    }

    // 3. Get chats info
    await getChatsInfo(client, userIdB, docLoveId);

    // 4. Get interactions info (if userIdA provided)
    if (userIdA) {
      await getInteractionsInfo(client, userIdA, userIdB);
      await checkFeedFilters(client, userIdA, userIdB);
    }

    console.log('\n✅ Diagnóstico completado');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

