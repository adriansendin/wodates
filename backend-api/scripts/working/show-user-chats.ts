/**
 * Script to show all unprocessed chats for a user
 * 
 * This script retrieves and displays all unprocessed messages from all chats
 * (with regular users and Doc Love) for a given user ID.
 * 
 * Usage:
 *   npx tsx scripts/working/show-user-chats.ts <userId>
 * 
 * Example:
 *   npx tsx scripts/working/show-user-chats.ts 8e1139a4-e3ec-4e4c-964b-a98ad5417f71
 */

import 'dotenv/config';
import { DocLoveHelper } from '../../src/app/services/doc-love-helper';
import { SupabaseMatchRepository } from '../../src/data/repositories/SupabaseMatchRepository';
import { SupabaseUserRepository } from '../../src/data/repositories/SupabaseUserRepository';
import { SupabaseMessageRepository } from '../../src/data/repositories/SupabaseMessageRepository';
import { GetAllUserChats } from '../../src/domain/use-cases/chat/GetAllUserChats';
import { GetUnprocessedMessages } from '../../src/domain/use-cases/chat/GetUnprocessedMessages';

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
    console.error('  npx tsx scripts/working/show-user-chats.ts <userId>');
    console.error('\nExample:');
    console.error('  npx tsx scripts/working/show-user-chats.ts 8e1139a4-e3ec-4e4c-964b-a98ad5417f71');
    process.exit(1);
  }

  // Validate UUID format
  if (!validateUserId(userId)) {
    console.error(`❌ Error: Invalid UUID format: ${userId}`);
    console.error('Please provide a valid UUID (e.g., 8e1139a4-e3ec-4e4c-964b-a98ad5417f71)');
    process.exit(1);
  }

  console.log('🚀 Starting chat export for user:', userId);
  console.log('─'.repeat(60));
  console.log('');

  try {
    // Get configuration
    const config = getSupabaseConfig();

    // Initialize repositories
    const matchRepository = new SupabaseMatchRepository(config);
    const userRepository = new SupabaseUserRepository();
    const messageRepository = new SupabaseMessageRepository(config);
    const docLoveHelper = new DocLoveHelper(config);

    // Initialize use cases
    const getUnprocessedMessages = new GetUnprocessedMessages(
      messageRepository,
      matchRepository
    );

    const getAllUserChats = new GetAllUserChats(
      matchRepository,
      userRepository,
      getUnprocessedMessages,
      messageRepository,
      docLoveHelper,
      {
        debug: (...args: any[]) => console.log('[DEBUG]', ...args),
        info: (...args: any[]) => console.log('[INFO]', ...args),
        warn: (...args: any[]) => console.warn('[WARN]', ...args),
        error: (...args: any[]) => console.error('[ERROR]', ...args),
      }
    );

    // Execute and get formatted text output
    console.log('📥 Retrieving unprocessed messages...\n');
    const result = await getAllUserChats.executeAsText(userId);

    if (!result.success) {
      console.error('❌ Error retrieving chats:');
      console.error(`   Code: ${result.error.code}`);
      console.error(`   Message: ${result.error.message}`);
      if (result.error.details) {
        console.error(`   Details:`, result.error.details);
      }
      process.exit(1);
    }

    const output = result.data;

    if (!output || output.trim().length === 0) {
      console.log('ℹ️  No unprocessed messages found for this user.');
      console.log('   All messages have already been processed, or the user has no chats.');
      return;
    }

    // Display the formatted output
    console.log('📋 CHAT EXPORT');
    console.log('═'.repeat(60));
    console.log('');
    console.log(output);
    console.log('');
    console.log('═'.repeat(60));
    console.log('✅ Export completed successfully');

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

