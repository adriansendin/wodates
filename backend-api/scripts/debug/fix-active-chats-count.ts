/**
 * Script para recalcular active_chats_count para usuarios específicos o todos
 * 
 * Este script recalcula el active_chats_count basándose en los chats reales,
 * excluyendo bots y chats bloqueados.
 * 
 * Uso:
 *   npx tsx scripts/debug/fix-active-chats-count.ts [userId1] [userId2] ...
 *   Si no se proporcionan IDs, recalcula para TODOS los usuarios
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

async function recalculateActiveChatsCount(
  client: SupabaseClient,
  userId: string
): Promise<{ before: number; after: number }> {
  // Get current value
  const { data: userBefore, error: beforeError } = await client
    .from('users')
    .select('active_chats_count')
    .eq('id', userId)
    .single();

  if (beforeError || !userBefore) {
    throw new Error(`Failed to get user ${userId}: ${beforeError?.message}`);
  }

  const before = userBefore.active_chats_count ?? 0;

  // Get all chats for this user
  const { data: participants, error: participantsError } = await client
    .from('chat_participants')
    .select('chat_id')
    .eq('user_id', userId);

  if (participantsError) {
    throw new Error(`Failed to get participants: ${participantsError.message}`);
  }

  const chatIds = participants?.map((p) => p.chat_id) ?? [];

  if (chatIds.length === 0) {
    // No chats, set to 0
    const { error: updateError } = await client
      .from('users')
      .update({ active_chats_count: 0 })
      .eq('id', userId);

    if (updateError) {
      throw new Error(`Failed to update: ${updateError.message}`);
    }

    return { before, after: 0 };
  }

  // Get all participants for these chats
  const { data: allParticipants, error: allParticipantsError } = await client
    .from('chat_participants')
    .select('chat_id, user_id')
    .in('chat_id', chatIds);

  if (allParticipantsError) {
    throw new Error(`Failed to get all participants: ${allParticipantsError.message}`);
  }

  // Group by chat_id
  const chatsMap = new Map<string, string[]>();
  for (const p of allParticipants ?? []) {
    if (!chatsMap.has(p.chat_id)) {
      chatsMap.set(p.chat_id, []);
    }
    chatsMap.get(p.chat_id)!.push(p.user_id);
  }

  // Get blocks for this user
  const { data: blocks, error: blocksError } = await client
    .from('blocked_users')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

  if (blocksError) {
    throw new Error(`Failed to get blocks: ${blocksError.message}`);
  }

  const blockedUserIds = new Set<string>();
  for (const block of blocks ?? []) {
    if (block.blocker_id === userId) {
      blockedUserIds.add(block.blocked_id);
    } else {
      blockedUserIds.add(block.blocker_id);
    }
  }

  // Get bot status for all other participants
  const otherParticipantIds = Array.from(
    new Set(
      Array.from(chatsMap.values())
        .flat()
        .filter((id) => id !== userId)
    )
  );

  if (otherParticipantIds.length === 0) {
    // No other participants, set to 0
    const { error: updateError } = await client
      .from('users')
      .update({ active_chats_count: 0 })
      .eq('id', userId);

    if (updateError) {
      throw new Error(`Failed to update: ${updateError.message}`);
    }

    return { before, after: 0 };
  }

  const { data: users, error: usersError } = await client
    .from('users')
    .select('id, is_bot')
    .in('id', otherParticipantIds);

  if (usersError) {
    throw new Error(`Failed to get user bot status: ${usersError.message}`);
  }

  const botUserIds = new Set(
    (users ?? []).filter((u) => u.is_bot === true).map((u) => u.id)
  );

  // Count active chats (excluding bots and blocked users)
  let activeChatsCount = 0;
  for (const [, participantIds] of chatsMap.entries()) {
    const otherParticipantId = participantIds.find((id) => id !== userId);
    if (!otherParticipantId) {
      continue;
    }

    // Exclude bots
    if (botUserIds.has(otherParticipantId)) {
      continue;
    }

    // Exclude blocked users
    if (blockedUserIds.has(otherParticipantId)) {
      continue;
    }

    activeChatsCount++;
  }

  // Update active_chats_count
  const { error: updateError } = await client
    .from('users')
    .update({ active_chats_count: activeChatsCount })
    .eq('id', userId);

  if (updateError) {
    throw new Error(`Failed to update: ${updateError.message}`);
  }

  return { before, after: activeChatsCount };
}

async function getAllUserIds(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client
    .from('users')
    .select('id')
    .or('is_bot.is.null,is_bot.eq.false');

  if (error) {
    throw new Error(`Failed to get users: ${error.message}`);
  }

  return (data ?? []).map((row) => row.id);
}

async function main() {
  const args = process.argv.slice(2);
  const userIds = args.length > 0 ? args : null;

  console.log('🔧 RECALCULANDO active_chats_count\n');

  try {
    const config = getSupabaseConfig();
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let targetUserIds: string[];
    if (userIds) {
      targetUserIds = userIds;
      console.log(`Recalculando para ${targetUserIds.length} usuario(s) específico(s)`);
    } else {
      targetUserIds = await getAllUserIds(client);
      console.log(`Recalculando para TODOS los usuarios (${targetUserIds.length})`);
    }

    let successCount = 0;
    let errorCount = 0;
    const changes: Array<{ userId: string; before: number; after: number }> = [];

    for (let i = 0; i < targetUserIds.length; i++) {
      const userId = targetUserIds[i];
      const userNumber = i + 1;

      try {
        const result = await recalculateActiveChatsCount(client, userId);
        changes.push({ userId, ...result });

        if (result.before !== result.after) {
          console.log(
            `[${userNumber}/${targetUserIds.length}] ${userId}: ${result.before} -> ${result.after} ${result.before !== result.after ? '⚠️ CAMBIO' : ''}`
          );
        } else {
          console.log(
            `[${userNumber}/${targetUserIds.length}] ${userId}: ${result.before} (sin cambios)`
          );
        }

        successCount++;
      } catch (error) {
        console.error(
          `[${userNumber}/${targetUserIds.length}] ${userId}: ERROR - ${error instanceof Error ? error.message : String(error)}`
        );
        errorCount++;
      }
    }

    console.log('\n✅ Recalculación completada');
    console.log(`   Exitosos: ${successCount}`);
    console.log(`   Errores: ${errorCount}`);

    const changedCount = changes.filter((c) => c.before !== c.after).length;
    if (changedCount > 0) {
      console.log(`   Cambios realizados: ${changedCount}`);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

