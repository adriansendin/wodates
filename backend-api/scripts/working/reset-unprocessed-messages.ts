/**
 * Script to reset messages as unprocessed for a specific user
 * 
 * This script sets profile_processed_at = NULL for all messages sent by a user,
 * allowing them to be processed again by the profile generation scripts.
 * 
 * Usage:
 *   npx tsx scripts/working/reset-unprocessed-messages.ts <userId>
 * 
 * Example:
 *   npx tsx scripts/working/reset-unprocessed-messages.ts 8e1139a4-e3ec-4e4c-964b-a98ad5417f71
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
    console.error('  npx tsx scripts/working/reset-unprocessed-messages.ts <userId>');
    console.error('\nExample:');
    console.error('  npx tsx scripts/working/reset-unprocessed-messages.ts 8e1139a4-e3ec-4e4c-964b-a98ad5417f71');
    process.exit(1);
  }

  // Validate UUID format
  if (!validateUserId(userId)) {
    console.error(`❌ Error: Invalid UUID format: ${userId}`);
    console.error('Please provide a valid UUID (e.g., 8e1139a4-e3ec-4e4c-964b-a98ad5417f71)');
    process.exit(1);
  }

  console.log('🔄 Resetting messages as unprocessed for user:', userId);
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

    // First, count how many messages will be affected
    const { count, error: countError } = await client
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', userId)
      .not('profile_processed_at', 'is', null);

    if (countError) {
      console.error('❌ Error counting messages:', countError.message);
      process.exit(1);
    }

    const messagesToReset = count || 0;

    if (messagesToReset === 0) {
      console.log('ℹ️  No processed messages found for this user.');
      console.log('   All messages are already unprocessed.');
      return;
    }

    console.log(`📊 Found ${messagesToReset} processed message(s) to reset`);
    console.log('');

    // Reset profile_processed_at to NULL for all messages sent by this user
    const { data, error } = await client
      .from('messages')
      .update({ profile_processed_at: null })
      .eq('sender_id', userId)
      .not('profile_processed_at', 'is', null)
      .select('id');

    if (error) {
      console.error('❌ Error resetting messages:', error.message);
      process.exit(1);
    }

    const resetCount = data?.length || 0;

    console.log('✅ Successfully reset messages as unprocessed');
    console.log(`   Messages reset: ${resetCount}`);
    console.log('');
    console.log('💡 You can now run the test script:');
    console.log(`   npx tsx scripts/working/test_llm_gen_biofromchats.ts`);

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



















