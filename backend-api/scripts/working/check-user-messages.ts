/**
 * Script to check messages status for a specific user
 * 
 * This script shows:
 * - Total messages sent by the user
 * - Processed messages count
 * - Unprocessed messages count
 * - Matches/chats the user is part of
 * 
 * Usage:
 *   npx tsx scripts/working/check-user-messages.ts <userId>
 * 
 * Example:
 *   npx tsx scripts/working/check-user-messages.ts 8e1139a4-e3ec-4e4c-964b-a98ad5417f71
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

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

function validateUserId(userId: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(userId);
}

async function main() {
  // Get userId from command line arguments
  const userId = process.argv[2];

  if (!userId) {
    console.error('❌ Error: User ID is required');
    console.error('\nUsage:');
    console.error('  npx tsx scripts/working/check-user-messages.ts <userId>');
    console.error('\nExample:');
    console.error('  npx tsx scripts/working/check-user-messages.ts 8e1139a4-e3ec-4e4c-964b-a98ad5417f71');
    process.exit(1);
  }

  // Validate UUID format
  if (!validateUserId(userId)) {
    console.error(`❌ Error: Invalid UUID format: ${userId}`);
    console.error('Please provide a valid UUID (e.g., 8e1139a4-e3ec-4e4c-964b-a98ad5417f71)');
    process.exit(1);
  }

  console.log('🔍 Checking messages for user:', userId);
  console.log('─'.repeat(60));
  console.log('');

  try {
    // Get configuration
    const config = getSupabaseConfig();
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if user exists in public.users
    const { data: user, error: userError } = await client
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      console.error('❌ Error checking user:', userError.message);
      process.exit(1);
    }

    if (!user) {
      console.error('❌ User not found in public.users table');
      process.exit(1);
    }

    console.log('👤 User found in database');
    console.log(`   User ID: ${userId}`);
    console.log('');

    // Count total messages sent by this user
    const { count: totalCount, error: totalError } = await client
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', userId);

    if (totalError) {
      console.error('❌ Error counting total messages:', totalError.message);
      process.exit(1);
    }

    // Count processed messages
    const { count: processedCount, error: processedError } = await client
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', userId)
      .not('profile_processed_at', 'is', null);

    if (processedError) {
      console.error('❌ Error counting processed messages:', processedError.message);
      process.exit(1);
    }

    // Count unprocessed messages
    const { count: unprocessedCount, error: unprocessedError } = await client
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', userId)
      .is('profile_processed_at', null);

    if (unprocessedError) {
      console.error('❌ Error counting unprocessed messages:', unprocessedError.message);
      process.exit(1);
    }

    console.log('📊 Messages Statistics:');
    console.log(`   Total messages sent: ${totalCount || 0}`);
    console.log(`   Processed messages: ${processedCount || 0}`);
    console.log(`   Unprocessed messages: ${unprocessedCount || 0}`);
    console.log('');

    // Get chats for this user via chat_participants
    const { data: chatParticipants, error: participantsError } = await client
      .from('chat_participants')
      .select('chat_id, chats(id, created_at)')
      .eq('user_id', userId)
      .order('chats(created_at)', { ascending: false })
      .limit(10);

    if (participantsError) {
      console.error('❌ Error fetching chats:', participantsError.message);
      // Don't exit, continue with the rest of the info
    } else {
      console.log(`💬 Chats (showing up to 10 most recent): ${chatParticipants?.length || 0}`);
      if (chatParticipants && chatParticipants.length > 0) {
        for (const participant of chatParticipants) {
          const chatId = participant.chat_id;
          const chat = Array.isArray(participant.chats) ? participant.chats[0] : participant.chats;
          
          // Count messages in this chat
          const { count: chatMsgCount } = await client
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('chat_id', chatId);

          // Count unprocessed messages in this chat for this user
          const { count: chatUnprocessedCount } = await client
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('chat_id', chatId)
            .eq('sender_id', userId)
            .is('profile_processed_at', null);

          console.log(`   Chat ${chatId.substring(0, 8)}... - ${chatMsgCount || 0} total msgs, ${chatUnprocessedCount || 0} unprocessed`);
        }
      } else {
        console.log('   No chats found for this user');
      }
    }

    console.log('');
    
    if (totalCount === 0) {
      console.log('⚠️  This user has no messages. The test script will not find anything to process.');
      console.log('   You need to create messages for this user first.');
    } else if (unprocessedCount === 0) {
      console.log('⚠️  This user has messages but all are marked as processed.');
      console.log('   Run the reset script to mark them as unprocessed:');
      console.log(`   npx tsx scripts/working/reset-unprocessed-messages.ts ${userId}`);
    } else {
      console.log('✅ This user has unprocessed messages. The test script should work.');
    }

  } catch (error) {
    console.error('\n❌ Unexpected error:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    } else {
      console.error('   Unknown error:', error);
    }
    process.exit(1);
  }
}

// Run the script
main();

