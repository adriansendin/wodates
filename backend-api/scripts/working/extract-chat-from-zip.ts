/**
 * Script to extract _chat.txt files from ZIP archives in Supabase Storage
 * 
 * This script searches for ZIP files in the external_chats bucket
 * for a given user ID, extracts _chat.txt files from each ZIP, and prints
 * their content to the console.
 * 
 * Usage:
 *   npx tsx scripts/working/extract-chat-from-zip.ts <USER_ID>
 * 
 * Example:
 *   npx tsx scripts/working/extract-chat-from-zip.ts 8e1139a4-e3ec-4e4c-964b-a98ad5417f71
 */

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AdmZip from 'adm-zip';
import { ExternalChatFilesService } from '../../src/app/services/external-chat-files-service';
import { SummarizerModel, SummarizerRequest } from '../../src/app/ai/core/SummarizerModel';
import { createSummarizerModel, createEmbeddingModel } from '../../src/app/ai/core/config';
import { SupabaseUserAIProfileRepository } from '../../src/data/repositories/SupabaseUserAIProfileRepository';
import { SupabaseUserRepository } from '../../src/data/repositories/SupabaseUserRepository';
import { DocLoveHelper } from '../../src/app/services/doc-love-helper';
import { UserAIProfileEmbeddingService } from '../../src/app/ai/profile/UserAIProfileEmbeddingService';
import { AIConfig } from '../../src/app/ai/ai-settings';

// ============================================================================
// CONFIGURACIÓN: El ID de usuario se pasa como parámetro de línea de comandos
// ============================================================================
// Ejemplo de uso: npx tsx scripts/working/extract-chat-from-zip.ts 8e1139a4-e3ec-4e4c-964b-a98ad5417f71

const BUCKET_NAME = 'external_chats';
const TARGET_FILE_NAME = '_chat.txt';

// Opciones de procesamiento
// Estados que se procesarán: 'uploaded', 'processing', 'processed', 'error'
const PROCESSABLE_STATUSES = ['uploaded', 'processing', 'processed', 'error'];
const SHOW_CONTENT = false; // Si es false, no muestra el contenido del chat (solo confirma que lo encontró)
const SHOW_DEBUG = false; // Si es false, no muestra mensajes de debug

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
    console.error(`[ERROR] Error querying external chat files:`, error);
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

    // In Supabase Storage, folders typically don't have metadata.size
    // or have id but no size. Files have metadata with size.
    const files: string[] = [];
    const folders: string[] = [];

    for (const item of data) {
      // If it has metadata.size, it's likely a file
      // If it doesn't have size or size is undefined, it's likely a folder
      // Also check if name ends with .zip - definitely a file
      if (item.metadata?.size !== undefined || item.name.includes('.')) {
        files.push(item.name);
      } else {
        folders.push(item.name);
      }
    }

    return { files, folders };
  } catch (error) {
    console.error(`[ERROR] Error listing items in ${path}:`, error);
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
    
    // Try to list the folder
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
    if (SHOW_DEBUG) {
      console.log(`[DEBUG] Attempting to download: ${BUCKET_NAME}/${filePath}`);
    }
    
    // First check if file exists and get diagnostic info
    const fileCheck = await checkFileExists(client, filePath);
    if (!fileCheck.exists) {
      const errorMsg = `File does not exist in Storage: ${filePath}. ${fileCheck.reason || 'Unknown reason'}`;
      console.error(`[ERROR] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .download(filePath);

    if (error) {
      // Log full error object for debugging
      if (SHOW_DEBUG) {
        console.error(`[DEBUG] Supabase Storage error:`, JSON.stringify(error, null, 2));
      }
      
      // Try to extract meaningful error message from originalError
      let errorMessage = error.message || 'Unknown error';
      
      if ((error as any).originalError) {
        const originalError = (error as any).originalError;
        if (typeof originalError === 'object' && Object.keys(originalError).length > 0) {
          errorMessage = JSON.stringify(originalError);
        } else if (typeof originalError === 'string') {
          errorMessage = originalError;
        }
      }
      
      // Common error scenarios
      if (error.name === 'StorageUnknownError') {
        errorMessage = `File not found or access denied. Path: ${filePath}`;
      }
      
      throw new Error(`Failed to download file: ${errorMessage}`);
    }

    if (!data) {
      throw new Error('No data returned from download');
    }

    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`[ERROR] Error downloading file ${filePath}:`, error);
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

    // Search for _chat.txt file
    const chatEntry = zipEntries.find(
      (entry) => entry.entryName === TARGET_FILE_NAME || entry.entryName.endsWith(`/${TARGET_FILE_NAME}`)
    );

    if (!chatEntry) {
      return null;
    }

    // Extract file content
    const content = zip.readAsText(chatEntry, 'utf8');
    return content;
  } catch (error) {
    console.error(`[ERROR] Error extracting from ZIP ${zipPath}:`, error);
    throw error;
  }
}

/**
 * Parses chat text (WhatsApp format) to extract messages with timestamps
 * Format: [DD/MM/YY, HH:MM] Nombre: mensaje
 */
function parseChatText(chatText: string): Array<{ role: 'user'; content: string; timestamp: Date; senderName?: string }> {
  const messages: Array<{ role: 'user'; content: string; timestamp: Date; senderName?: string }> = [];
  
  // Split by lines and process each line
  const lines = chatText.split('\n').filter(line => line.trim().length > 0);
  
  for (const line of lines) {
    // Match format: [DD/MM/YY, HH:MM] Nombre: mensaje
    // Also supports [DD/MM/YY, HH:MM:SS] format
    const match = line.match(/^\[(\d+)\/(\d+)\/(\d+),\s*(\d+):(\d+)(?::(\d+))?\]\s*(.+?):\s*(.+)$/);
    
    if (match) {
      const [, day, month, year, hours, minutes, seconds, senderName, content] = match;
      
      // Parse timestamp
      const fullYear = 2000 + parseInt(year, 10);
      const timestamp = new Date(
        fullYear,
        parseInt(month, 10) - 1, // Month is 0-indexed
        parseInt(day, 10),
        parseInt(hours, 10),
        parseInt(minutes, 10),
        seconds ? parseInt(seconds, 10) : 0
      );
      
      // Preserve sender name for MAIN marking in prompt
      // Include all messages (from all participants) so LLM has full context
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
 */
function transformChatTextToSummarizerRequest(
  chatText: string,
  user: { name?: string; bio?: string; birthDate?: string },
  source: string = 'WhatsApp'
): SummarizerRequest {
  const messages = parseChatText(chatText);
  
  // Calculate age from birthDate if available
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

/**
 * Merges two summaries using LLM (similar to GenerateUserProfileFromChats.mergeSummaries)
 */
async function mergeSummaries(
  consolidatedSummary: string,
  incrementalSummary: string,
  baseUrl: string,
  timeout: number,
  mergeParams: any,
  model: string
): Promise<string> {
  // Build merge prompt using centralized configuration
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
            // Ignore JSON parse errors for incomplete chunks
            if (!(parseError instanceof SyntaxError)) {
              console.warn('[WARN] Error parsing chunk:', parseError);
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

/**
 * Processes chat content: generates summary, merges if needed, and generates embedding
 */
async function processChatContent(
  chatContent: string,
  userId: string,
  summarizerModel: SummarizerModel,
  userAIProfileRepository: SupabaseUserAIProfileRepository,
  userRepository: SupabaseUserRepository,
  embeddingService: UserAIProfileEmbeddingService,
  config: { url: string; serviceRoleKey: string }
): Promise<void> {
  console.log(`[PROCESSING] Processing chat content for user profile...`);
  
  // Get user information
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
  
  // Transform chat text to SummarizerRequest format
  const summarizerRequest = transformChatTextToSummarizerRequest(
    chatContent,
    userData,
    'WhatsApp'
  );
  
  // Generate incremental summary
  console.log(`[LLM] Generating incremental summary from chat content...`);
  const summaryResponse = await summarizerModel.generateSummary(summarizerRequest);
  
  // Save incremental summary
  console.log(`[SAVE] Saving incremental summary...`);
  const upsertResult = await userAIProfileRepository.upsert({
    userId,
    summaryIncremental: summaryResponse.summary,
    summaryEmbedding: null,
  });
  
  if (!upsertResult.success) {
    throw new Error(`Failed to save incremental summary: ${upsertResult.error.message}`);
  }
  
  // Get profile after saving incremental
  const profileAfterIncremental = upsertResult.data;
  const consolidatedSummary = profileAfterIncremental.summary;
  const incrementalSummary = profileAfterIncremental.summaryIncremental;
  
  // Merge summaries if consolidated summary exists
  if (consolidatedSummary && incrementalSummary) {
    console.log(`[MERGE] Merging consolidated summary with incremental summary...`);
    
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
      
      // Save merged summary and clear incremental
      console.log(`[SAVE] Saving merged summary and clearing incremental...`);
      const finalUpsertResult = await userAIProfileRepository.upsert({
        userId,
        summary: mergedSummary,
        summaryIncremental: null,
        summaryEmbedding: null,
      });
      
      if (!finalUpsertResult.success) {
        throw new Error(`Failed to save merged summary: ${finalUpsertResult.error.message}`);
      }
      
      console.log(`[SUCCESS] Summaries merged successfully`);
    } catch (error) {
      console.error(`[ERROR] Failed to merge summaries:`, error);
      throw error;
    }
  } else if (!consolidatedSummary && incrementalSummary) {
    // First time - copy incremental to summary and clear incremental
    console.log(`[FIRST_TIME] Copying incremental to summary (first time)...`);
    const firstTimeUpsertResult = await userAIProfileRepository.upsert({
      userId,
      summary: incrementalSummary,
      summaryIncremental: null,
      summaryEmbedding: null,
    });
    
    if (!firstTimeUpsertResult.success) {
      throw new Error(`Failed to save first-time summary: ${firstTimeUpsertResult.error.message}`);
    }
    
    console.log(`[SUCCESS] Profile initialized successfully`);
  }
  
  // Generate embedding from the final summary
  console.log(`[EMBEDDING] Generating embedding from summary...`);
  try {
    await embeddingService.generateEmbeddingFromSummary(userId);
    console.log(`[SUCCESS] Embedding generated successfully`);
  } catch (embeddingError) {
    console.warn(`[WARN] Failed to generate embedding:`, 
      embeddingError instanceof Error ? embeddingError.message : String(embeddingError));
    // Don't fail the whole process if embedding fails
  }
}

/**
 * Main function to process user's ZIP files
 */
async function main() {
  // Get user ID from command line arguments
  const userIdArg = process.argv[2];
  
  if (!userIdArg) {
    console.error('[ERROR] User ID is required as a command line argument.');
    console.error('');
    console.error('Usage:');
    console.error('  npx tsx scripts/working/extract-chat-from-zip.ts <USER_ID>');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx scripts/working/extract-chat-from-zip.ts 8e1139a4-e3ec-4e4c-964b-a98ad5417f71');
    process.exit(1);
  }

  const USER_ID = userIdArg.trim();
  
  // Validate UUID format (basic check)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(USER_ID)) {
    console.error(`[ERROR] Invalid UUID format: ${USER_ID}`);
    console.error('Please provide a valid UUID (e.g., 8e1139a4-e3ec-4e4c-964b-a98ad5417f71)');
    process.exit(1);
  }

  const startTime = Date.now();
  console.log(`[START] [${new Date().toISOString()}] Starting ZIP extraction for user: ${USER_ID}\n`);

  try {
    // Initialize services
    const externalChatFilesService = new ExternalChatFilesService();
    const config = {
      url: process.env.SUPABASE_URL!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    };
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    
    // Initialize repositories and services for profile processing
    const userAIProfileRepository = new SupabaseUserAIProfileRepository(config);
    const userRepository = new SupabaseUserRepository(config);
    const docLoveHelper = new DocLoveHelper(config);
    
    // Initialize logger
    const logger = {
      debug: (...args: any[]) => {
        if (SHOW_DEBUG) {
          const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ');
          console.log(`[DEBUG] ${message}`);
        }
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
    
    // Initialize AI models
    const summarizerModel = createSummarizerModel(logger);
    const embeddingModel = createEmbeddingModel(logger);
    const embeddingService = new UserAIProfileEmbeddingService(
      embeddingModel,
      userAIProfileRepository,
      logger
    );

    // Step 1: List folders/UUIDs that actually exist in Storage
    console.log(`[INFO] Listing folders in Storage for user: ${USER_ID}`);
    const { folders: storageFolders, files: storageFiles } = await listItems(client, USER_ID);
    
    console.log(`\n[STORAGE] Found ${storageFolders.length} folder(s) in Storage:`);
    if (storageFolders.length > 0) {
      storageFolders.forEach((folder, index) => {
        console.log(`  ${index + 1}. ${folder}`);
      });
    } else {
      console.log(`  (No folders found)`);
    }
    
    if (storageFiles.length > 0) {
      console.log(`[STORAGE] Found ${storageFiles.length} file(s) directly in user folder:`);
      storageFiles.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file}`);
      });
    }
    console.log();

    // Step 2: Get all external chat files for the user from database
    console.log(`[INFO] Querying external chat files for user: ${USER_ID}`);
    const chatFiles = await getUserChatFiles(client, USER_ID);
    
    console.log(`\n[DATABASE] Found ${chatFiles.length} file record(s) in database:`);
    const dbUuids = new Set<string>();
    chatFiles.forEach((file, index) => {
      const pathParts = file.filePath.split('/');
      const uuid = pathParts.length >= 2 ? pathParts[1] : 'unknown';
      dbUuids.add(uuid);
      console.log(`  ${index + 1}. UUID: ${uuid} | Status: ${file.status} | Path: ${file.filePath}`);
    });
    console.log();

    // Step 3: Compare Storage vs Database
    console.log(`[COMPARISON] Storage vs Database:`);
    const storageUuids = new Set(storageFolders);
    const onlyInStorage = [...storageUuids].filter(uuid => !dbUuids.has(uuid));
    const onlyInDatabase = [...dbUuids].filter(uuid => !storageUuids.has(uuid));
    const inBoth = [...storageUuids].filter(uuid => dbUuids.has(uuid));

    if (onlyInStorage.length > 0) {
      console.log(`  ⚠️  UUIDs in Storage but NOT in database (${onlyInStorage.length}):`);
      onlyInStorage.forEach(uuid => console.log(`     - ${uuid}`));
    }
    
    if (onlyInDatabase.length > 0) {
      console.log(`  ❌ UUIDs in database but NOT in Storage (${onlyInDatabase.length}):`);
      onlyInDatabase.forEach(uuid => {
        const file = chatFiles.find(f => f.filePath.includes(uuid));
        console.log(`     - ${uuid} | Status: ${file?.status || 'unknown'} | ID: ${file?.id || 'unknown'}`);
        if (file?.errorMessage) {
          console.log(`       Previous error: ${file.errorMessage.substring(0, 150)}...`);
        }
      });
    }
    
    if (inBoth.length > 0) {
      console.log(`  ✅ UUIDs in both Storage and database (${inBoth.length}):`);
      inBoth.forEach(uuid => console.log(`     - ${uuid}`));
    }
    console.log();

    if (chatFiles.length === 0) {
      console.log(`[INFO] No external chat files found for user ${USER_ID}`);
      return;
    }

    // Step 4: Filter files to process (only files with processable statuses)
    const filesToProcess = chatFiles.filter(file => PROCESSABLE_STATUSES.includes(file.status));

    if (filesToProcess.length === 0) {
      console.log(`[INFO] No files to process. Only files with statuses [${PROCESSABLE_STATUSES.join(', ')}] are processed.`);
      console.log(`[INFO] Files by status:`);
      const statusCounts = chatFiles.reduce((acc, file) => {
        acc[file.status] = (acc[file.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  - ${status}: ${count}`);
      });
      return;
    }

    console.log(`\n[PROCESSING] Will process ${filesToProcess.length} file(s) with statuses [${PROCESSABLE_STATUSES.join(', ')}]`);
    console.log();

    // Step 5: Process each ZIP file
    let processedCount = 0;      // Files successfully processed in this run
    let foundCount = 0;          // Files with _chat.txt found
    let errorCount = 0;          // Files that failed during processing

    for (const chatFile of filesToProcess) {
      console.log(`\n[PROCESSING] File: ${chatFile.filePath}`);
      console.log(`[INFO] Status: ${chatFile.status}`);
      console.log(`[INFO] File ID: ${chatFile.id}`);
      console.log('─'.repeat(60));

      try {
        // Update status to processing
        if (chatFile.status !== 'processing') {
          await externalChatFilesService.updateStatus(chatFile.id, 'processing');
          console.log(`[INFO] Updated status to 'processing'`);
        }

        // Download ZIP file
        const zipBuffer = await downloadFile(client, chatFile.filePath);
        console.log(`  ✅ Downloaded (${Math.round(zipBuffer.length / 1024)}KB)`);

        // Extract _chat.txt
        const chatContent = extractChatFromZip(zipBuffer, chatFile.filePath);

        if (chatContent === null) {
          console.log(`  ⚠️  No ${TARGET_FILE_NAME} found in this ZIP`);
          await externalChatFilesService.updateStatus(
            chatFile.id,
            'error',
            `No ${TARGET_FILE_NAME} found in ZIP`
          );
          errorCount++;
          continue;
        }

        // Show content only if configured
        if (SHOW_CONTENT) {
          console.log(`\n  📄 Content of ${TARGET_FILE_NAME}:`);
          console.log('  ' + '═'.repeat(58));
          console.log(chatContent);
          console.log('  ' + '═'.repeat(58));
        } else {
          // Just confirm that content was found and read
          const contentLength = chatContent.length;
          const lineCount = chatContent.split('\n').length;
          console.log(`  ✅ Found ${TARGET_FILE_NAME} (${contentLength} characters, ${lineCount} lines)`);
        }

        // Process chat content: generate summary, merge if needed, and generate embedding
        console.log(`[PROCESSING] Processing chat content for user profile...`);
        await processChatContent(
          chatContent,
          USER_ID,
          summarizerModel,
          userAIProfileRepository,
          userRepository,
          embeddingService,
          config
        );
        console.log(`[SUCCESS] Chat content processed successfully`);

        // Update status to processed
        await externalChatFilesService.updateStatus(chatFile.id, 'processed');
        console.log(`[INFO] Updated status to 'processed'`);

        // TODO: Delete ZIP file and folder from Storage after successful processing
        // Uncomment the following code when ready to enable automatic cleanup:
        /*
        try {
          // Extract folder path: {userId}/{uuid}/
          const pathParts = chatFile.filePath.split('/');
          const folderPath = pathParts.slice(0, -1).join('/'); // {userId}/{uuid}
          
          // List all files in the folder to delete them all
          const { data: folderFiles, error: listError } = await client.storage
            .from(BUCKET_NAME)
            .list(folderPath);
          
          if (!listError && folderFiles && folderFiles.length > 0) {
            // Delete all files in the folder
            const filesToDelete = folderFiles
              .filter(item => item.metadata?.size !== undefined) // Only actual files
              .map(item => `${folderPath}/${item.name}`);
            
            if (filesToDelete.length > 0) {
              const { error: deleteError } = await client.storage
                .from(BUCKET_NAME)
                .remove(filesToDelete);
              
              if (deleteError) {
                console.warn(`  ⚠️  Failed to delete files from Storage: ${deleteError.message}`);
              } else {
                console.log(`  🗑️  Deleted ${filesToDelete.length} file(s) from Storage folder: ${folderPath}`);
                // Note: The folder will be automatically removed by Supabase when empty
              }
            }
          }
        } catch (deleteErr) {
          console.warn(`  ⚠️  Error deleting files from Storage:`, deleteErr);
          // Don't fail the whole process if deletion fails
        }
        */

        foundCount++;
        processedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  ❌ Error processing file ${chatFile.filePath}`);
        console.error(`     Reason: ${errorMessage}`);
        
        // Provide helpful context for common errors
        if (errorMessage.includes('does not exist') || errorMessage.includes('not found') || errorMessage.includes('File not found')) {
          console.error(`     💡 Possible causes:`);
          console.error(`        - File was deleted from Storage but record still exists in database`);
          console.error(`        - Upload failed but was registered in database anyway`);
          console.error(`        - File path mismatch between database and Storage`);
          console.error(`     💡 Solution: Check Storage manually or clean up database record`);
        } else if (errorMessage.includes('access denied') || errorMessage.includes('permission')) {
          console.error(`     💡 Possible causes:`);
          console.error(`        - Insufficient permissions on bucket '${BUCKET_NAME}'`);
          console.error(`        - SERVICE_ROLE_KEY doesn't have read access`);
        }
        
        // Update status to error
        try {
          await externalChatFilesService.updateStatus(
            chatFile.id,
            'error',
            errorMessage.substring(0, 500) // Limit error message length
          );
        } catch (updateError) {
          console.error(`  ⚠️  Failed to update status to error:`, updateError);
        }
        
        errorCount++;
      }
    }

    // Summary
    const endTime = Date.now();
    const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '═'.repeat(60));
    console.log('[SUMMARY] Extraction completed');
    console.log('═'.repeat(60));
    console.log(`[INFO] Total files in database: ${chatFiles.length}`);
    console.log(`[INFO] Files with processable statuses [${PROCESSABLE_STATUSES.join(', ')}]: ${filesToProcess.length}`);
    console.log(`[OK] ZIP files with ${TARGET_FILE_NAME} found: ${foundCount}`);
    console.log(`[OK] Successfully processed in this run: ${processedCount}`);
    console.log(`[ERROR] Failed during processing: ${errorCount}`);
    console.log(`[TIME] Total execution time: ${elapsedSeconds} seconds`);
    console.log('═'.repeat(60));

    if (errorCount > 0) {
      console.log(`\n[WARN] Completed with ${errorCount} error(s). Check logs above for details.`);
      process.exit(1);
    } else {
      console.log('\n[OK] Script completed successfully!');
    }
  } catch (error) {
    const endTime = Date.now();
    const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
    
    console.error('\n[ERROR] Fatal error in script execution:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    } else {
      console.error(`   Unknown error: ${JSON.stringify(error)}`);
    }
    console.error(`\n[TIME] Script failed after ${elapsedSeconds} seconds`);
    process.exit(1);
  }
}

// Run the script
main();

