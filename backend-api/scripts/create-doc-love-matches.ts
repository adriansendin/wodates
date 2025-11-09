/**
 * Migration script: Create Doc Love matches for existing users
 * 
 * This script creates welcome matches between all existing users and Doc Love.
 * It should be run once after deploying the Doc Love integration.
 * 
 * Usage:
 *   npm run ts-node scripts/create-doc-love-matches.ts
 * 
 * Or with tsx:
 *   npx tsx scripts/create-doc-love-matches.ts
 */

import 'dotenv/config';
import { DocLoveHelper } from '../src/app/services/doc-love-helper';
import { SystemUserService } from '../src/app/services/system-user-service';
import { SupabaseLikeRepository } from '../src/data/repositories/SupabaseLikeRepository';
import { SupabaseMatchRepository } from '../src/data/repositories/SupabaseMatchRepository';
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

async function getAllUserIds(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client.from('users').select('id');

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  return (data ?? []).map((row) => row.id);
}

async function getUsersWithoutDocLoveMatch(
  client: SupabaseClient,
  docLoveId: string,
): Promise<string[]> {
  // Get all user IDs
  const allUserIds = await getAllUserIds(client);

  // Get all users who already have a match with Doc Love
  const { data: existingMatches, error: matchError } = await client
    .from('chat_participants')
    .select('user_id')
    .eq('user_id', docLoveId);

  if (matchError) {
    throw new Error(`Failed to fetch existing matches: ${matchError.message}`);
  }

  const docLoveChatIds = new Set(
    (existingMatches ?? []).map((row: { user_id: string }) => row.user_id),
  );

  // Get all chat IDs where Doc Love is a participant
  const { data: docLoveChats, error: chatError } = await client
    .from('chat_participants')
    .select('chat_id')
    .eq('user_id', docLoveId);

  if (chatError) {
    throw new Error(`Failed to fetch Doc Love chats: ${chatError.message}`);
  }

  const docLoveChatIdsSet = new Set(
    (docLoveChats ?? []).map((row: { chat_id: string }) => row.chat_id),
  );

  // Get all users who are in chats with Doc Love
  const { data: usersWithMatch, error: usersError } = await client
    .from('chat_participants')
    .select('user_id')
    .in('chat_id', Array.from(docLoveChatIdsSet))
    .neq('user_id', docLoveId);

  if (usersError) {
    throw new Error(`Failed to fetch users with matches: ${usersError.message}`);
  }

  const usersWithDocLoveMatch = new Set(
    (usersWithMatch ?? []).map((row: { user_id: string }) => row.user_id),
  );

  // Return users who don't have a match with Doc Love
  return allUserIds.filter((userId) => !usersWithDocLoveMatch.has(userId));
}

async function main() {
  console.log('🚀 Starting Doc Love matches migration...\n');

  try {
    const config = getSupabaseConfig();
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Initialize services
    const docLoveHelper = new DocLoveHelper(config);
    const likeRepository = new SupabaseLikeRepository(config);
    const matchRepository = new SupabaseMatchRepository(config);
    const systemUserService = new SystemUserService(
      docLoveHelper,
      likeRepository,
      matchRepository,
    );

    // Get Doc Love's user ID
    console.log('📧 Getting Doc Love user ID...');
    const docLoveId = await docLoveHelper.getDocLoveUserId();
    console.log(`✅ Doc Love ID: ${docLoveId}\n`);

    // Get users without Doc Love match
    console.log('👥 Finding users without Doc Love match...');
    const usersToProcess = await getUsersWithoutDocLoveMatch(client, docLoveId);
    console.log(`✅ Found ${usersToProcess.length} users to process\n`);

    if (usersToProcess.length === 0) {
      console.log('✨ All users already have matches with Doc Love!');
      return;
    }

    // Process users in batches
    const batchSize = 10;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < usersToProcess.length; i += batchSize) {
      const batch = usersToProcess.slice(i, i + batchSize);
      console.log(
        `\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(usersToProcess.length / batchSize)} (${batch.length} users)...`,
      );

      for (const userId of batch) {
        try {
          const result = await systemUserService.createWelcomeMatch(userId);

          if (result.success) {
            successCount++;
            console.log(`  ✅ User ${userId}: Match created`);
          } else {
            errorCount++;
            console.error(
              `  ❌ User ${userId}: ${result.error.message}`,
            );
          }
        } catch (error) {
          errorCount++;
          console.error(`  ❌ User ${userId}: Unexpected error`, error);
        }
      }

      // Small delay between batches to avoid overwhelming the database
      if (i + batchSize < usersToProcess.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`  ✅ Success: ${successCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log(`  📝 Total: ${usersToProcess.length}`);

    if (errorCount > 0) {
      console.log(
        '\n⚠️  Some users failed to get matches. You may need to run this script again.',
      );
      process.exit(1);
    } else {
      console.log('\n✨ Migration completed successfully!');
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
main();

