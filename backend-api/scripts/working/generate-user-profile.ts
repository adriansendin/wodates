/**
 * Script to generate or update user AI profile from unprocessed chats
 * 
 * This script analyzes all unprocessed messages from all chats (with regular users
 * and Doc Love) for a given user ID and generates/updates their AI profile summary.
 * 
 * Usage:
 *   npx tsx scripts/working/generate-user-profile.ts <userId>
 * 
 * Example:
 *   npx tsx scripts/working/generate-user-profile.ts 8e1139a4-e3ec-4e4c-964b-a98ad5417f71
 */

/// <reference types="node" />
import 'dotenv/config';
import { DocLoveHelper } from '../../src/app/services/doc-love-helper';
import { SupabaseMatchRepository } from '../../src/data/repositories/SupabaseMatchRepository';
import { SupabaseUserRepository } from '../../src/data/repositories/SupabaseUserRepository';
import { SupabaseMessageRepository } from '../../src/data/repositories/SupabaseMessageRepository';
import { SupabaseUserAIProfileRepository } from '../../src/data/repositories/SupabaseUserAIProfileRepository';
import { GetAllUserChats } from '../../src/domain/use-cases/chat/GetAllUserChats';
import { GetUnprocessedMessages } from '../../src/domain/use-cases/chat/GetUnprocessedMessages';
import { GenerateUserProfileFromChats } from '../../src/domain/use-cases/chat/GenerateUserProfileFromChats';

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
    console.error('  npx tsx scripts/working/generate-user-profile.ts <userId>');
    console.error('\nExample:');
    console.error('  npx tsx scripts/working/generate-user-profile.ts 8e1139a4-e3ec-4e4c-964b-a98ad5417f71');
    process.exit(1);
  }

  // Validate UUID format
  if (!validateUserId(userId)) {
    console.error(`❌ Error: Invalid UUID format: ${userId}`);
    console.error('Please provide a valid UUID (e.g., 8e1139a4-e3ec-4e4c-964b-a98ad5417f71)');
    process.exit(1);
  }

  console.log('🚀 Starting profile generation for user:', userId);
  console.log('─'.repeat(60));
  console.log('');

  // Start timing
  const startTime = Date.now();

  try {
    // Get configuration
    const config = getSupabaseConfig();

    // Initialize repositories
    const matchRepository = new SupabaseMatchRepository(config);
    const userRepository = new SupabaseUserRepository();
    const messageRepository = new SupabaseMessageRepository(config);
    const userAIProfileRepository = new SupabaseUserAIProfileRepository();
    const docLoveHelper = new DocLoveHelper(config);

    // Initialize logger
    const logger = {
      debug: (...args: any[]) => console.log('[DEBUG]', ...args),
      info: (...args: any[]) => console.log('[INFO]', ...args),
      warn: (...args: any[]) => console.warn('[WARN]', ...args),
      error: (...args: any[]) => console.error('[ERROR]', ...args),
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

    // Note: AI models are now handled internally via ai-service
    // No need to initialize models manually - GenerateUserProfileFromChats uses AiServiceProfileClient
    console.log('🤖 Using ai-service for profile generation...');
    console.log('   All AI operations are handled by ai-service HTTP API\n');

    // Initialize GenerateUserProfileFromChats use case
    // Constructor accepts: getAllUserChats, userAIProfileRepository, userRepository, logger
    const generateUserProfile = new GenerateUserProfileFromChats(
      getAllUserChats,
      userAIProfileRepository,
      userRepository,
      logger
    );

    // Execute profile generation
    console.log('📥 Retrieving unprocessed chats...');
    console.log('🧠 Analyzing conversations and generating profile...\n');
    
    const result = await generateUserProfile.execute(userId);

    if (!result.success) {
      console.error('❌ Error generating profile:');
      console.error(`   Code: ${result.error.code}`);
      console.error(`   Message: ${result.error.message}`);
      if (result.error.details) {
        console.error(`   Details:`, result.error.details);
      }
      
      // Calculate and display elapsed time even on error
      const endTime = Date.now();
      const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
      console.error(`\n⏱️  El proceso ha tardado ${elapsedSeconds} segundos antes de fallar`);
      process.exit(1);
    }

    // TypeScript type guard: after checking success, we know result is Success<string>
    const summary = result.success ? result.data : '';

    if (summary === 'No unprocessed chats to analyze') {
      console.log('ℹ️  No unprocessed chats found for this user.');
      console.log('   All messages have already been processed, or the user has no chats.');
      
      // Calculate and display elapsed time
      const endTime = Date.now();
      const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
      console.log(`\n⏱️  El proceso ha tardado ${elapsedSeconds} segundos`);
      return;
    }

    // Display the generated profile
    console.log('📋 GENERATED USER PROFILE');
    console.log('═'.repeat(60));
    console.log('');
    console.log(summary);
    console.log('');
    console.log('═'.repeat(60));
    console.log('✅ Profile generated and saved successfully');
    console.log(`   Incremental summary saved in: user_ai_profiles.summary_incremental`);
    console.log(`   Consolidated summary updated in: user_ai_profiles.summary`);
    
    // Calculate and display elapsed time
    const endTime = Date.now();
    const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  El proceso ha tardado ${elapsedSeconds} segundos`);

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
    
    // Calculate and display elapsed time even on unexpected error
    const endTime = Date.now();
    const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`\n⏱️  El proceso ha tardado ${elapsedSeconds} segundos antes de fallar`);
    process.exit(1);
  }
}

// Run the script
main();

