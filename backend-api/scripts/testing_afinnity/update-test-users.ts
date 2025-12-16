/**
 * Script to update test users with new biographies from bios2 directory
 * 
 * This script updates existing test users by:
 * 1. Reading biography files from the "bios2" directory
 * 2. Mapping each file to the correct user (based on alphabetical order from bios directory)
 * 3. Creating messages in Doc Love chat with the new biography
 * 4. Generating incremental summary using GenerateUserProfileFromChats (createNew prompt)
 * 5. Merging incremental summary with existing consolidated summary using mergeSummaries prompt
 * 6. Updating the consolidated summary and clearing incremental
 * 7. Generating new embedding from the updated summary
 * 
 * Usage:
 *   npx tsx scripts/testing_afinnity/update-test-users.ts --gender <male|female|non_binary>
 * 
 * Parameters:
 *   --gender <gender>       Gender of users: male, female, or non_binary (required)
 * 
 * The script will read all .txt files from the "bios2" directory (same directory as this script).
 * Each file should be named like "ana2.txt", "paula2.txt", etc., matching the original names from "bios".
 * The script maps files to users based on alphabetical order:
 * - ana2.txt → testia1
 * - clara2.txt → testia2
 * - irene2.txt → testia3
 * - laura2.txt → testia4
 * - marta2.txt → testia5
 * - nuria2.txt → testia6
 * - paula2.txt → testia7
 * - sofia2.txt → testia8
 * 
 * Examples:
 *   npx tsx scripts/testing_afinnity/update-test-users.ts --gender female
 * 
 * Environment variables required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { AIConfig } from '../../src/app/ai/ai-settings';
import { DocLoveHelper } from '../../src/app/services/doc-love-helper';
import { SupabaseMatchRepository } from '../../src/data/repositories/SupabaseMatchRepository';
import { SupabaseMessageRepository } from '../../src/data/repositories/SupabaseMessageRepository';
import { SupabaseUserRepository } from '../../src/data/repositories/SupabaseUserRepository';
import { SupabaseUserAIProfileRepository } from '../../src/data/repositories/SupabaseUserAIProfileRepository';
import { GetAllUserChats } from '../../src/domain/use-cases/chat/GetAllUserChats';
import { GetUnprocessedMessages } from '../../src/domain/use-cases/chat/GetUnprocessedMessages';
import { GenerateUserProfileFromChats } from '../../src/domain/use-cases/chat/GenerateUserProfileFromChats';
import { createSummarizerModel, createEmbeddingModel } from '../../src/app/ai/core/config';
import { UserAIProfileEmbeddingService } from '../../src/app/ai/profile/UserAIProfileEmbeddingService';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Reads all .txt files from the bios2 directory
 * Returns an array of file paths sorted alphabetically
 */
function readBiographyFilesFromBios2(): string[] {
  const bios2Dir = path.join(__dirname, 'bios2');
  
  if (!fs.existsSync(bios2Dir)) {
    throw new Error(`Bios2 directory not found: ${bios2Dir}`);
  }

  const files = fs.readdirSync(bios2Dir)
    .filter(file => file.endsWith('.txt'))
    .map(file => path.join(bios2Dir, file))
    .sort(); // Sort alphabetically for consistent order

  if (files.length === 0) {
    throw new Error(`No .txt files found in bios2 directory: ${bios2Dir}`);
  }

  return files;
}

/**
 * Reads the content of a biography file
 */
function readBiographyFile(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8').trim();
  if (!content) {
    throw new Error(`Biography file is empty: ${filePath}`);
  }
  return content;
}

/**
 * Extracts the base name from a file path (e.g., "paula2.txt" -> "paula")
 */
function extractBaseName(filePath: string): string {
  const fileName = path.basename(filePath, '.txt');
  // Remove trailing "2" if present (e.g., "paula2" -> "paula")
  return fileName.replace(/2$/, '');
}

/**
 * Gets or creates a match/chat between user and Doc Love
 */
async function getOrCreateDocLoveMatch(
  matchRepository: SupabaseMatchRepository,
  userId: string,
  docLoveId: string
): Promise<string> {
  const matchResult = await matchRepository.create({
    userId1: userId,
    userId2: docLoveId,
  });

  if (!matchResult.success) {
    throw new Error(
      `Failed to get or create match: ${matchResult.error.message}`
    );
  }

  return matchResult.data.id;
}

/**
 * Splits biography into messages and saves them to chat
 * Simulates a natural conversation by splitting into multiple messages
 */
async function saveBiographyAsChatMessages(
  messageRepository: SupabaseMessageRepository,
  chatId: string,
  userId: string,
  biography: string
): Promise<void> {
  // Split biography into sentences
  const sentences = biography
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10); // Filter out very short sentences

  if (sentences.length === 0) {
    // If no sentences found, save as a single message
    const result = await messageRepository.create({
      matchId: chatId,
      senderId: userId,
      content: biography,
    });

    if (!result.success) {
      throw new Error(`Failed to save message: ${result.error.message}`);
    }
    return;
  }

  // Group sentences into messages (2-3 sentences per message)
  const messages: string[] = [];
  let currentMessage = '';

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    
    if (currentMessage.length + sentence.length < 200 && i < sentences.length - 1) {
      // Add sentence to current message
      currentMessage += (currentMessage ? ' ' : '') + sentence + '.';
    } else {
      // Save current message and start new one
      if (currentMessage) {
        messages.push(currentMessage);
      }
      currentMessage = sentence + '.';
    }
  }

  // Add last message if exists
  if (currentMessage) {
    messages.push(currentMessage);
  }

  // If we only have one message, save it directly
  if (messages.length === 1) {
    const result = await messageRepository.create({
      matchId: chatId,
      senderId: userId,
      content: messages[0],
    });

    if (!result.success) {
      throw new Error(`Failed to save message: ${result.error.message}`);
    }
    return;
  }

  // Save multiple messages with small delays to simulate conversation
  for (let i = 0; i < messages.length; i++) {
    const result = await messageRepository.create({
      matchId: chatId,
      senderId: userId,
      content: messages[i],
    });

    if (!result.success) {
      throw new Error(`Failed to save message ${i + 1}: ${result.error.message}`);
    }

    // Small delay between messages to simulate natural conversation
    if (i < messages.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

/**
 * Merges two summaries using LLM (same as in process-user-profiles-job.ts)
 */
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

/**
 * Gets user ID from email using admin API
 */
async function getUserIdFromEmail(
  adminClient: any,
  email: string
): Promise<string | null> {
  try {
    const { data, error } = await adminClient.auth.admin.listUsers();
    
    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }
    
    const user = data.users.find((u: any) => u.email === email);
    return user?.id || null;
  } catch (error) {
    throw new Error(`Failed to get user ID from email: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Executes affinity SQL query to get top 10 most similar users
 */
async function getTopAffinityUsers(
  adminClient: any,
  targetUserId: string
): Promise<Array<{
  user_id: string;
  email: string;
  cosine_distance: number;
  cosine_similarity: number;
  affinity_pct: number;
}>> {
  /**
   * Parses embedding from various formats (array, JSON string, or pgvector format)
   */
  const parseEmbedding = (embedding: any): number[] | null => {
    if (!embedding) return null;
    
    // If already an array of numbers
    if (Array.isArray(embedding)) {
      return embedding;
    }
    
    // If it's a string, try to parse as JSON
    if (typeof embedding === 'string') {
      try {
        const parsed = JSON.parse(embedding);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // Not valid JSON
      }
    }
    
    return null;
  };

  // Get target user's embedding
  const { data: profileData, error: profileError } = await adminClient
    .from('user_ai_profiles')
    .select('summary_embedding')
    .eq('user_id', targetUserId)
    .single();

  if (profileError) {
    console.error(`   [DEBUG] Error fetching target user profile:`, profileError);
    throw new Error(`Target user ${targetUserId} not found or has no embedding: ${profileError.message}`);
  }

  const targetEmbeddingArray = parseEmbedding(profileData?.summary_embedding);
  if (!targetEmbeddingArray) {
    console.error(`   [DEBUG] Target user ${targetUserId} has no embedding or could not parse it`);
    throw new Error(`Target user ${targetUserId} not found or has no embedding`);
  }

  console.log(`   [DEBUG] Target user embedding dimension: ${targetEmbeddingArray.length}`);

  // Get all users with embeddings (excluding target)
  const { data: allProfiles, error: profilesError } = await adminClient
    .from('user_ai_profiles')
    .select(`
      user_id,
      summary_embedding
    `)
    .neq('user_id', targetUserId)
    .not('summary_embedding', 'is', null);

  if (profilesError) {
    throw new Error(`Failed to get user profiles: ${profilesError.message}`);
  }

  console.log(`   [DEBUG] Found ${(allProfiles || []).length} users with embeddings (excluding target)`);

  // Get emails for all users from auth.users using Admin API
  const userIds = (allProfiles || []).map((p: any) => p.user_id);
  const emailMap = new Map<string, string>();

  // Fetch emails from auth.users using Admin API
  for (const userId of userIds) {
    try {
      const { data, error } = await adminClient.auth.admin.getUserById(userId);
      if (error || !data?.user) {
        console.warn(`Failed to get email for user ${userId}:`, error?.message || 'User not found');
        emailMap.set(userId, 'unknown');
        continue;
      }
      emailMap.set(userId, data.user.email || 'unknown');
    } catch (error) {
      console.warn(`Error fetching email for user ${userId}:`, error);
      emailMap.set(userId, 'unknown');
    }
  }

  // Calculate cosine distances manually
  const targetEmbedding = targetEmbeddingArray;
  const resultsWithDistance: Array<{
    user_id: string;
    email: string;
    cosine_distance: number;
    cosine_similarity: number;
    affinity_pct: number;
  }> = [];

  for (const r of (allProfiles || [])) {
    const embedding = parseEmbedding(r.summary_embedding);
    if (!embedding) {
      console.warn(`   [DEBUG] Skipping user ${r.user_id}: embedding could not be parsed (type: ${typeof r.summary_embedding})`);
      continue;
    }
    
    // Validate embedding dimensions
    if (targetEmbedding.length !== embedding.length) {
      console.warn(`   [DEBUG] Skipping user ${r.user_id}: dimension mismatch (target: ${targetEmbedding.length}, user: ${embedding.length})`);
      continue;
    }
    
    // Calculate cosine distance
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < targetEmbedding.length; i++) {
      dotProduct += targetEmbedding[i] * embedding[i];
      normA += targetEmbedding[i] * targetEmbedding[i];
      normB += embedding[i] * embedding[i];
    }
    
    const normProduct = Math.sqrt(normA) * Math.sqrt(normB);
    if (normProduct === 0) {
      console.warn(`   [DEBUG] Skipping user ${r.user_id}: zero norm (empty embedding)`);
      continue;
    }
    
    const cosineSimilarity = dotProduct / normProduct;
    const cosineDistance = 1 - cosineSimilarity;
    const affinityPct = ((1 - cosineDistance) * 100.0);
    
    resultsWithDistance.push({
      user_id: r.user_id,
      email: emailMap.get(r.user_id) || 'unknown',
      cosine_distance: cosineDistance,
      cosine_similarity: cosineSimilarity,
      affinity_pct: affinityPct,
    });
  }

  console.log(`   [DEBUG] Calculated distances for ${resultsWithDistance.length} users`);

  return resultsWithDistance
    .sort((a, b) => a.cosine_distance - b.cosine_distance)
    .slice(0, 10);
}

/**
 * Formats timestamp to "[DD/MM/YY, HH:MM:SS]" format (same as GetAllUserChats)
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const day = date.getDate();
  const month = date.getMonth() + 1; // getMonth() returns 0-11
  const year = date.getFullYear().toString().slice(-2); // Last 2 digits
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');

  return `[${day}/${month}/${year}, ${hours}:${minutes}:${seconds}]`;
}

/**
 * Gets all messages written by a user
 */
async function getUserMessages(
  adminClient: any,
  messageRepository: SupabaseMessageRepository,
  userId: string,
  userRepository: SupabaseUserRepository
): Promise<Array<{ content: string; created_at: string; formatted: string }>> {
  // Get all matches for this user
  const { data: matches, error: matchError } = await adminClient
    .from('chat_participants')
    .select('chat_id')
    .eq('user_id', userId);

  if (matchError || !matches) {
    return [];
  }

  const chatIds = matches.map((m: any) => m.chat_id);
  
  // Get user name for formatting
  let userName = 'Usuario';
  const userResult = await userRepository.findById(userId);
  if (userResult.success) {
    userName = userResult.data.name;
  }
  
  // Get all messages from this user in all their chats
  const allMessages: Array<{ content: string; created_at: string; formatted: string }> = [];
  
  for (const chatId of chatIds) {
    const messagesResult = await messageRepository.findByMatchId(chatId, 1000);
    if (messagesResult.success) {
      const userMessages = messagesResult.data
        .filter((msg) => msg.senderId === userId)
        .map((msg) => {
          const timestamp = formatTimestamp(msg.createdAt);
          // Format like in GetAllUserChats: "[DD/MM/YY, HH:MM:SS] senderName: content"
          const formatted = `${timestamp} ${userName}: ${msg.content}`;
          return {
            content: msg.content,
            created_at: msg.createdAt,
            formatted: formatted,
          };
        });
      allMessages.push(...userMessages);
    }
  }

  // Sort by created_at
  return allMessages.sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

/**
 * Saves affinity analysis results to file
 */
async function saveAffinityAnalysis(
  targetUserId: string,
  sql: string,
  topUsers: Array<{
    user_id: string;
    email: string;
    cosine_distance: number;
    cosine_similarity: number;
    affinity_pct: number;
  }>,
  topUsersMessages: Map<string, Array<{ content: string; created_at: string; formatted: string }>>,
  updatedUsersNotInTop: Array<{ userId: string; name: string; email: string }>,
  updatedUsersMessages: Map<string, Array<{ content: string; created_at: string; formatted: string }>>,
  updatedUsersAffinity: Map<string, {
    user_id: string;
    email: string;
    cosine_distance: number;
    cosine_similarity: number;
    affinity_pct: number;
  }>,
  messageRepository: SupabaseMessageRepository,
  targetUserMessages: Array<{ content: string; created_at: string; formatted: string }>,
  targetUserEmail: string,
  targetUserName: string
): Promise<string> {
  const reportsDir = path.join(__dirname, 'reports');
  
  // Ensure directory exists
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filePath = path.join(reportsDir, `affinity-analysis-update-${targetUserId}-${timestamp}.txt`);

  let content = '='.repeat(80) + '\n';
  content += 'AFFINITY ANALYSIS REPORT (AFTER UPDATE)\n';
  content += '='.repeat(80) + '\n\n';
  content += `Target User ID: ${targetUserId}\n`;
  content += `Target User Name: ${targetUserName}\n`;
  content += `Target User Email: ${targetUserEmail}\n`;
  content += `Generated at: ${new Date().toISOString()}\n\n`;

  // Target User Messages (at the beginning)
  content += '='.repeat(80) + '\n';
  content += 'TARGET USER MESSAGES\n';
  content += '='.repeat(80) + '\n\n';
  if (targetUserMessages.length === 0) {
    content += '(No messages found)\n\n';
  } else {
    content += `Messages (${targetUserMessages.length}):\n`;
    targetUserMessages.forEach((msg) => {
      content += `   ${msg.formatted}\n`;
    });
    content += '\n';
  }
  content += '-'.repeat(80) + '\n\n';

  // SQL Query
  content += '='.repeat(80) + '\n';
  content += 'SQL QUERY EXECUTED\n';
  content += '='.repeat(80) + '\n\n';
  content += sql + '\n\n';

  // SQL Results (table format)
  content += 'SQL QUERY RESULTS:\n';
  content += '-'.repeat(80) + '\n';
  if (topUsers.length > 0) {
    // Header
    content += '| user_id                              | email               | cosine_distance    | cosine_similarity | affinity_pct     |\n';
    content += '| ------------------------------------ | ------------------- | ------------------ | ----------------- | ---------------- |\n';
    // Rows
    topUsers.forEach((user) => {
      const userIdStr = user.user_id.length > 37 ? user.user_id.substring(0, 34) + '...' : user.user_id;
      const emailStr = (user.email || 'unknown').length > 19 ? (user.email || 'unknown').substring(0, 16) + '...' : (user.email || 'unknown');
      const cosineDistStr = user.cosine_distance.toFixed(17);
      const cosineSimStr = user.cosine_similarity.toFixed(17);
      const affinityStr = user.affinity_pct.toFixed(16);
      
      content += `| ${userIdStr.padEnd(37)} | ${emailStr.padEnd(19)} | ${cosineDistStr.padStart(18)} | ${cosineSimStr.padStart(17)} | ${affinityStr.padStart(16)} |\n`;
    });
  } else {
    content += '(No results found)\n';
  }
  content += '-'.repeat(80) + '\n\n';

  // Top 10 Results
  content += '='.repeat(80) + '\n';
  content += 'TOP 10 MOST AFFINITY USERS\n';
  content += '='.repeat(80) + '\n\n';
  
  if (topUsers.length === 0) {
    content += '(No users found in top 10)\n\n';
  }
  
  topUsers.forEach((user, index) => {
    content += `${index + 1}. User ID: ${user.user_id}\n`;
    content += `   Email: ${user.email}\n`;
    content += `   Cosine Distance: ${user.cosine_distance.toFixed(6)}\n`;
    content += `   Cosine Similarity: ${user.cosine_similarity.toFixed(6)}\n`;
    content += `   Affinity %: ${user.affinity_pct.toFixed(2)}%\n\n`;
    
    const messages = topUsersMessages.get(user.user_id) || [];
    content += `   Messages (${messages.length}):\n`;
    if (messages.length === 0) {
      content += `   (No messages found)\n\n`;
    } else {
      messages.forEach((msg) => {
        // Use formatted message (same format as in GetAllUserChats: "[DD/MM/YY, HH:MM:SS] senderName: content")
        content += `   ${msg.formatted}\n`;
      });
      content += '\n';
    }
    content += '-'.repeat(80) + '\n\n';
  });

  // Updated users not in top 10
  if (updatedUsersNotInTop.length > 0) {
    content += '='.repeat(80) + '\n';
    content += 'UPDATED USERS NOT IN TOP 10\n';
    content += '='.repeat(80) + '\n\n';
    
    updatedUsersNotInTop.forEach((user) => {
      content += `User ID: ${user.userId}\n`;
      content += `Name: ${user.name}\n`;
      content += `Email: ${user.email}\n`;
      
      // Show affinity metrics if available
      const affinity = updatedUsersAffinity.get(user.userId);
      if (affinity) {
        content += `Cosine Distance: ${affinity.cosine_distance.toFixed(6)}\n`;
        content += `Cosine Similarity: ${affinity.cosine_similarity.toFixed(6)}\n`;
        content += `Affinity %: ${affinity.affinity_pct.toFixed(2)}%\n`;
      } else {
        content += `(Affinity not calculated - user may not have embedding)\n`;
      }
      content += '\n';
      
      const messages = updatedUsersMessages.get(user.userId) || [];
      content += `Messages (${messages.length}):\n`;
      if (messages.length === 0) {
        content += `(No messages found)\n\n`;
      } else {
        messages.forEach((msg) => {
          // Use formatted message (same format as in GetAllUserChats: "[DD/MM/YY, HH:MM:SS] senderName: content")
          content += `   ${msg.formatted}\n`;
        });
        content += '\n';
      }
      content += '-'.repeat(80) + '\n\n';
    });
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Parses command line arguments
 */
function parseArguments(): {
  gender: 'male' | 'female' | 'non_binary';
} {
  const args = process.argv.slice(2);
  let gender: 'male' | 'female' | 'non_binary' | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--gender' && i + 1 < args.length) {
      const genderValue = args[i + 1].toLowerCase();
      if (genderValue === 'male' || genderValue === 'female' || genderValue === 'non_binary') {
        gender = genderValue;
      } else {
        throw new Error(`Invalid gender: ${genderValue}. Must be one of: male, female, non_binary`);
      }
      i++; // Skip next argument as it's the value
    }
  }

  if (gender === null) {
    throw new Error('--gender parameter is required. Must be one of: male, female, non_binary');
  }

  return { gender };
}

async function updateTestUsers() {
  const startTime = Date.now();
  console.log('🚀 Starting test users update...\n');

  // Parse command line arguments
  let gender: 'male' | 'female' | 'non_binary';
  
  try {
    const parsed = parseArguments();
    gender = parsed.gender;
  } catch (error) {
    console.error('❌ Error parsing arguments:', error instanceof Error ? error.message : error);
    console.error('\nUsage:');
    console.error('  npx tsx scripts/testing_afinnity/update-test-users.ts --gender <male|female|non_binary>');
    console.error('\nExample:');
    console.error('  npx tsx scripts/testing_afinnity/update-test-users.ts --gender female');
    process.exit(1);
  }

  // Read biography files from bios2 directory
  console.log('📂 Reading biography files from bios2 directory...');
  const biographyFiles: string[] = readBiographyFilesFromBios2();
  console.log(`✅ Found ${biographyFiles.length} biography file(s)\n`);

  // Determine prefix based on gender
  const namePrefix = gender === 'male' ? 'testio' : 'testia';

  // Initialize Supabase admin client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required'
    );
  }

  const supabaseConfig = {
    url: supabaseUrl,
    serviceRoleKey: supabaseServiceRoleKey,
  };

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Initialize services
  const docLoveHelper = new DocLoveHelper(supabaseConfig);
  const matchRepository = new SupabaseMatchRepository(supabaseConfig);
  const messageRepository = new SupabaseMessageRepository(supabaseConfig);
  const userRepository = new SupabaseUserRepository();
  const userAIProfileRepository = new SupabaseUserAIProfileRepository();

  // Initialize logger
  const logger = {
    debug: (...args: any[]) => console.log('[DEBUG]', ...args),
    info: (...args: any[]) => console.log('[INFO]', ...args),
    warn: (...args: any[]) => console.warn('[WARN]', ...args),
    error: (...args: any[]) => console.error('[ERROR]', ...args),
  };

  // Initialize use cases for profile generation
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

  // Initialize AI models
  const summarizerModel = createSummarizerModel(logger);
  const embeddingModel = createEmbeddingModel(logger);

  // Initialize profile generation use case
  const generateUserProfile = new GenerateUserProfileFromChats(
    getAllUserChats,
    userAIProfileRepository,
    userRepository,
    summarizerModel,
    docLoveHelper,
    logger
  );

  // Initialize embedding service
  const embeddingService = new UserAIProfileEmbeddingService(
    embeddingModel,
    userAIProfileRepository,
    logger
  );

  // Get Doc Love user ID
  console.log('📧 Getting Doc Love user ID...');
  const docLoveId = await docLoveHelper.getDocLoveUserId();
  console.log(`✅ Doc Love ID: ${docLoveId}\n`);

  // Get merge configuration
  const baseUrl = AIConfig.ollama.baseUrl;
  const timeout = AIConfig.ollama.summarizationTimeout;
  const mergeParams = AIConfig.ollama.mergeParameters;
  const model = AIConfig.ollama.profileMergeResumesModel;

  const results: Array<{
    fileName: string;
    userName: string;
    email: string;
    userId: string | null;
    success: boolean;
    error?: string;
    durationMs?: number;
  }> = [];

  // Process each biography file
  for (let i = 0; i < biographyFiles.length; i++) {
    const filePath = biographyFiles[i];
    const fileName = path.basename(filePath);
    const baseName = extractBaseName(filePath);
    
    // Map to user number based on alphabetical order (same as create script)
    // Files are already sorted alphabetically, so index + 1 = user number
    const userNumber = i + 1;
    const userName = `${namePrefix}${userNumber}`;
    const email = `${namePrefix}${userNumber}@example.com`;

    console.log(`[${i + 1}/${biographyFiles.length}] Processing: ${fileName} → ${userName} (${email})...`);
    const userStartTime = Date.now();

    try {
      // Step 1: Get user ID from email
      console.log(`   🔍 Looking up user ID from email...`);
      const userId = await getUserIdFromEmail(adminClient, email);
      
      if (!userId) {
        throw new Error(`User not found with email: ${email}`);
      }
      console.log(`   ✅ User ID: ${userId}`);

      // Step 2: Read biography from file
      console.log(`   📖 Reading biography from: ${fileName}...`);
      const biography = readBiographyFile(filePath);
      console.log(`   ✅ Biography read (${biography.length} chars)`);

      // Step 3: Get or create match with Doc Love
      console.log(`   💬 Getting or creating match with Doc Love...`);
      const chatId = await getOrCreateDocLoveMatch(
        matchRepository,
        userId,
        docLoveId
      );
      console.log(`   ✅ Chat ID: ${chatId}`);

      // Step 4: Save biography as chat messages
      console.log(`   📝 Saving biography as chat messages...`);
      await saveBiographyAsChatMessages(
        messageRepository,
        chatId,
        userId,
        biography
      );
      console.log(`   ✅ Biography saved as chat messages`);

      // Step 5: Generate incremental summary and merge using GenerateUserProfileFromChats
      // This use case automatically:
      // 1. Generates summary_incremental from unprocessed messages (using createNew prompt)
      // 2. If consolidated summary exists, merges them (using mergeSummaries prompt)
      // 3. Saves merged result to summary and clears summary_incremental
      console.log(`   🤖 Processing messages and generating/merging profile summary...`);
      const profileResult = await generateUserProfile.execute(userId);
      
      if (!profileResult.success) {
        throw new Error(`Failed to generate/merge profile: ${profileResult.error.message}`);
      }

      if (profileResult.data === 'No unprocessed chats to analyze') {
        throw new Error('No unprocessed chats found - messages may have been processed already or not found');
      }

      // Get the final profile after processing
      const profileAfterProcessingResult = await userAIProfileRepository.findByUserId(userId);
      if (!profileAfterProcessingResult.success) {
        throw new Error(`Failed to get profile after processing: ${profileAfterProcessingResult.error.message}`);
      }

      const finalProfile = profileAfterProcessingResult.data;
      if (!finalProfile) {
        throw new Error('Profile not found after processing');
      }

      const finalSummary = finalProfile.summary;

      if (!finalSummary) {
        throw new Error('Summary was not generated or saved');
      }

      console.log(`   ✅ Profile summary updated (${finalSummary.length} chars)`);
      
      // Note: GenerateUserProfileFromChats already handled:
      // - Generating summary_incremental from new messages
      // - Merging with existing consolidated summary (if exists)
      // - Saving merged result to summary
      // - Clearing summary_incremental

      // Step 6: Generate embedding from updated summary
      console.log(`   🔢 Generating embedding from updated summary...`);
      try {
        await embeddingService.generateEmbeddingFromSummary(userId);
        console.log(`   ✅ Embedding generated successfully`);
        
        // Small delay to ensure embedding is saved to database
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (embeddingError) {
        // Log error but don't fail - summary is already saved
        console.warn(
          `   ⚠️  Failed to generate embedding: ${
            embeddingError instanceof Error ? embeddingError.message : String(embeddingError)
          }`
        );
      }

      const userEndTime = Date.now();
      const userDurationMs = userEndTime - userStartTime;
      const userDurationSec = (userDurationMs / 1000).toFixed(2);
      console.log(`   ✨ User ${userName} updated successfully (${userDurationSec}s)\n`);
      results.push({ fileName, userName, email, userId, success: true, durationMs: userDurationMs });
    } catch (error) {
      const userEndTime = Date.now();
      const userDurationMs = userEndTime - userStartTime;
      const userDurationSec = (userDurationMs / 1000).toFixed(2);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`   ❌ Failed to update user ${userName}: ${errorMessage} (${userDurationSec}s)\n`);
      
      results.push({ fileName, userName, email, userId: null, success: false, error: errorMessage, durationMs: userDurationMs });
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n📊 Summary:');
  console.log('='.repeat(50));
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`✅ Successfully updated: ${successful}/${biographyFiles.length}`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}/${biographyFiles.length}`);
    console.log('\nFailed users:');
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  - ${r.fileName} → ${r.userName} (${r.email}): ${r.error}`);
      });
  }

  console.log('\n📝 Updated users:');
  results
    .filter((r) => r.success)
    .forEach((r) => {
      console.log(`  - ${r.fileName} → ${r.userName} (${r.email}) - ID: ${r.userId}`);
    });

  // Generate affinity analysis report (same as create-test-users.ts)
  const DEFAULT_TARGET_USER_ID = '70c0f5ab-e0dc-431c-8d62-823c79366395';
  const successfulUsers = results.filter((r) => r.success && r.userId);

  if (successfulUsers.length > 0) {
    console.log('\n📊 Generating affinity analysis report...');
    try {
      // Get top 10 affinity users
      console.log(`   📊 Executing affinity query...`);
      const topUsers = await getTopAffinityUsers(adminClient, DEFAULT_TARGET_USER_ID);
      console.log(`   ✅ Found ${topUsers.length} top affinity users`);

      // Get messages for top 10 users
      console.log(`   📝 Retrieving messages for top ${topUsers.length} users...`);
      const topUsersMessages = new Map<string, Array<{ content: string; created_at: string; formatted: string }>>();
      for (const user of topUsers) {
        const messages = await getUserMessages(adminClient as any, messageRepository, user.user_id, userRepository);
        topUsersMessages.set(user.user_id, messages);
      }

      // Calculate affinity for all updated users (even if not in top 10)
      console.log(`   📊 Calculating affinity for all updated users...`);
      const updatedUsersAffinity = new Map<string, {
        user_id: string;
        email: string;
        cosine_distance: number;
        cosine_similarity: number;
        affinity_pct: number;
      }>();

      // Get target user's embedding
      const { data: targetProfileData } = await adminClient
        .from('user_ai_profiles')
        .select('summary_embedding')
        .eq('user_id', DEFAULT_TARGET_USER_ID)
        .single();

      if (targetProfileData?.summary_embedding) {
        const parseEmbedding = (embedding: any): number[] | null => {
          if (!embedding) return null;
          if (Array.isArray(embedding)) return embedding;
          if (typeof embedding === 'string') {
            try {
              const parsed = JSON.parse(embedding);
              if (Array.isArray(parsed)) return parsed;
            } catch {}
          }
          return null;
        };

        const targetEmbedding = parseEmbedding(targetProfileData.summary_embedding);
        
        if (targetEmbedding) {
          for (const updatedUser of successfulUsers) {
            if (!updatedUser.userId) continue;

            // Get updated user's embedding
            const { data: userProfileData } = await adminClient
              .from('user_ai_profiles')
              .select('summary_embedding')
              .eq('user_id', updatedUser.userId)
              .single();

            const userEmbedding = parseEmbedding(userProfileData?.summary_embedding);
            if (userEmbedding && targetEmbedding.length === userEmbedding.length) {
              // Calculate cosine distance
              let dotProduct = 0;
              let normA = 0;
              let normB = 0;
              
              for (let i = 0; i < targetEmbedding.length; i++) {
                dotProduct += targetEmbedding[i] * userEmbedding[i];
                normA += targetEmbedding[i] * targetEmbedding[i];
                normB += userEmbedding[i] * userEmbedding[i];
              }
              
              const normProduct = Math.sqrt(normA) * Math.sqrt(normB);
              if (normProduct > 0) {
                const cosineSimilarity = dotProduct / normProduct;
                const cosineDistance = 1 - cosineSimilarity;
                const affinityPct = ((1 - cosineDistance) * 100.0);
                
                updatedUsersAffinity.set(updatedUser.userId, {
                  user_id: updatedUser.userId,
                  email: updatedUser.email,
                  cosine_distance: cosineDistance,
                  cosine_similarity: cosineSimilarity,
                  affinity_pct: affinityPct,
                });
              }
            }
          }
        }
      }

      // Find updated users not in top 10
      const topUserIds = new Set(topUsers.map((u) => u.user_id));
      const updatedUsersNotInTop = successfulUsers
        .filter((u) => u.userId && !topUserIds.has(u.userId))
        .map((u) => ({
          userId: u.userId!,
          name: u.userName,
          email: u.email,
        }));

      // Get messages for updated users not in top 10
      console.log(`   📝 Retrieving messages for ${updatedUsersNotInTop.length} updated users not in top 10...`);
      const updatedUsersMessages = new Map<string, Array<{ content: string; created_at: string; formatted: string }>>();
      for (const user of updatedUsersNotInTop) {
        const messages = await getUserMessages(adminClient as any, messageRepository, user.userId, userRepository);
        updatedUsersMessages.set(user.userId, messages);
      }

      // Generate SQL query text
      const sql = `
WITH me AS (
  SELECT summary_embedding AS e
  FROM public.user_ai_profiles
  WHERE user_id = '${DEFAULT_TARGET_USER_ID}'
)
SELECT
  p.user_id,
  u.email,
  (p.summary_embedding <=> me.e) AS cosine_distance,
  (1 - (p.summary_embedding <=> me.e)) AS cosine_similarity,
  ((1 - (p.summary_embedding <=> me.e)) * 100.0) AS affinity_pct
FROM public.user_ai_profiles p
JOIN auth.users u ON u.id = p.user_id
CROSS JOIN me
WHERE p.user_id <> '${DEFAULT_TARGET_USER_ID}'
ORDER BY cosine_distance ASC
LIMIT 10;
`;

      // Get target user messages
      console.log(`   📝 Retrieving messages for target user...`);
      const targetUserMessages = await getUserMessages(
        adminClient as any,
        messageRepository,
        DEFAULT_TARGET_USER_ID,
        userRepository
      );
      
      // Get target user info
      const targetUserResult = await userRepository.findById(DEFAULT_TARGET_USER_ID);
      const targetUserName = targetUserResult.success ? targetUserResult.data.name : 'Unknown';
      const { data: targetAuthUser } = await adminClient.auth.admin.getUserById(DEFAULT_TARGET_USER_ID);
      const targetUserEmail = targetAuthUser?.user?.email || 'unknown';

      // Save report
      console.log(`   💾 Saving affinity analysis report...`);
      const reportPath = await saveAffinityAnalysis(
        DEFAULT_TARGET_USER_ID,
        sql,
        topUsers,
        topUsersMessages,
        updatedUsersNotInTop,
        updatedUsersMessages,
        updatedUsersAffinity,
        messageRepository,
        targetUserMessages,
        targetUserEmail,
        targetUserName
      );
      console.log(`   ✅ Report saved to: ${reportPath}`);
    } catch (error) {
      console.error(`   ❌ Failed to generate affinity analysis:`, error instanceof Error ? error.message : error);
    }
  } else {
    console.log('\n⚠️  No successful users updated, skipping affinity analysis');
  }

  // Timing Summary
  const endTime = Date.now();
  const totalDurationMs = endTime - startTime;
  const totalDurationSec = (totalDurationMs / 1000).toFixed(2);
  const totalDurationMin = (totalDurationMs / 60000).toFixed(2);
  
  const userDurations = results
    .filter((r) => r.durationMs !== undefined)
    .map((r) => r.durationMs!);
  
  console.log('\n⏱️  Timing Summary:');
  console.log('='.repeat(50));
  console.log(`Total execution time: ${totalDurationSec}s (${totalDurationMin} min)`);
  
  if (userDurations.length > 0) {
    const avgDurationMs = userDurations.reduce((a, b) => a + b, 0) / userDurations.length;
    const minDurationMs = Math.min(...userDurations);
    const maxDurationMs = Math.max(...userDurations);
    const avgDurationSec = (avgDurationMs / 1000).toFixed(2);
    const minDurationSec = (minDurationMs / 1000).toFixed(2);
    const maxDurationSec = (maxDurationMs / 1000).toFixed(2);
    
    console.log(`Average time per user: ${avgDurationSec}s`);
    console.log(`Fastest user: ${minDurationSec}s`);
    console.log(`Slowest user: ${maxDurationSec}s`);
    
    console.log('\nTime per user:');
    results.forEach((r) => {
      if (r.durationMs !== undefined) {
        const durationSec = (r.durationMs / 1000).toFixed(2);
        const status = r.success ? '✅' : '❌';
        console.log(`  ${status} ${r.userName} (${r.fileName}): ${durationSec}s`);
      }
    });
  }

  console.log('\n✨ Done!');
}

// Run the script
updateTestUsers().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
