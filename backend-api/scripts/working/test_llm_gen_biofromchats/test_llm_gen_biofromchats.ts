/**
 * Script to generate or update user AI profile from unprocessed chats (Test Quality LLMs - Version 2)
 * 
 * This script:
 * 1. Displays all unprocessed chats for the user (once at the beginning)
 * 2. For each LLM model in the predefined list:
 *    - Executes the profile generation process 5 times
 *    - BEFORE each execution, resets messages as unprocessed (SET profile_processed_at = NULL WHERE sender_id = ...)
 *      This ensures all executions process the same data for valid comparison
 *    - After the 5th execution, resets the summary field (SET summary = NULL WHERE user_id = ...)
 *    - This allows testing the merge functionality between summary and summary_incremental
 *    - Executions 2-5 will perform merge operations (since summary will have content)
 * 
 * IMPORTANT: Messages are reset before each execution to ensure all 5 executions process the same data.
 * This is critical for valid performance comparison between executions.
 * 
 * All logs are saved to a single text file in the same directory for easy comparison and evaluation.
 * 
 * Usage:
 *   npx tsx scripts/working/test_llm_gen_biofromchats/test_llm_gen_biofromchats.ts
 * 
 * Note: User ID and model list are hardcoded in this script.
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { DocLoveHelper } from '../../../src/app/services/doc-love-helper';
import { SupabaseMatchRepository } from '../../../src/data/repositories/SupabaseMatchRepository';
import { SupabaseUserRepository } from '../../../src/data/repositories/SupabaseUserRepository';
import { SupabaseMessageRepository } from '../../../src/data/repositories/SupabaseMessageRepository';
import { SupabaseUserAIProfileRepository } from '../../../src/data/repositories/SupabaseUserAIProfileRepository';
import { GetAllUserChats } from '../../../src/domain/use-cases/chat/GetAllUserChats';
import { GetUnprocessedMessages } from '../../../src/domain/use-cases/chat/GetUnprocessedMessages';
import { GenerateUserProfileFromChats } from '../../../src/domain/use-cases/chat/GenerateUserProfileFromChats';
import { createSummarizerModel } from '../../../src/app/ai/core/config';

// List of LLM models to test
const MODELS = [
  'gemma3:1b',
  'gemma3:4b',
  'ministral-3:3b',
];


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

async function executeResetSummaryQuery(config: SupabaseConfig, userId: string, writeToLog: (msg: string) => void): Promise<void> {
  try {
    writeToLog(`\n[RESET] [v2] Executing SQL: UPDATE public.user_ai_profiles SET summary = NULL WHERE user_id = '${userId}'`);
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error } = await client
      .from('user_ai_profiles')
      .update({ summary: null })
      .eq('user_id', userId);

    if (error) {
      writeToLog(`[ERROR] [v2] Error executing UPDATE query: ${error.message}`);
      throw error;
    }

    writeToLog('[OK] [v2] Successfully executed UPDATE query');
  } catch (error) {
    writeToLog(`[ERROR] [v2] Failed to execute UPDATE query: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function executeResetMessagesQuery(config: SupabaseConfig, userId: string, writeToLog: (msg: string) => void): Promise<void> {
  try {
    writeToLog(`\n[RESET] [v2] Resetting messages as unprocessed: UPDATE public.messages SET profile_processed_at = NULL WHERE sender_id = '${userId}'`);
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
      writeToLog(`[ERROR] [v2] Error counting messages: ${countError.message}`);
      throw countError;
    }

    const messagesToReset = count || 0;

    if (messagesToReset === 0) {
      writeToLog('[INFO] [v2] No processed messages found to reset (all messages are already unprocessed)');
      return;
    }

    writeToLog(`[INFO] [v2] Found ${messagesToReset} processed message(s) to reset`);

    // Reset profile_processed_at to NULL for all messages sent by this user
    const { data, error } = await client
      .from('messages')
      .update({ profile_processed_at: null })
      .eq('sender_id', userId)
      .not('profile_processed_at', 'is', null)
      .select('id');

    if (error) {
      writeToLog(`[ERROR] [v2] Error resetting messages: ${error.message}`);
      throw error;
    }

    const resetCount = data?.length || 0;
    writeToLog(`[OK] [v2] Successfully reset ${resetCount} message(s) as unprocessed`);
  } catch (error) {
    writeToLog(`[ERROR] [v2] Failed to reset messages: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function displayUserChats(
  userId: string,
  config: SupabaseConfig,
  writeToLog: (msg: string) => void
): Promise<void> {
  try {
    writeToLog('\n[INFO] [v2] RETRIEVING USER CHATS');
    writeToLog('═'.repeat(80));
    writeToLog('');
    
    // Initialize repositories
    const matchRepository = new SupabaseMatchRepository(config);
    const userRepository = new SupabaseUserRepository();
    const messageRepository = new SupabaseMessageRepository(config);
    const docLoveHelper = new DocLoveHelper(config);

    // Initialize logger
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
      messageRepository,
      docLoveHelper,
      logger
    );

    // Get chats as formatted text
    writeToLog('[RETRIEVE] Retrieving unprocessed messages...\n');
    const result = await getAllUserChats.executeAsText(userId);

    if (!result.success) {
      writeToLog('[ERROR] [v2] Error retrieving chats:');
      writeToLog(`   Code: ${result.error.code}`);
      writeToLog(`   Message: ${result.error.message}`);
      if (result.error.details) {
        writeToLog(`   Details: ${JSON.stringify(result.error.details)}`);
      }
      throw new Error(`Failed to retrieve chats: ${result.error.message}`);
    }

    const output = result.data;

    if (!output || output.trim().length === 0) {
      writeToLog('[INFO] [v2] No unprocessed messages found for this user.');
      writeToLog('   All messages have already been processed, or the user has no chats.');
    } else {
      writeToLog('[INFO] CHAT EXPORT');
      writeToLog('═'.repeat(80));
      writeToLog('');
      writeToLog(output);
      writeToLog('');
      writeToLog('═'.repeat(80));
    }
    
    writeToLog('\n');
  } catch (error) {
    writeToLog(`[ERROR] [v2] Failed to retrieve chats: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function executeProfileGenerationForModel(
  modelName: string,
  userId: string,
  config: SupabaseConfig,
  writeToLog: (msg: string) => void,
  logFilePath: string
): Promise<void> {
  const iterationStartTime = Date.now();
  
  writeToLog(`\n${'═'.repeat(80)}`);
  writeToLog(`[AI] [v2] Starting execution with model: ${modelName}`);
  writeToLog(`${'═'.repeat(80)}\n`);

  try {
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
      messageRepository,
      docLoveHelper,
      logger
    );

    // Initialize SummarizerModel with the specific model
    writeToLog(`[AI] [v2] Initializing AI model: ${modelName}`);
    
    const summarizerModel = createSummarizerModel(logger, modelName);
    writeToLog(`[OK] [v2] Using model: ${summarizerModel.name} (${summarizerModel.model})\n`);

    // Initialize GenerateUserProfileFromChats use case
    // Pass the same model for both summarization and merge
    const generateUserProfile = new GenerateUserProfileFromChats(
      getAllUserChats,
      userAIProfileRepository,
      userRepository,
      summarizerModel,
      docLoveHelper,
      logger,
      modelName // Use the same model for merge operations
    );

    // Execute profile generation
    writeToLog('[RETRIEVE] [v2] Retrieving unprocessed chats...');
    writeToLog('[ANALYZE] [v2] Analyzing conversations and generating profile...\n');
    
    const result = await generateUserProfile.execute(userId);

    if (!result.success) {
      writeToLog('[ERROR] [v2] Error generating profile:');
      writeToLog(`   Code: ${result.error.code}`);
      writeToLog(`   Message: ${result.error.message}`);
      if (result.error.details) {
        writeToLog(`   Details: ${JSON.stringify(result.error.details)}`);
      }
      
      const iterationEndTime = Date.now();
      const iterationElapsedSeconds = ((iterationEndTime - iterationStartTime) / 1000).toFixed(2);
      writeToLog(`\n[TIME] [v2] Iteration with model ${modelName} took ${iterationElapsedSeconds} seconds before failing`);
      throw new Error(`Failed to generate profile with model ${modelName}: ${result.error.message}`);
    }

    const summary = result.data;

    if (summary === 'No unprocessed chats to analyze') {
      writeToLog('[INFO] [v2] No unprocessed chats found for this user.');
      writeToLog('   All messages have already been processed, or the user has no chats.');
      
      const iterationEndTime = Date.now();
      const iterationElapsedSeconds = ((iterationEndTime - iterationStartTime) / 1000).toFixed(2);
      writeToLog(`\n[TIME] [v2] Iteration with model ${modelName} took ${iterationElapsedSeconds} seconds`);
      return;
    }

    // Display the generated profile
    writeToLog('[INFO] [v2] GENERATED USER PROFILE');
    writeToLog('═'.repeat(60));
    writeToLog('');
    writeToLog(summary);
    writeToLog('');
    writeToLog('═'.repeat(60));
    writeToLog('[OK] [v2] Profile generated and saved successfully');
    writeToLog(`   Model used: ${modelName}`);
    writeToLog(`   Incremental summary saved in: user_ai_profiles.summary_incremental`);
    writeToLog(`   Consolidated summary updated in: user_ai_profiles.summary`);
    
    const iterationEndTime = Date.now();
    const iterationElapsedSeconds = ((iterationEndTime - iterationStartTime) / 1000).toFixed(2);
    writeToLog(`\n[TIME] [v2] Iteration with model ${modelName} took ${iterationElapsedSeconds} seconds`);

  } catch (error) {
    const iterationEndTime = Date.now();
    const iterationElapsedSeconds = ((iterationEndTime - iterationStartTime) / 1000).toFixed(2);
    writeToLog(`\n[ERROR] [v2] Unexpected error with model ${modelName}:`);
    if (error instanceof Error) {
      writeToLog(`   ${error.message}`);
      if (error.stack) {
        writeToLog('\nStack trace:');
        writeToLog(error.stack);
      }
    } else {
      writeToLog(`   Unknown error: ${JSON.stringify(error)}`);
    }
    writeToLog(`\n[TIME] [v2] Iteration with model ${modelName} took ${iterationElapsedSeconds} seconds before failing`);
    throw error;
  }
}

async function main() {
  // Get __dirname equivalent for ES modules
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Hardcoded user ID
  const userId = '8e1139a4-e3ec-4e4c-964b-a98ad5417f71';

  // Create log file with fixed name (in the same directory as the script)
  const logFileName = 'test_llm_gen_biofromchats.txt';
  const logFilePath = path.join(__dirname, logFileName);
  const logStream = fs.createWriteStream(logFilePath, { 
    flags: 'a',
    encoding: 'utf8'
  });
  logStream.setDefaultEncoding('utf8');

  // Helper function to write to log file
  const writeToLog = (message: string) => {
    logStream.write(message + '\n', 'utf8');
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
  writeToLog(`[START] [v2] Starting batch profile generation for user: ${userId}`);
  writeToLog(`[INFO] [v2] Will test ${MODELS.length} models: ${MODELS.join(', ')}`);
  writeToLog(`[EXEC] [v2] Each model will be executed 5 times`);
  writeToLog(`[INFO] [v2] Messages will be reset as unprocessed BEFORE each execution (ensures all executions process same data)`);
  writeToLog(`[INFO] [v2] Summary will be reset only after the 5th execution of each model (to test merge functionality)`);
  writeToLog('─'.repeat(80));
  writeToLog('');

  // Start timing
  const startTime = Date.now();

  try {
    // Get configuration
    const config = getSupabaseConfig();

    // Display chats once at the beginning
    try {
      await displayUserChats(userId, config, writeToLog);
    } catch (error) {
      writeToLog(`[WARN] [v2] Warning: Could not display chats, but continuing with profile generation...`);
    }

    let totalSuccessCount = 0;
    let totalErrorCount = 0;
    const executionsPerModel = 5;

    // Execute profile generation for each model (5 times each)
    for (let i = 0; i < MODELS.length; i++) {
      const modelName = MODELS[i];
      const modelNumber = i + 1;
      
      writeToLog(`\n${'█'.repeat(80)}`);
      writeToLog(`[STATS] [v2] Model ${modelNumber}/${MODELS.length}: ${modelName}`);
      writeToLog(`[EXEC] [v2] Will execute ${executionsPerModel} times`);
      writeToLog(`[INFO] [v2] Messages will be reset BEFORE each execution (ensures valid comparison)`);
      writeToLog(`[INFO] [v2] Summary will be reset only after execution ${executionsPerModel}`);
      writeToLog(`${'█'.repeat(80)}`);

      let modelSuccessCount = 0;
      let modelErrorCount = 0;

      // Execute 5 times for this model
      for (let execution = 1; execution <= executionsPerModel; execution++) {
        writeToLog(`\n${'─'.repeat(80)}`);
        writeToLog(`[EXEC] [v2] Execution ${execution}/${executionsPerModel} for model ${modelName}`);
        writeToLog(`${'─'.repeat(80)}`);

        // CRITICAL: Reset messages as unprocessed BEFORE each execution
        // This ensures all executions process the same data for valid comparison
        writeToLog(`\n[RESET] [v2] Resetting messages as unprocessed before execution ${execution}/${executionsPerModel}...`);
        try {
          await executeResetMessagesQuery(config, userId, writeToLog);
        } catch (resetError) {
          writeToLog(`[WARN] [v2] Warning: Could not reset messages before execution ${execution}, but continuing...`);
          // Continue anyway - if messages are already unprocessed, that's fine
        }

        try {
          await executeProfileGenerationForModel(modelName, userId, config, writeToLog, logFilePath);
          modelSuccessCount++;
          totalSuccessCount++;
          
          // Execute SQL UPDATE query ONLY after the last execution (5th) of each model
          if (execution === executionsPerModel) {
            writeToLog(`\n[RESET] [v2] Resetting summary after final execution (${execution}/${executionsPerModel})...`);
            try {
              await executeResetSummaryQuery(config, userId, writeToLog);
            } catch (updateError) {
              writeToLog(`[WARN] [v2] Warning: Could not execute UPDATE query after execution ${execution}, but continuing...`);
            }
          } else {
            writeToLog(`\n[INFO] [v2] Execution ${execution}/${executionsPerModel} completed. Summary preserved for next execution (will trigger merge).`);
          }
        } catch (error) {
          modelErrorCount++;
          totalErrorCount++;
          writeToLog(`\n[ERROR] [v2] Failed execution ${execution}/${executionsPerModel} for model ${modelName}, continuing...`);
          
          // Still try to execute SQL UPDATE query even on error, but only if it's the last execution
          if (execution === executionsPerModel) {
            try {
              await executeResetSummaryQuery(config, userId, writeToLog);
            } catch (updateError) {
              writeToLog(`[WARN] [v2] Warning: Could not execute UPDATE query after error, but continuing...`);
            }
          }
        }
      }

      // Summary for this model
      writeToLog(`\n${'─'.repeat(80)}`);
      writeToLog(`[STATS] [v2] Model ${modelName} summary: ${modelSuccessCount}/${executionsPerModel} successful, ${modelErrorCount}/${executionsPerModel} failed`);
      writeToLog(`${'─'.repeat(80)}`);
    }

    // Final summary
    const endTime = Date.now();
    const totalElapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
    const totalElapsedMinutes = ((endTime - startTime) / 60000).toFixed(2);
    const totalExecutions = MODELS.length * executionsPerModel;
    
    writeToLog(`\n${'═'.repeat(80)}`);
    writeToLog('[STATS] [v2] BATCH EXECUTION SUMMARY');
    writeToLog(`${'═'.repeat(80)}`);
    writeToLog(`[INFO] Models tested: ${MODELS.length}`);
    writeToLog(`[EXEC] Executions per model: ${executionsPerModel}`);
    writeToLog(`[OK] Total successful executions: ${totalSuccessCount}/${totalExecutions}`);
    writeToLog(`[ERROR] Total failed executions: ${totalErrorCount}/${totalExecutions}`);
    writeToLog(`[TIME] Total execution time: ${totalElapsedSeconds} seconds (${totalElapsedMinutes} minutes)`);
    writeToLog(`[LOG] Log file saved to: ${logFilePath}`);
    writeToLog(`${'═'.repeat(80)}\n`);

    logStream.end();

  } catch (error) {
    writeToLog('\n[ERROR] [v2] Unexpected error in main execution:');
    if (error instanceof Error) {
      writeToLog(`   ${error.message}`);
      if (error.stack) {
        writeToLog('\nStack trace:');
        writeToLog(error.stack);
      }
    } else {
      writeToLog(`   Unknown error: ${JSON.stringify(error)}`);
    }
    
    // Calculate and display elapsed time even on unexpected error
    const endTime = Date.now();
    const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
    writeToLog(`\n[TIME] [v2] Total execution time before failure: ${elapsedSeconds} seconds`);
    writeToLog(`[LOG] Log file saved to: ${logFilePath}`);
    
    logStream.end(() => {
      process.exit(1);
    });
  }
}

// Run the script
main();

