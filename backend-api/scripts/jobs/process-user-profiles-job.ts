/**
 * Scheduled Job: Process user profiles from unprocessed messages
 * 
 * TODO: Deployment Platform Adaptations
 * Depending on where this job is deployed (AWS Lambda, Google Cloud Functions, Railway, 
 * Vercel Cron, etc.), the following modifications may be needed:
 * - AWS Lambda: Use EventBridge (CloudWatch Events) for scheduling instead of system cron
 * - Google Cloud: Use Cloud Scheduler with Cloud Functions or Cloud Run
 * - Railway: Use Railway Cron Jobs or scheduled tasks
 * - Vercel: Use Vercel Cron Jobs (vercel.json configuration)
 * - Azure: Use Azure Functions with Timer Triggers
 * - Heroku: Use Heroku Scheduler add-on
 * 
 * The core logic remains the same, but the entry point and scheduling mechanism will differ.
 * 
 * This job:
 * 1. Queries database to find users with unprocessed messages (optimized query)
 * 2. For each user found, processes their messages using GenerateUserProfileFromChats
 * 3. The use case handles: reading messages, marking as processed, generating summary_incremental,
 *    merging with summary, and clearing summary_incremental
 * 4. After summary is updated, generates embedding from summary and saves it to summary_embedding
 * 
 * Execution:
 * This script should be executed every 3 hours via system cron or task scheduler.
 * See README or deployment docs for platform-specific setup instructions.
 * 
 * Usage: npx tsx scripts/jobs/process-user-profiles-job.ts
 */

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DocLoveHelper } from '../../src/app/services/doc-love-helper';
import { SupabaseMatchRepository } from '../../src/data/repositories/SupabaseMatchRepository';
import { SupabaseUserRepository } from '../../src/data/repositories/SupabaseUserRepository';
import { SupabaseMessageRepository } from '../../src/data/repositories/SupabaseMessageRepository';
import { SupabaseUserAIProfileRepository } from '../../src/data/repositories/SupabaseUserAIProfileRepository';
import { GetAllUserChats } from '../../src/domain/use-cases/chat/GetAllUserChats';
import { GetUnprocessedMessages } from '../../src/domain/use-cases/chat/GetUnprocessedMessages';
import { GenerateUserProfileFromChats } from '../../src/domain/use-cases/chat/GenerateUserProfileFromChats';
import { createSummarizerModel, createEmbeddingModel } from '../../src/app/ai/core/config';
import { UserAIProfileEmbeddingService } from '../../src/app/ai/profile/UserAIProfileEmbeddingService';

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

/**
 * Gets user IDs that have unprocessed messages and are not bots
 * Optimized query: SELECT DISTINCT sender_id FROM messages
 * WHERE profile_processed_at IS NULL
 * AND sender_id IN (SELECT id FROM users WHERE is_bot = false OR is_bot IS NULL)
 */
async function getUsersWithUnprocessedMessages(
  client: SupabaseClient
): Promise<string[]> {
  try {
    // Query to get distinct sender_ids from messages with unprocessed messages
    // Join with users table to filter out bots
    const { data, error } = await client
      .from('messages')
      .select('sender_id, users!messages_sender_id_fkey(id, is_bot)')
      .is('profile_processed_at', null)
      .or('users.is_bot.is.null,users.is_bot.eq.false');

    if (error) {
      throw new Error(`Failed to fetch users with unprocessed messages: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Extract unique sender_ids
    // Filter to ensure we only include non-bot users (double check)
    const userIds = new Set<string>();
    
    for (const row of data) {
      const senderId = row.sender_id;
      // Handle both single user object and array of users from join
      const user = Array.isArray(row.users) ? row.users[0] : row.users;
      
      // Only include if user exists and is not a bot
      if (senderId && user && (user.is_bot === false || user.is_bot === null)) {
        userIds.add(senderId);
      }
    }

    return Array.from(userIds);
  } catch (error) {
    // Fallback: if the join query fails, use a simpler approach
    console.warn('[WARN] Join query failed, using fallback method:', error);
    
    // Fallback: Get distinct sender_ids from unprocessed messages
    const { data: messagesData, error: messagesError } = await client
      .from('messages')
      .select('sender_id')
      .is('profile_processed_at', null);

    if (messagesError) {
      throw new Error(`Failed to fetch unprocessed messages: ${messagesError.message}`);
    }

    if (!messagesData || messagesData.length === 0) {
      return [];
    }

    // Get unique sender IDs
    const senderIds = [...new Set(messagesData.map((row) => row.sender_id).filter(Boolean))];

    if (senderIds.length === 0) {
      return [];
    }

    // Filter out bots by checking users table
    const { data: usersData, error: usersError } = await client
      .from('users')
      .select('id')
      .in('id', senderIds)
      .or('is_bot.is.null,is_bot.eq.false');

    if (usersError) {
      throw new Error(`Failed to filter bot users: ${usersError.message}`);
    }

    return (usersData ?? []).map((row) => row.id);
  }
}

async function main() {
  const startTime = Date.now();
  console.log(`[START] [${new Date().toISOString()}] Starting user profile processing job\n`);

  try {
    const config = getSupabaseConfig();
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Initialize repositories
    const matchRepository = new SupabaseMatchRepository(config);
    const userRepository = new SupabaseUserRepository();
    const messageRepository = new SupabaseMessageRepository(config);
    const userAIProfileRepository = new SupabaseUserAIProfileRepository();
    const docLoveHelper = new DocLoveHelper(config);

    // Initialize logger
    const logger = {
      debug: (...args: any[]) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        console.log(`[DEBUG] ${message}`);
      },
      info: (...args: any[]) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        console.log(`[INFO] ${message}`);
      },
      warn: (...args: any[]) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        console.warn(`[WARN] ${message}`);
      },
      error: (...args: any[]) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        console.error(`[ERROR] ${message}`);
      },
    };

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
      logger
    );

    const summarizerModel = createSummarizerModel(logger);
    const generateUserProfile = new GenerateUserProfileFromChats(
      getAllUserChats,
      userAIProfileRepository,
      userRepository,
      summarizerModel,
      docLoveHelper,
      logger
    );

    // Initialize embedding service for generating embeddings from summaries
    const embeddingModel = createEmbeddingModel(logger);
    const embeddingService = new UserAIProfileEmbeddingService(
      embeddingModel,
      userAIProfileRepository,
      logger
    );

    // Get users with unprocessed messages (optimized query)
    console.log('[INFO] Querying users with unprocessed messages...');
    const userIds = await getUsersWithUnprocessedMessages(client);
    console.log(`[INFO] Found ${userIds.length} users with unprocessed messages\n`);

    if (userIds.length === 0) {
      console.log('[INFO] No users with unprocessed messages found. Job completed.');
      return;
    }

    // Process each user
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const results: Array<{ userId: string; status: 'success' | 'skipped' | 'error'; message?: string }> = [];

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      const userNumber = i + 1;
      
      console.log(`\n[${userNumber}/${userIds.length}] Processing user: ${userId}`);

      try {
        // Get profile before processing to compare summary changes
        const profileBeforeResult = await userAIProfileRepository.findByUserId(userId);
        const summaryBefore = profileBeforeResult.success && profileBeforeResult.data 
          ? profileBeforeResult.data.summary 
          : null;
        
        // Process user profile
        // Note: GenerateUserProfileFromChats will handle checking for unprocessed messages
        // and will return early if none are found, so we don't need to check again here
        console.log(`[PROCESS] Generating profile for user ${userId}...`);
        const result = await generateUserProfile.execute(userId);

        if (!result.success) {
          console.error(`[ERROR] Failed to process user ${userId}:`);
          console.error(`   Code: ${result.error.code}`);
          console.error(`   Message: ${result.error.message}`);
          errorCount++;
          results.push({
            userId,
            status: 'error',
            message: result.error.message,
          });
          continue;
        }

        if (result.data === 'No unprocessed chats to analyze') {
          console.log(`[SKIP] User ${userId}: No unprocessed chats (may have been processed by another instance)`);
          skippedCount++;
          results.push({ userId, status: 'skipped' });
          continue;
        }

        console.log(`[SUCCESS] User ${userId} profile processed successfully`);
        
        // Generate embedding from the updated summary only if summary actually changed
        try {
          // Get profile after processing to compare
          const profileAfterResult = await userAIProfileRepository.findByUserId(userId);
          const summaryAfter = profileAfterResult.success && profileAfterResult.data 
            ? profileAfterResult.data.summary 
            : null;
          
          // Only generate embedding if summary exists and changed
          // Compare content, not just reference (handle null cases)
          const summaryBeforeContent = summaryBefore?.trim() || null;
          const summaryAfterContent = summaryAfter?.trim() || null;
          const summaryChanged = summaryBeforeContent !== summaryAfterContent;
          const hasConsolidatedSummary = summaryAfterContent !== null;
          
          if (!hasConsolidatedSummary) {
            console.log(`[SKIP-EMBEDDING] User ${userId}: No consolidated summary yet (only incremental), skipping embedding generation`);
          } else if (!summaryChanged && summaryBeforeContent !== null) {
            console.log(`[SKIP-EMBEDDING] User ${userId}: Summary unchanged, skipping embedding generation`);
          } else {
            // Summary changed (new summary or content changed)
            console.log(`[EMBEDDING] Summary ${summaryBeforeContent === null ? 'created' : 'changed'} for user ${userId}, generating embedding...`);
            await embeddingService.generateEmbeddingFromSummary(userId);
            console.log(`[EMBEDDING] Embedding generated successfully for user ${userId}`);
          }
        } catch (embeddingError) {
          // Log error but don't fail the whole process - summary is already saved
          console.warn(`[WARN] Failed to generate embedding for user ${userId}:`, 
            embeddingError instanceof Error ? embeddingError.message : String(embeddingError));
        }
        
        processedCount++;
        results.push({ userId, status: 'success' });

      } catch (error) {
        console.error(`[ERROR] Unexpected error processing user ${userId}:`, error);
        errorCount++;
        results.push({
          userId,
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Summary
    const endTime = Date.now();
    const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
    const elapsedMinutes = ((endTime - startTime) / 60000).toFixed(2);

    console.log('\n' + '═'.repeat(80));
    console.log('[SUMMARY] Job execution completed');
    console.log('═'.repeat(80));
    console.log(`[INFO] Users with unprocessed messages: ${userIds.length}`);
    console.log(`[OK] Successfully processed: ${processedCount}`);
    console.log(`[SKIP] Skipped (no unprocessed messages at execution time): ${skippedCount}`);
    console.log(`[ERROR] Failed: ${errorCount}`);
    console.log(`[TIME] Total execution time: ${elapsedSeconds} seconds (${elapsedMinutes} minutes)`);
    console.log('═'.repeat(80));

    // Exit with error code if there were failures
    if (errorCount > 0) {
      console.log(`\n[WARN] Job completed with ${errorCount} errors. Check logs above for details.`);
      process.exit(1);
    } else {
      console.log('\n[OK] Job completed successfully!');
    }

  } catch (error) {
    const endTime = Date.now();
    const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
    
    console.error('\n[ERROR] Fatal error in job execution:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    } else {
      console.error(`   Unknown error: ${JSON.stringify(error)}`);
    }
    console.error(`\n[TIME] Job failed after ${elapsedSeconds} seconds`);
    process.exit(1);
  }
}

// Run the job
main();

