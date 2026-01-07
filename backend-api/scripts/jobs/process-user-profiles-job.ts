/**
 * Scheduled Job: Process user profiles from unprocessed messages and external chat files
 * 
 * Modo de ejecución:
 *   - Sin parámetros (por defecto): Procesa solo usuarios con mensajes sin procesar
 *   - Con --reprocess-all: Procesa TODOS los usuarios y TODOS los chats
 *     (incluso los ya procesados), regenerando los embeddings
 *   - El scheduler automático ejecuta SIN parámetros cada 24h a las 3:00 AM
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
 * ============================================================================
 * PROCESO 1: PROCESS_1_CHATS_FROM_WODATES
 * ============================================================================
 * Este proceso:
 * 1. Busca usuarios con mensajes no procesados en la tabla 'messages'
 * 2. Para cada usuario encontrado, procesa sus mensajes usando GenerateUserProfileFromChats
 * 3. El use case maneja: leer mensajes, generar summary_incremental,
 *    hacer merge con summary consolidado, y limpiar summary_incremental
 * 4. Después de actualizar el summary, genera embedding desde summary y lo guarda en summary_embedding
 * 
 * ============================================================================
 * PROCESO 2: PROCESS_2_FROM_EXTERNAL_CHATS
 * ============================================================================
 * Este proceso se ejecuta DESPUÉS del Proceso 1, solo para usuarios procesados exitosamente:
 * 1. Para cada usuario procesado exitosamente en el Proceso 1
 * 2. Busca archivos ZIP en Storage (bucket 'external_chats') con estados procesables
 * 3. Descarga cada ZIP y extrae el archivo '_chat.txt'
 * 4. Parsea el contenido del chat (formato WhatsApp)
 * 5. Genera resumen incremental desde chats externos usando ai-service (PROCESO 2 actualmente deshabilitado)
 * 6. Hace merge con summary consolidado si existe (usando LLM dedicado)
 * 7. Genera embedding del resumen final y lo guarda
 * 8. Actualiza el estado del archivo a 'processed'
 * 
 * Los dos procesos están anidados secuencialmente: primero se completa el Proceso 1,
 * y luego se ejecuta el Proceso 2 para los usuarios que fueron procesados exitosamente.
 * 
 * Execution:
 * This script is automatically scheduled to run every day at 3:00 AM (Europe/Madrid timezone)
 * when the backend server starts. The scheduler is configured in src/app/jobs/scheduler.ts
 * 
 * The schedule can be configured via environment variables:
 *   - JOB_SCHEDULE_CRON: Cron expression (default: '0 3 * * *' = daily at 3:00 AM)
 *   - JOB_SCHEDULE_TIMEZONE: Timezone (default: 'Europe/Madrid')
 *   - JOB_SCHEDULE_ENABLED: Enable/disable scheduler (default: 'true')
 * 
 * Manual execution:
 *   - Default mode (process users with unprocessed messages):
 *     npx tsx scripts/jobs/process-user-profiles-job.ts
 *   - Reprocess all mode (all users, all chats, regenerate embeddings):
 *     npx tsx scripts/jobs/process-user-profiles-job.ts --reprocess-all
 * 
 * Examples:
 *   npx tsx scripts/jobs/process-user-profiles-job.ts
 *   npx tsx scripts/jobs/process-user-profiles-job.ts --reprocess-all
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AdmZip from 'adm-zip';
import { DocLoveHelper } from '../../src/app/services/doc-love-helper';
import { SupabaseMatchRepository } from '../../src/data/repositories/SupabaseMatchRepository';
import { SupabaseUserRepository } from '../../src/data/repositories/SupabaseUserRepository';
import { SupabaseMessageRepository } from '../../src/data/repositories/SupabaseMessageRepository';
import { SupabaseUserAIProfileRepository } from '../../src/data/repositories/SupabaseUserAIProfileRepository';
import { GetAllUserChats } from '../../src/domain/use-cases/chat/GetAllUserChats';
import { GetUnprocessedMessages } from '../../src/domain/use-cases/chat/GetUnprocessedMessages';
import { GenerateUserProfileFromChats } from '../../src/domain/use-cases/chat/GenerateUserProfileFromChats';
import { UserAIProfileEmbeddingService } from '../../src/app/ai/profile/UserAIProfileEmbeddingService';
import { UserBioGenerationService } from '../../src/app/ai/profile/UserBioGenerationService';
import { ExternalChatFilesService } from '../../src/app/services/external-chat-files-service';
import { AiServiceProfileClient } from '../../src/app/ai/clients/AiServiceProfileClient';
import { AiServiceEmbeddingClient } from '../../src/app/ai/clients/AiServiceEmbeddingClient';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

// Constants for external chat files processing
const BUCKET_NAME = 'external_chats';
const TARGET_FILE_NAME = '_chat.txt';
const PROCESSABLE_STATUSES = ['uploaded', 'processing', 'processed', 'error'];

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
 * Gets all user IDs that are not bots (regardless of message processing status)
 */
async function getAllUsers(
  client: SupabaseClient
): Promise<string[]> {
  try {
    const { data, error } = await client
      .from('users')
      .select('id')
      .or('is_bot.is.null,is_bot.eq.false');

    if (error) {
      throw new Error(`Failed to fetch all users: ${error.message}`);
    }

    return (data ?? []).map((row) => row.id);
  } catch (error) {
    throw new Error(`Failed to get all users: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Resets all messages for a user as unprocessed
 * Sets profile_processed_at = NULL for all messages sent by the user
 */
async function resetUserMessages(
  client: SupabaseClient,
  userId: string,
  writeToLog: (message: string, level?: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG') => void
): Promise<number> {
  try {
    // Count messages to reset
    const { count, error: countError } = await client
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', userId)
      .not('profile_processed_at', 'is', null);

    if (countError) {
      throw new Error(`Failed to count messages: ${countError.message}`);
    }

    const messagesToReset = count || 0;

    if (messagesToReset === 0) {
      return 0;
    }

    // Reset profile_processed_at to NULL for all messages sent by this user
    const { data, error } = await client
      .from('messages')
      .update({ profile_processed_at: null })
      .eq('sender_id', userId)
      .not('profile_processed_at', 'is', null)
      .select('id');

    if (error) {
      throw new Error(`Failed to reset messages: ${error.message}`);
    }

    const resetCount = data?.length || 0;
    writeToLog(`Reset ${resetCount} message(s) as unprocessed for user ${userId}`, 'INFO');
    
    return resetCount;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    writeToLog(`Failed to reset messages for user ${userId}: ${errorMessage}`, 'ERROR');
    throw error;
  }
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
    // Fallback: if the join query failed, use a simpler approach
    // Logging removed - fallback is automatic and expected behavior
    
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

/**
 * Gets all external chat files for a user from the database
 */
async function getUserChatFiles(
  client: SupabaseClient,
  userId: string
): Promise<Array<{ id: string; filePath: string; status: string; errorMessage: string | null }>> {
  try {
    const { data, error } = await client
      .from('external_chat_files')
      .select('id, file_path, status, error_message')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to query external chat files: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      filePath: row.file_path,
      status: row.status,
      errorMessage: row.error_message || null,
    }));
  } catch (error) {
    // Error will be logged by caller
    throw error;
  }
}

/**
 * Gets all external chat files with processable statuses, grouped by user_id
 */
async function getAllProcessableExternalChatFiles(
  client: SupabaseClient
): Promise<Map<string, Array<{ id: string; filePath: string; status: string; errorMessage: string | null }>>> {
  try {
    const { data, error } = await client
      .from('external_chat_files')
      .select('id, user_id, file_path, status, error_message')
      .in('status', PROCESSABLE_STATUSES)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to query external chat files: ${error.message}`);
    }

    // Group by user_id
    const filesByUser = new Map<string, Array<{ id: string; filePath: string; status: string; errorMessage: string | null }>>();
    
    for (const row of data || []) {
      const userId = row.user_id;
      if (!filesByUser.has(userId)) {
        filesByUser.set(userId, []);
      }
      filesByUser.get(userId)!.push({
        id: row.id,
        filePath: row.file_path,
        status: row.status,
        errorMessage: row.error_message || null,
      });
    }

    return filesByUser;
  } catch (error) {
    // Error will be logged by caller
    throw error;
  }
}

/**
 * Lists all files/folders in a given path within the bucket
 * Returns both files and folders separately
 */
async function listItems(
  client: SupabaseClient,
  path: string
): Promise<{ files: string[]; folders: string[] }> {
  try {
    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .list(path, {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return { files: [], folders: [] };
    }

    const files: string[] = [];
    const folders: string[] = [];

    for (const item of data) {
      if (item.metadata?.size !== undefined || item.name.includes('.')) {
        files.push(item.name);
      } else {
        folders.push(item.name);
      }
    }

    return { files, folders };
  } catch (error) {
    // Error will be logged by caller
    throw error;
  }
}

/**
 * Checks if a file exists in Supabase Storage and returns diagnostic info
 */
async function checkFileExists(
  client: SupabaseClient,
  filePath: string
): Promise<{ exists: boolean; reason?: string; folderContents?: string[] }> {
  try {
    const folderPath = filePath.split('/').slice(0, -1).join('/');
    const fileName = filePath.split('/').pop()!;
    
    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .list(folderPath);

    if (error) {
      return {
        exists: false,
        reason: `Cannot access folder: ${error.message || JSON.stringify(error)}`,
      };
    }

    const folderContents = (data || []).map((f) => f.name);
    const exists = folderContents.includes(fileName);

    if (!exists) {
      return {
        exists: false,
        reason: `File '${fileName}' not found in folder. Folder contains: ${folderContents.length > 0 ? folderContents.join(', ') : 'nothing'}`,
        folderContents,
      };
    }

    return { exists: true, folderContents };
  } catch (error) {
    return {
      exists: false,
      reason: `Error checking file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Downloads a file from Supabase Storage and returns it as a Buffer
 */
async function downloadFile(
  client: SupabaseClient,
  filePath: string
): Promise<Buffer> {
  try {
    const fileCheck = await checkFileExists(client, filePath);
    if (!fileCheck.exists) {
      const errorMsg = `File does not exist in Storage: ${filePath}. ${fileCheck.reason || 'Unknown reason'}`;
      // Error will be logged by caller
      throw new Error(errorMsg);
    }
    
    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .download(filePath);

    if (error) {
      let errorMessage = error.message || 'Unknown error';
      
      if ((error as any).originalError) {
        const originalError = (error as any).originalError;
        if (typeof originalError === 'object' && Object.keys(originalError).length > 0) {
          errorMessage = JSON.stringify(originalError);
        } else if (typeof originalError === 'string') {
          errorMessage = originalError;
        }
      }
      
      if (error.name === 'StorageUnknownError') {
        errorMessage = `File not found or access denied. Path: ${filePath}`;
      }
      
      throw new Error(`Failed to download file: ${errorMessage}`);
    }

    if (!data) {
      throw new Error('No data returned from download');
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    // Error will be logged by caller
    throw error;
  }
}

/**
 * Extracts and searches for _chat.txt in a ZIP file buffer
 */
function extractChatFromZip(zipBuffer: Buffer, zipPath: string): string | null {
  try {
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    const chatEntry = zipEntries.find(
      (entry) => entry.entryName === TARGET_FILE_NAME || entry.entryName.endsWith(`/${TARGET_FILE_NAME}`)
    );

    if (!chatEntry) {
      return null;
    }

    const content = zip.readAsText(chatEntry, 'utf8');
    return content;
  } catch (error) {
    // Error will be logged by caller
    throw error;
  }
}

/**
 * Gets unique participants from chat text (WhatsApp format)
 * Reads the entire file and counts distinct sender names
 * Format: [DD/MM/YY, HH:MM:SS] Nombre: mensaje
 */
function getChatParticipants(chatText: string): { participants: Set<string>; count: number } {
  const participants = new Set<string>();
  const lines = chatText.split('\n').filter(line => line.trim().length > 0);
  
  for (const line of lines) {
    // Match format: [DD/MM/YY, HH:MM:SS] Nombre: mensaje
    // Extract sender name (between timestamp and colon)
    const match = line.match(/^\[(\d+)\/(\d+)\/(\d+),\s*(\d+):(\d+)(?::(\d+))?\]\s*(.+?):\s*(.+)$/);
    
    if (match) {
      const senderName = match[7].trim(); // Name before colon
      if (senderName.length > 0) {
        participants.add(senderName);
      }
    }
  }
  
  return {
    participants,
    count: participants.size,
  };
}

/**
 * Parses chat text (WhatsApp format) to extract messages with timestamps
 * Format: [DD/MM/YY, HH:MM] Nombre: mensaje
 */
function parseChatText(chatText: string): Array<{ role: 'user'; content: string; timestamp: Date; senderName?: string }> {
  const messages: Array<{ role: 'user'; content: string; timestamp: Date; senderName?: string }> = [];
  
  const lines = chatText.split('\n').filter(line => line.trim().length > 0);
  
  for (const line of lines) {
    const match = line.match(/^\[(\d+)\/(\d+)\/(\d+),\s*(\d+):(\d+)(?::(\d+))?\]\s*(.+?):\s*(.+)$/);
    
    if (match) {
      const [, day, month, year, hours, minutes, seconds, senderName, content] = match;
      
      const fullYear = 2000 + parseInt(year, 10);
      const timestamp = new Date(
        fullYear,
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        parseInt(hours, 10),
        parseInt(minutes, 10),
        seconds ? parseInt(seconds, 10) : 0
      );
      
      messages.push({
        role: 'user',
        content: content.trim(),
        timestamp,
        senderName: senderName.trim(), // Preserve sender name for MAIN marking
      });
    }
  }
  
  return messages;
}

/**
 * Transforms chat text to SummarizerRequest format with importedConversations
 * NOTE: This function is only used in PROCESO 2 which is currently disabled.
 * When PROCESO 2 is re-enabled, it should be refactored to use ai-service.
 */
/*
function transformChatTextToSummarizerRequest(
  chatText: string,
  user: { name?: string; bio?: string; birthDate?: string },
  source: string = 'WhatsApp'
): SummarizerRequest {
  const messages = parseChatText(chatText);
  
  let age: number | undefined;
  if (user.birthDate) {
    const birthDate = new Date(user.birthDate);
    const today = new Date();
    age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
  }
  
  const userProfile: SummarizerRequest['userProfile'] = {};
  if (user.name !== undefined) {
    userProfile.name = user.name;
  }
  if (user.bio !== undefined) {
    userProfile.bio = user.bio;
  }
  if (age !== undefined) {
    userProfile.age = age;
  }
  
  const result: SummarizerRequest = {
    newContent: {
      importedConversations: [
        {
          source,
          messages,
        },
      ],
    },
  };
  
  if (Object.keys(userProfile).length > 0) {
    result.userProfile = userProfile;
  }
  
  return result;
}
*/

/**
 * Merges two summaries using LLM (similar to GenerateUserProfileFromChats.mergeSummaries)
 * NOTE: This function calls Ollama directly and is only used in PROCESO 2 which is currently disabled.
 * When PROCESO 2 is re-enabled, it should be refactored to use AiServiceProfileClient.mergeProfiles.
 */
/*
async function mergeSummaries(
  consolidatedSummary: string,
  incrementalSummary: string,
  baseUrl: string,
  timeout: number,
  mergeParams: any,
  model: string
): Promise<string> {
  const mergePrompt = AIConfig.prompt.summarizerInstructions.mergeSummaries
    .replace('{{PROFILE_1}}', consolidatedSummary)
    .replace('{{PROFILE_2}}', incrementalSummary);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const requestBody: any = {
      model: model,
      prompt: mergePrompt,
      stream: true,
      temperature: mergeParams.temperature,
      num_predict: mergeParams.num_predict,
      num_ctx: mergeParams.num_ctx,
    };
    
    if (mergeParams.seed !== undefined) {
      requestBody.seed = mergeParams.seed;
    }
    if (mergeParams.top_p !== undefined) {
      requestBody.top_p = mergeParams.top_p;
    }
    if (mergeParams.top_k !== undefined) {
      requestBody.top_k = mergeParams.top_k;
    }
    if (mergeParams.repeat_penalty !== undefined) {
      requestBody.repeat_penalty = mergeParams.repeat_penalty;
    }
    
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    
    if (!response.ok) {
      clearTimeout(timeoutId);
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Ollama API returned ${response.status}: ${errorText}`);
    }
    
    if (!response.body) {
      clearTimeout(timeoutId);
      throw new Error('Ollama API response has no body');
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    
    try {
      for (;;) {
        if (controller.signal.aborted) {
          throw new Error('Request aborted due to timeout');
        }
        
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.trim());
        
        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            
            if (json.response) {
              fullResponse += json.response;
            }
            
            if (json.done === true) {
              clearTimeout(timeoutId);
              return fullResponse.trim();
            }
            
            if (json.error) {
              clearTimeout(timeoutId);
              throw new Error(`Ollama stream error: ${json.error}`);
            }
          } catch (parseError) {
            // Ignore JSON parsing errors (expected during streaming)
            if (!(parseError instanceof SyntaxError)) {
              // Silent - parsing errors during streaming are normal
            }
          }
        }
      }
    } finally {
      clearTimeout(timeoutId);
      reader.releaseLock();
    }
    
    return fullResponse.trim();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        throw new Error(`Ollama API timeout after ${timeout}ms`);
      }
      throw error;
    }
    
    throw new Error('Unknown error calling Ollama API');
  }
}
*/

/**
 * Processes chat content: generates summary, merges if needed, and generates embedding
 * NOTE: This function uses SummarizerModel directly and is only used in PROCESO 2 which is currently disabled.
 * When PROCESO 2 is re-enabled, it should be refactored to use AiServiceProfileClient.
 */
/*
async function processChatContent(
  chatContent: string,
  userId: string,
  summarizerModel: SummarizerModel,
  userAIProfileRepository: SupabaseUserAIProfileRepository,
  userRepository: SupabaseUserRepository,
  embeddingService: UserAIProfileEmbeddingService,
  config: { url: string; serviceRoleKey: string },
  writeToLog: (message: string, level?: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG') => void
): Promise<void> {
  writeToLog(`Processing chat content for user profile (userId: ${userId})`, 'INFO');
  
  const userResult = await userRepository.findById(userId);
  if (!userResult.success) {
    throw new Error(`Failed to get user: ${userResult.error.message}`);
  }
  
  const user = userResult.data;
  const userData: { name?: string; bio?: string; birthDate?: string } = {};
  if (user.name !== undefined) {
    userData.name = user.name;
  }
  if (user.bio !== undefined) {
    userData.bio = user.bio;
  }
  if (user.birthDate !== undefined) {
    userData.birthDate = user.birthDate;
  }
  
  const summarizerRequest = transformChatTextToSummarizerRequest(
    chatContent,
    userData,
    'WhatsApp'
  );
  
  writeToLog(`Generating incremental summary from chat content`, 'INFO');
  const summaryResponse = await summarizerModel.generateSummary(summarizerRequest);
  
  writeToLog(`Saving incremental summary`, 'INFO');
  const upsertResult = await userAIProfileRepository.upsert({
    userId,
    summaryIncremental: summaryResponse.summary,
    summaryEmbedding: null,
  });
  
  if (!upsertResult.success) {
    throw new Error(`Failed to save incremental summary: ${upsertResult.error.message}`);
  }
  
  const profileAfterIncremental = upsertResult.data;
  const consolidatedSummary = profileAfterIncremental.summary;
  const incrementalSummary = profileAfterIncremental.summaryIncremental;
  
  if (consolidatedSummary && incrementalSummary) {
    writeToLog(`Merging consolidated summary with incremental summary`, 'INFO');
    
    const baseUrl = AIConfig.ollama.baseUrl;
    const timeout = AIConfig.ollama.summarizationTimeout;
    const mergeParams = AIConfig.ollama.mergeParameters;
    const model = AIConfig.ollama.profileMergeResumesModel;
    
    try {
      const mergedSummary = await mergeSummaries(
        consolidatedSummary,
        incrementalSummary,
        baseUrl,
        timeout,
        mergeParams,
        model
      );
      
      writeToLog(`Saving merged summary and clearing incremental`, 'INFO');
      const finalUpsertResult = await userAIProfileRepository.upsert({
        userId,
        summary: mergedSummary,
        summaryIncremental: null,
        summaryEmbedding: null,
      });
      
      if (!finalUpsertResult.success) {
        throw new Error(`Failed to save merged summary: ${finalUpsertResult.error.message}`);
      }
      
      writeToLog(`Summaries merged successfully`, 'INFO');
    } catch (error) {
      writeToLog(`Failed to merge summaries: ${error instanceof Error ? error.message : String(error)}`, 'ERROR');
      throw error;
    }
  } else if (!consolidatedSummary && incrementalSummary) {
    writeToLog(`Copying incremental to summary (first time)`, 'INFO');
    const firstTimeUpsertResult = await userAIProfileRepository.upsert({
      userId,
      summary: incrementalSummary,
      summaryIncremental: null,
      summaryEmbedding: null,
    });
    
    if (!firstTimeUpsertResult.success) {
      throw new Error(`Failed to save first-time summary: ${firstTimeUpsertResult.error.message}`);
    }
    
    writeToLog(`Profile initialized successfully`, 'INFO');
  }
  
  writeToLog(`Generating embedding from summary`, 'INFO');
  try {
    await embeddingService.generateEmbeddingFromSummary(userId);
    writeToLog(`Embedding generated successfully`, 'INFO');
  } catch (embeddingError) {
    writeToLog(`Failed to generate embedding: ${embeddingError instanceof Error ? embeddingError.message : String(embeddingError)}`, 'WARN');
  }
}
*/

async function main() {
  const startTime = Date.now();
  
  // Setup logging to file
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const logDir = path.join(__dirname, 'logs');
  
  // Ensure logs directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  // Generate log filename: process-user-profiles-job-YYYYMMDD_HHMM.log
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const logFileName = `process-user-profiles-job-${year}${month}${day}_${hours}${minutes}.log`;
  const logFilePath = path.join(logDir, logFileName);
  
  // Create write stream for log file
  const logStream = fs.createWriteStream(logFilePath, {
    flags: 'a',
    encoding: 'utf8'
  });
  logStream.setDefaultEncoding('utf8');
  
  // Save original console methods before overriding
  const originalConsoleLog = console.log.bind(console);
  const originalConsoleError = console.error.bind(console);
  const originalConsoleWarn = console.warn.bind(console);
  const originalConsoleDebug = console.debug.bind(console);
  
  // Helper function to write to both console and log file
  const writeToLog = (message: string, level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG' = 'INFO') => {
    const timestamp = new Date().toISOString();
    const prefixedMessage = `[${timestamp}] [${level}] ${message}`;
    
    // Write to file
    logStream.write(prefixedMessage + '\n', 'utf8');
    
    // Also write to console (for real-time monitoring) using original methods
    if (level === 'ERROR') {
      originalConsoleError(prefixedMessage);
    } else if (level === 'WARN') {
      originalConsoleWarn(prefixedMessage);
    } else {
      originalConsoleLog(prefixedMessage);
    }
  };
  
  // Override console methods to write to file as well
  console.log = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    writeToLog(message, 'INFO');
  };
  
  console.error = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    writeToLog(message, 'ERROR');
  };
  
  console.warn = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    writeToLog(message, 'WARN');
  };
  
  console.debug = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    writeToLog(message, 'DEBUG');
  };
  
  // Check command line arguments
  const args = process.argv.slice(2);
  const isReprocessAllMode = args.includes('--reprocess-all');
  
  // Validate arguments
  if (args.length > 0 && !isReprocessAllMode) {
    writeToLog(`Invalid argument(s): ${args.join(' ')}`, 'ERROR');
    writeToLog(`Usage: npx tsx scripts/jobs/process-user-profiles-job.ts [--reprocess-all]`, 'ERROR');
    writeToLog(`  --reprocess-all: Process all users and all chats (including already processed)`, 'ERROR');
    logStream.end(() => process.exit(1));
    return;
  }
  
  writeToLog(`Log file: ${logFilePath}`, 'INFO');
  
  if (isReprocessAllMode) {
    writeToLog(`Starting user profile processing job (REPROCESS ALL MODE)`, 'INFO');
    writeToLog(`Will process ALL users and ALL chats (including already processed)`, 'INFO');
    writeToLog(`This will reset all messages as unprocessed and regenerate embeddings`, 'WARN');
  } else {
    writeToLog(`Starting user profile processing job (DEFAULT MODE)`, 'INFO');
    writeToLog(`Processing users with unprocessed messages only`, 'INFO');
  }

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

    // Initialize logger (will use overridden console methods that write to file)
    const logger = {
      debug: (...args: any[]) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        writeToLog(message, 'DEBUG');
      },
      info: (...args: any[]) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        writeToLog(message, 'INFO');
      },
      warn: (...args: any[]) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        writeToLog(message, 'WARN');
      },
      error: (...args: any[]) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        writeToLog(message, 'ERROR');
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

    // Initialize ai-service clients (exclusive use - no legacy models)
    const aiServiceProfileClient = new AiServiceProfileClient(
      undefined, // Use default from AIConfig
      undefined, // Use default timeout
      logger
    );
    
    const aiServiceEmbeddingClient = new AiServiceEmbeddingClient(
      undefined, // Use default from AIConfig
      undefined, // Use default timeout
      logger
    );

    // Initialize use case (uses ai-service via AiServiceProfileClient)
    const generateUserProfile = new GenerateUserProfileFromChats(
      getAllUserChats,
      userAIProfileRepository,
      userRepository,
      logger
    );

    // Initialize embedding service (uses ai-service via AiServiceEmbeddingClient)
    const embeddingService = new UserAIProfileEmbeddingService(
      userAIProfileRepository,
      logger
    );

    // Initialize bio generation service (uses ai-service via AiServiceChatClient)
    const bioGenerationService = new UserBioGenerationService(
      userAIProfileRepository,
      userRepository,
      logger
    );

    // ============================================================================
    // PROCESO 1: PROCESS_1_CHATS_FROM_WODATES
    // ============================================================================
    // Este proceso busca usuarios con mensajes no procesados y genera/actualiza
    // sus perfiles de IA desde las conversaciones internas de la plataforma.
    // ============================================================================
    
    writeToLog('[PROCESS_1] Starting internal messages processing', 'INFO');
    
    // Get users to process
    let userIds: string[];
    if (isReprocessAllMode) {
      // Get all users (not just those with unprocessed messages)
      writeToLog('Reprocess all mode: Querying all users...', 'INFO');
      userIds = await getAllUsers(client);
      writeToLog(`Found ${userIds.length} total users`, 'INFO');
      
      // Reset all messages for all users as unprocessed
      writeToLog('Resetting all messages as unprocessed for all users...', 'INFO');
      let totalResetCount = 0;
      for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i];
        const userNumber = i + 1;
        writeToLog(`[${userNumber}/${userIds.length}] Resetting messages for user: ${userId}`, 'INFO');
        try {
          const resetCount = await resetUserMessages(client, userId, writeToLog);
          totalResetCount += resetCount;
        } catch (error) {
          writeToLog(`Failed to reset messages for user ${userId}, continuing...`, 'WARN');
        }
      }
      writeToLog(`Total messages reset: ${totalResetCount}`, 'INFO');
    } else {
      // Default mode: only users with unprocessed messages
      writeToLog('Default mode: Querying users with unprocessed messages...', 'INFO');
      userIds = await getUsersWithUnprocessedMessages(client);
      writeToLog(`Found ${userIds.length} users with unprocessed messages`, 'INFO');
    }
    writeToLog(`Will process ${userIds.length} user(s)`, 'INFO');

    // Process each user
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const results: Array<{ userId: string; status: 'success' | 'skipped' | 'error'; message?: string }> = [];

    if (userIds.length === 0) {
      writeToLog('No users with unprocessed messages found', 'INFO');
      writeToLog('Skipping to Process 2 (external chat files)', 'INFO');
    } else {
      for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i];
        const userNumber = i + 1;
        
        writeToLog(`[${userNumber}/${userIds.length}] Processing user: ${userId}`, 'INFO');

      try {
        // CRITICAL: Check if user has active chats with real users (not Doc Love)
        // Only process if active_chats_count = 0 (user is not talking to anyone real)
        const { data: userData, error: userError } = await client
          .from('users')
          .select('active_chats_count')
          .eq('id', userId)
          .single<{ active_chats_count: number | null }>();

        if (userError) {
          writeToLog(`Failed to check active_chats_count for user ${userId}: ${userError.message}`, 'WARN');
          // Continue processing - better to process than skip on error
        } else if (userData) {
          const activeChatsCount = userData.active_chats_count ?? 0;
          if (activeChatsCount >= 1) {
            writeToLog(`User ${userId}: Has ${activeChatsCount} active chat(s) with real users, skipping processing (user is currently talking to someone)`, 'INFO');
            skippedCount++;
            results.push({ 
              userId, 
              status: 'skipped',
              message: `User has ${activeChatsCount} active chat(s)`
            });
            continue;
          }
        }

        // Get profile before processing to compare summary changes
        const profileBeforeResult = await userAIProfileRepository.findByUserId(userId);
        const summaryBefore = profileBeforeResult.success && profileBeforeResult.data 
          ? profileBeforeResult.data.summary 
          : null;
        
        // Process user profile
        // Note: GenerateUserProfileFromChats will handle checking for unprocessed messages
        // and will return early if none are found, so we don't need to check again here
        const result = await generateUserProfile.execute(userId);

        if (!result.success) {
          writeToLog(`Failed to process user ${userId}: Code=${result.error.code}, Message=${result.error.message}`, 'ERROR');
          errorCount++;
          results.push({
            userId,
            status: 'error',
            message: result.error.message,
          });
          continue;
        }

        if (result.data === 'No unprocessed chats to analyze') {
          writeToLog(`User ${userId}: No unprocessed chats (may have been processed by another instance)`, 'INFO');
          skippedCount++;
          results.push({ userId, status: 'skipped' });
          continue;
        }

        writeToLog(`User ${userId} profile processed successfully`, 'INFO');
        
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
            writeToLog(`User ${userId}: No consolidated summary yet (only incremental), skipping embedding generation`, 'INFO');
          } else if (!summaryChanged && summaryBeforeContent !== null) {
            writeToLog(`User ${userId}: Summary unchanged, skipping embedding generation`, 'INFO');
          } else {
            // Summary changed (new summary or content changed)
            writeToLog(`Summary ${summaryBeforeContent === null ? 'created' : 'changed'} for user ${userId}, generating embedding...`, 'INFO');
            await embeddingService.generateEmbeddingFromSummary(userId);
            writeToLog(`Embedding generated successfully for user ${userId}`, 'INFO');
          }
        } catch (embeddingError) {
          // Log error but don't fail the whole process - summary is already saved
          writeToLog(`Failed to generate embedding for user ${userId}: ${embeddingError instanceof Error ? embeddingError.message : String(embeddingError)}`, 'WARN');
        }

        // Generate bio from summary after embedding generation
        // Bio generation is independent of summary changes - always generate if summary exists
        try {
          const profileAfterResult = await userAIProfileRepository.findByUserId(userId);
          const summaryAfter = profileAfterResult.success && profileAfterResult.data 
            ? profileAfterResult.data.summary 
            : null;
          
          const hasConsolidatedSummary = summaryAfter !== null && summaryAfter.trim().length > 0;
          
          if (!hasConsolidatedSummary) {
            writeToLog(`User ${userId}: No consolidated summary available, skipping bio generation`, 'INFO');
          } else {
            // Always generate bio if summary exists (independent of whether it changed)
            writeToLog(`User ${userId}: Generating bio from summary (independent of summary changes)...`, 'INFO');
            await bioGenerationService.generateBioFromSummary(userId);
            writeToLog(`Bio generated successfully for user ${userId}`, 'INFO');
          }
        } catch (bioError) {
          // Log error but don't fail the whole process - summary and embedding are already saved
          writeToLog(`Failed to generate bio for user ${userId}: ${bioError instanceof Error ? bioError.message : String(bioError)}`, 'WARN');
        }
        
        processedCount++;
        results.push({ userId, status: 'success' });

      } catch (error) {
        writeToLog(`Unexpected error processing user ${userId}: ${error instanceof Error ? error.message : String(error)}`, 'ERROR');
        if (error instanceof Error && error.stack) {
          writeToLog(`Stack trace: ${error.stack}`, 'ERROR');
        }
        errorCount++;
        results.push({
          userId,
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    writeToLog('[PROCESS_1] Internal messages processing completed', 'INFO');
    writeToLog(`Successfully processed: ${processedCount}`, 'INFO');
    writeToLog(`Skipped: ${skippedCount}`, 'INFO');
    writeToLog(`Failed: ${errorCount}`, 'INFO');
    }

    // ============================================================================
    // PROCESO 2: PROCESS_2_FROM_EXTERNAL_CHATS
    // ============================================================================
    // Este proceso se ejecuta DESPUÉS del Proceso 1.
    // Procesa archivos ZIP externos solo para usuarios que fueron procesados
    // exitosamente en el Proceso 1.
    // ============================================================================
    // TEMPORALMENTE DESHABILITADO - No ejecutar PROCESO 2
    /*
    console.log('\n' + '═'.repeat(80));
    console.log('[PROCESS_2_FROM_EXTERNAL_CHATS] Starting external chat files processing');
    console.log('═'.repeat(80));
    
    const externalChatFilesService = new ExternalChatFilesService();
    let externalChatsProcessedCount = 0;
    let externalChatsErrorCount = 0;
    
    // Search directly in external_chat_files table for all files with processable statuses
    console.log(`[PROCESS_2_FROM_EXTERNAL_CHATS] Querying external_chat_files table for files with statuses: [${PROCESSABLE_STATUSES.join(', ')}]`);
    const filesByUser = await getAllProcessableExternalChatFiles(client);
    const usersToProcessExternalChats = Array.from(filesByUser.keys());
    
    if (usersToProcessExternalChats.length === 0) {
      console.log('[PROCESS_2_FROM_EXTERNAL_CHATS] No files with processable statuses found in external_chat_files table');
      console.log('[PROCESS_2_FROM_EXTERNAL_CHATS] Skipping external chat files processing\n');
    } else {
      const totalFiles = Array.from(filesByUser.values()).reduce((sum, files) => sum + files.length, 0);
      console.log(`[PROCESS_2_FROM_EXTERNAL_CHATS] Found ${totalFiles} file(s) across ${usersToProcessExternalChats.length} user(s)\n`);
      
      for (const userId of usersToProcessExternalChats) {
        console.log(`\n[PROCESS_2_FROM_EXTERNAL_CHATS] Processing external chats for user: ${userId}`);
        console.log('─'.repeat(60));
        
        try {
          // Get external chat files for this user (already filtered by processable statuses)
          const filesToProcess = filesByUser.get(userId) || [];
          
          if (filesToProcess.length === 0) {
            console.log(`[PROCESS_2_FROM_EXTERNAL_CHATS] No files to process for user ${userId}`);
            continue;
          }
          
          console.log(`[PROCESS_2_FROM_EXTERNAL_CHATS] Found ${filesToProcess.length} file(s) to process for user ${userId}`);
          
          // Process each ZIP file
          for (const chatFile of filesToProcess) {
            console.log(`\n[PROCESS_2_FROM_EXTERNAL_CHATS] Processing file: ${chatFile.filePath}`);
            console.log(`[PROCESS_2_FROM_EXTERNAL_CHATS] Status: ${chatFile.status} | File ID: ${chatFile.id}`);
            
            try {
              // Update status to processing
              if (chatFile.status !== 'processing') {
                await externalChatFilesService.updateStatus(chatFile.id, 'processing');
                console.log(`[PROCESS_2_FROM_EXTERNAL_CHATS] Updated status to 'processing'`);
              }
              
              // Download ZIP file
              const zipBuffer = await downloadFile(client, chatFile.filePath);
              console.log(`[PROCESS_2_FROM_EXTERNAL_CHATS] ✅ Downloaded (${Math.round(zipBuffer.length / 1024)}KB)`);
              
              // Extract _chat.txt
              const chatContent = extractChatFromZip(zipBuffer, chatFile.filePath);
              
              if (chatContent === null) {
                console.log(`[PROCESS_2_FROM_EXTERNAL_CHATS] ⚠️  No ${TARGET_FILE_NAME} found in this ZIP`);
                await externalChatFilesService.updateStatus(
                  chatFile.id,
                  'error',
                  `No ${TARGET_FILE_NAME} found in ZIP`
                );
                externalChatsErrorCount++;
                continue;
              }
              
              const contentLength = chatContent.length;
              const lineCount = chatContent.split('\n').length;
              console.log(`[PROCESS_2_FROM_EXTERNAL_CHATS] ✅ Found ${TARGET_FILE_NAME} (${contentLength} characters, ${lineCount} lines)`);
              
              // Check if this is a group chat (more than 2 participants)
              const { participants, count } = getChatParticipants(chatContent);
              console.log(`[PROCESS_2_FROM_EXTERNAL_CHATS] Detected ${count} participant(s): ${Array.from(participants).join(', ')}`);
              
              if (count > 2) {
                const errorMsg = `Group chat detected (${count} participants: ${Array.from(participants).slice(0, 10).join(', ')}${participants.size > 10 ? '...' : ''}) - ignored for profiling`;
                console.log(`[PROCESS_2_FROM_EXTERNAL_CHATS] ⚠️  ${errorMsg}`);
                console.log(`[PROCESS_2_FROM_EXTERNAL_CHATS] ⚠️  Skipping file - group chats are not processed for user profiling`);
                
                try {
                  await externalChatFilesService.updateStatus(
                    chatFile.id,
                    'error',
                    errorMsg.substring(0, 500) // Limit to 500 chars for database
                  );
                  console.log(`[PROCESS_2_FROM_EXTERNAL_CHATS] ✅ Status updated to 'error' with error message`);
                } catch (updateError) {
                  console.error(`[PROCESS_2_FROM_EXTERNAL_CHATS] ❌ Failed to update status to error:`, updateError);
                  // Continue anyway - we still want to skip this file
                }
                
                externalChatsErrorCount++;
                continue; // Skip to next file - DO NOT process group chats
              }
              
              // Process chat content: generate summary, merge if needed, and generate embedding
              // Only reaches here if count <= 2 (individual chat or chat with one other person)
              console.log(`[PROCESS_2_FROM_EXTERNAL_CHATS] ✅ Valid chat format (${count} participants), proceeding with processing...`);
              console.log(`[PROCESS_2_FROM_EXTERNAL_CHATS] Processing chat content for user profile...`);
              await processChatContent(
                chatContent,
                userId,
                summarizerModel,
                userAIProfileRepository,
                userRepository,
                embeddingService,
                config
              );
              console.log(`[PROCESS_2_FROM_EXTERNAL_CHATS] ✅ Chat content processed successfully`);
              
              // Update status to processed
              await externalChatFilesService.updateStatus(chatFile.id, 'processed');
              console.log(`[PROCESS_2_FROM_EXTERNAL_CHATS] Updated status to 'processed'`);
              
              externalChatsProcessedCount++;
              
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              console.error(`[PROCESS_2_FROM_EXTERNAL_CHATS] ❌ Error processing file ${chatFile.filePath}`);
              console.error(`[PROCESS_2_FROM_EXTERNAL_CHATS]    Reason: ${errorMessage}`);
              
              try {
                await externalChatFilesService.updateStatus(
                  chatFile.id,
                  'error',
                  errorMessage.substring(0, 500)
                );
              } catch (updateError) {
                console.error(`[PROCESS_2_FROM_EXTERNAL_CHATS] ⚠️  Failed to update status to error:`, updateError);
              }
              
              externalChatsErrorCount++;
            }
          }
          
        } catch (error) {
          console.error(`[PROCESS_2_FROM_EXTERNAL_CHATS] ❌ Error processing external chats for user ${userId}:`, error);
          externalChatsErrorCount++;
        }
      }
      
      console.log('\n' + '═'.repeat(80));
      console.log('[PROCESS_2_FROM_EXTERNAL_CHATS] External chat files processing completed');
      console.log('═'.repeat(80));
      console.log(`[PROCESS_2_FROM_EXTERNAL_CHATS] Successfully processed: ${externalChatsProcessedCount}`);
      console.log(`[PROCESS_2_FROM_EXTERNAL_CHATS] Failed: ${externalChatsErrorCount}`);
      console.log('═'.repeat(80));
    }
    */

    // Summary
    const endTime = Date.now();
    const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
    const elapsedMinutes = ((endTime - startTime) / 60000).toFixed(2);

    writeToLog('[SUMMARY] Job execution completed', 'INFO');
    writeToLog(`Users with unprocessed messages: ${userIds.length}`, 'INFO');
    writeToLog(`Successfully processed: ${processedCount}`, 'INFO');
    writeToLog(`Skipped: ${skippedCount}`, 'INFO');
    writeToLog(`Failed: ${errorCount}`, 'INFO');
    writeToLog(`Total execution time: ${elapsedSeconds} seconds (${elapsedMinutes} minutes)`, 'INFO');
    writeToLog(`Log file saved to: ${logFilePath}`, 'INFO');

    // Exit with error code if there were failures
    const totalErrors = errorCount;
    if (totalErrors > 0) {
      writeToLog(`Job completed with ${totalErrors} error(s). Check logs above for details.`, 'WARN');
      logStream.end(() => process.exit(1));
    } else {
      writeToLog('Job completed successfully!', 'INFO');
      logStream.end();
    }

  } catch (error) {
    const endTime = Date.now();
    const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
    
    writeToLog('Fatal error in job execution:', 'ERROR');
    if (error instanceof Error) {
      writeToLog(`Error: ${error.message}`, 'ERROR');
      if (error.stack) {
        writeToLog(`Stack trace: ${error.stack}`, 'ERROR');
      }
    } else {
      writeToLog(`Unknown error: ${JSON.stringify(error)}`, 'ERROR');
    }
    writeToLog(`Job failed after ${elapsedSeconds} seconds`, 'ERROR');
    writeToLog(`Log file saved to: ${logFilePath}`, 'ERROR');
    logStream.end(() => process.exit(1));
  }
}

// Run the job
main();

