/**
 * Script to generate or update user AI profile from unprocessed chats (Version 2)
 * 
 * This script analyzes all unprocessed messages from all chats (with regular users
 * and Doc Love) for a hardcoded user ID and generates/updates their AI profile summary.
 * 
 * Usage:
 *   npx tsx scripts/generate-user-profile2.ts
 * 
 * Note: User ID is hardcoded in this script.
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { DocLoveHelper } from '../src/app/services/doc-love-helper';
import { SupabaseMatchRepository } from '../src/data/repositories/SupabaseMatchRepository';
import { SupabaseUserRepository } from '../src/data/repositories/SupabaseUserRepository';
import { SupabaseMessageRepository } from '../src/data/repositories/SupabaseMessageRepository';
import { SupabaseUserAIProfileRepository } from '../src/data/repositories/SupabaseUserAIProfileRepository';
import { GetAllUserChats } from '../src/domain/use-cases/chat/GetAllUserChats';
import { GetUnprocessedMessages } from '../src/domain/use-cases/chat/GetUnprocessedMessages';
import { GenerateUserProfileFromChats } from '../src/domain/use-cases/chat/GenerateUserProfileFromChats';
import { createSummarizerModel } from '../src/app/ai/core/config';

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

async function executeResetSummaryQuery(config: SupabaseConfig, writeToLog: (msg: string) => void): Promise<void> {
  try {
    writeToLog('\n🔄 [v2] Executing SQL: UPDATE public.user_ai_profiles SET summary = NULL');
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error } = await client
      .from('user_ai_profiles')
      .update({ summary: null });

    if (error) {
      writeToLog(`❌ [v2] Error executing UPDATE query: ${error.message}`);
      throw error;
    }

    writeToLog('✅ [v2] Successfully executed UPDATE query');
  } catch (error) {
    writeToLog(`❌ [v2] Failed to execute UPDATE query: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function main() {
  // Hardcoded user ID
  const userId = '8e1139a4-e3ec-4e4c-964b-a98ad5417f71';

  // Create log file with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFileName = `generate-user-profile2-${timestamp}.txt`;
  const logFilePath = path.join(__dirname, logFileName);
  const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

  // Helper function to write to log file
  const writeToLog = (message: string) => {
    logStream.write(message + '\n');
  };

  // Override console methods to write to file
  console.log = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    writeToLog(message);
  };

  console.error = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    writeToLog(`[ERROR] ${message}`);
  };

  console.warn = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    writeToLog(`[WARN] ${message}`);
  };

  // Write initial log entry
  writeToLog(`🚀 [v2] Starting profile generation for user: ${userId}`);
  writeToLog('─'.repeat(60));
  writeToLog('');

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

    // Initialize logger (will write to file via console overrides)
    const logger = {
      debug: (...args: any[]) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        writeToLog(`[DEBUG] ${message}`);
      },
      info: (...args: any[]) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        writeToLog(`[INFO] ${message}`);
      },
      warn: (...args: any[]) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        writeToLog(`[WARN] ${message}`);
      },
      error: (...args: any[]) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        writeToLog(`[ERROR] ${message}`);
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
      docLoveHelper,
      logger
    );

    // Initialize SummarizerModel
    console.log('🤖 [v2] Initializing AI models...');
    
    // Debug: Show environment variables
    if (process.env.AI_MODEL_PROFILE_CHATS_TO_RESUME) {
      console.log(`   📝 AI_MODEL_PROFILE_CHATS_TO_RESUME: ${process.env.AI_MODEL_PROFILE_CHATS_TO_RESUME}`);
    } else {
      console.log(`   ⚠️  AI_MODEL_PROFILE_CHATS_TO_RESUME not set, using fallback`);
    }
    if (process.env.AI_MODEL_PROFILE_MERGE_RESUMES) {
      console.log(`   📝 AI_MODEL_PROFILE_MERGE_RESUMES: ${process.env.AI_MODEL_PROFILE_MERGE_RESUMES}`);
    } else {
      console.log(`   ⚠️  AI_MODEL_PROFILE_MERGE_RESUMES not set, using fallback`);
    }
    if (process.env.AI_MODEL_DOC_LOVE) {
      console.log(`   📝 AI_MODEL_DOC_LOVE: ${process.env.AI_MODEL_DOC_LOVE}`);
    } else {
      console.log(`   ⚠️  AI_MODEL_DOC_LOVE not set, using default`);
    }
    
    const summarizerModel = createSummarizerModel(logger);
    console.log(`✅ [v2] Using model for chats to resume: ${summarizerModel.name} (${summarizerModel.model})\n`);

    // Initialize GenerateUserProfileFromChats use case
    const generateUserProfile = new GenerateUserProfileFromChats(
      getAllUserChats,
      userAIProfileRepository,
      userRepository,
      summarizerModel,
      docLoveHelper,
      logger
    );

    // Execute profile generation
    console.log('📥 [v2] Retrieving unprocessed chats...');
    console.log('🧠 [v2] Analyzing conversations and generating profile...\n');
    
    const result = await generateUserProfile.execute(userId);

    if (!result.success) {
      console.error('❌ [v2] Error generating profile:');
      console.error(`   Code: ${result.error.code}`);
      console.error(`   Message: ${result.error.message}`);
      if (result.error.details) {
        console.error(`   Details:`, result.error.details);
      }
      
      // Calculate and display elapsed time even on error
      const endTime = Date.now();
      const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
      console.error(`\n⏱️  [v2] El proceso ha tardado ${elapsedSeconds} segundos antes de fallar`);
      
      // Execute SQL UPDATE query
      try {
        await executeResetSummaryQuery(config, writeToLog);
      } catch (updateError) {
        writeToLog(`⚠️  [v2] Warning: Could not execute UPDATE query, but continuing...`);
      }
      
      writeToLog(`\n📝 Log file saved to: ${logFilePath}`);
      logStream.end(() => {
        process.exit(1);
      });
      return;
    }

    const summary = result.data;

    if (summary === 'No unprocessed chats to analyze') {
      console.log('ℹ️  [v2] No unprocessed chats found for this user.');
      console.log('   All messages have already been processed, or the user has no chats.');
      
      // Calculate and display elapsed time
      const endTime = Date.now();
      const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
      console.log(`\n⏱️  [v2] El proceso ha tardado ${elapsedSeconds} segundos`);
      
      // Execute SQL UPDATE query
      try {
        await executeResetSummaryQuery(config, writeToLog);
      } catch (updateError) {
        writeToLog(`⚠️  [v2] Warning: Could not execute UPDATE query, but continuing...`);
      }
      
      writeToLog(`\n📝 Log file saved to: ${logFilePath}`);
      logStream.end();
      return;
    }

    // Display the generated profile
    console.log('📋 [v2] GENERATED USER PROFILE');
    console.log('═'.repeat(60));
    console.log('');
    console.log(summary);
    console.log('');
    console.log('═'.repeat(60));
    console.log('✅ [v2] Profile generated and saved successfully');
    console.log(`   Incremental summary saved in: user_ai_profiles.summary_incremental`);
    console.log(`   Consolidated summary updated in: user_ai_profiles.summary`);
    
    // Calculate and display elapsed time
    const endTime = Date.now();
    const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  [v2] El proceso ha tardado ${elapsedSeconds} segundos`);
    
    // Execute SQL UPDATE query
    try {
      await executeResetSummaryQuery(config, writeToLog);
    } catch (updateError) {
      writeToLog(`⚠️  [v2] Warning: Could not execute UPDATE query, but continuing...`);
    }
    
    writeToLog(`\n📝 Log file saved to: ${logFilePath}`);
    logStream.end();

  } catch (error) {
    console.error('\n❌ [v2] Unexpected error:');
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
    console.error(`\n⏱️  [v2] El proceso ha tardado ${elapsedSeconds} segundos antes de fallar`);
    
    // Execute SQL UPDATE query
    try {
      const config = getSupabaseConfig();
      await executeResetSummaryQuery(config, writeToLog);
    } catch (updateError) {
      writeToLog(`⚠️  [v2] Warning: Could not execute UPDATE query, but continuing...`);
    }
    
    writeToLog(`\n📝 Log file saved to: ${logFilePath}`);
    logStream.end(() => {
      process.exit(1);
    });
  }
}

// Run the script
main();

