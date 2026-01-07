/**
 * Script para verificar el estado de un chat específico
 */

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return { url, serviceRoleKey };
}

async function checkChatStatus(client: SupabaseClient, userId: string, chatId: string) {
  console.log(`\n=== CHAT STATUS: ${chatId} ===`);

  // Get participants
  const { data: participants, error: participantsError } = await client
    .from('chat_participants')
    .select('user_id')
    .eq('chat_id', chatId);

  if (participantsError) {
    console.error('Error:', participantsError);
    return;
  }

  const participantIds = participants?.map((p) => p.user_id) ?? [];
  console.log(`Participants: ${participantIds.join(', ')}`);

  const otherParticipantId = participantIds.find((id) => id !== userId);
  if (!otherParticipantId) {
    console.log('No other participant found');
    return;
  }

  console.log(`Other participant: ${otherParticipantId}`);

  // Check if other participant is bot
  const { data: otherUser, error: userError } = await client
    .from('users')
    .select('id, is_bot')
    .eq('id', otherParticipantId)
    .single();

  if (userError) {
    console.error('Error getting user:', userError);
  } else {
    console.log(`Other user is_bot: ${otherUser.is_bot ?? false} ${otherUser.is_bot ? '❌ (excluded)' : '✅'}`);
  }

  // Check for blocks
  const { data: blocks, error: blocksError } = await client
    .from('blocked_users')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
    .or(`blocker_id.eq.${otherParticipantId},blocked_id.eq.${otherParticipantId}`);

  if (blocksError) {
    console.error('Error getting blocks:', blocksError);
  } else {
    const hasBlock = (blocks ?? []).some(
      (b) =>
        (b.blocker_id === userId && b.blocked_id === otherParticipantId) ||
        (b.blocker_id === otherParticipantId && b.blocked_id === userId)
    );
    console.log(`Has block: ${hasBlock} ${hasBlock ? '❌ (excluded)' : '✅'}`);
  }

  // Check messages
  const { data: messages, error: messagesError } = await client
    .from('messages')
    .select('id, sender_id, content, created_at')
    .eq('match_id', chatId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (messagesError) {
    console.error('Error getting messages:', messagesError);
  } else {
    console.log(`Messages count: ${messages?.length ?? 0}`);
    if (messages && messages.length > 0) {
      console.log('Last messages:');
      messages.forEach((msg) => {
        console.log(`  - ${msg.sender_id === userId ? 'You' : 'Other'}: ${msg.content.substring(0, 50)}...`);
      });
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: npx tsx scripts/debug/check-chat-status.ts <userId> <chatId>');
    process.exit(1);
  }

  const userId = args[0];
  const chatId = args[1];

  try {
    const config = getSupabaseConfig();
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await checkChatStatus(client, userId, chatId);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

