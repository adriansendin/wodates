/**
 * Script to create test users in Supabase
 * 
 * This script creates users in both auth.users and public.users tables.
 * All users are 25 years old, live in Barcelona, and have age range 18-35.
 * 
 * For each user created, the script:
 * 1. Reads biography from a .txt file in the "bios" directory
 * 2. Creates a match/chat with Doc Love
 * 3. Splits biography into messages and inserts them into the chat
 * 4. Processes unprocessed messages and generates profile summary using GenerateUserProfileFromChats
 * 5. Generates embedding from the summary using UserAIProfileEmbeddingService
 * 
 * Usage:
 *   npx tsx scripts/testing_afinnity/create-test-users.ts --gender <male|female|non_binary> [--target-user-id <uuid>]
 * 
 * Parameters:
 *   --gender <gender>       Gender of users: male, female, or non_binary (required)
 *   --target-user-id <uuid> Target user ID for affinity analysis (optional, defaults to '70c0f5ab-e0dc-431c-8d62-823c79366395')
 * 
 * The script will read all .txt files from the "bios" directory (same directory as this script).
 * Each .txt file represents one user. Users will be named testia1, testia2, etc. (or testio1, testio2 for males).
 * 
 * Examples:
 *   npx tsx scripts/testing_afinnity/create-test-users.ts --gender female
 *   npx tsx scripts/testing_afinnity/create-test-users.ts --gender male --target-user-id 27322fa5-a727-4b86-a136-83fc71c6e47c
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
import { SupabaseAuthService } from '../../src/app/services/supabase-auth-service';
import { RegisterRequest } from '../../src/domain/entities/Auth';
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
 * Reads all .txt files from the bios directory
 * Returns an array of file paths sorted alphabetically
 */
function readBiographyFiles(): string[] {
  const biosDir = path.join(__dirname, 'bios');
  
  if (!fs.existsSync(biosDir)) {
    throw new Error(`Bios directory not found: ${biosDir}`);
  }

  const files = fs.readdirSync(biosDir)
    .filter(file => file.endsWith('.txt'))
    .map(file => path.join(biosDir, file))
    .sort(); // Sort alphabetically for consistent order

  if (files.length === 0) {
    throw new Error(`No .txt files found in bios directory: ${biosDir}`);
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
 * Calls LLM to generate biography using AI_MODEL_PROFILE_CHATS_TO_RESUME
 */
async function generateBiographyWithLLM(
  baseUrl: string,
  model: string,
  gender: 'male' | 'female' | 'non_binary',
  lookingFor: 'male' | 'female' | 'both',
  birthYear: number,
  userIndex?: number // Optional index to vary seed per user
): Promise<string> {
  const genderText = 
    gender === 'female' ? 'una mujer' :
    gender === 'male' ? 'un hombre' :
    'una persona no binaria';
  
  const lookingForText = 
    lookingFor === 'male' ? 'un hombre' :
    lookingFor === 'female' ? 'una mujer' :
    'una relación';
  
  // Calculate current age from birth year
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - birthYear;
  
  const prompt = `
  Estás generando una biografía de prueba para un sistema de matching basado en afinidad semántica.
  
  CONTEXTO FIJO (NO MODIFICABLE):
  Eres ${genderText} de ${currentAge} años, nacid${gender === 'male' ? 'o' : gender === 'female' ? 'a' : 'e'} en el año ${birthYear}.
  Vives en Barcelona.
  Buscas una relación con ${lookingForText}.
  Hablas en primera persona.
  Estás escribiendo a un chatbot de citas llamado Doc Love.
  Debes mencionar explícitamente que tienes ${currentAge} años y que vives en Barcelona.
  
  OBJETIVO PRINCIPAL:
  Crear una biografía realista pero fuertemente diferenciada de otras biografías similares.
  
  INSTRUCCIÓN CRÍTICA:
  Este perfil debe ser semánticamente distinto de otros perfiles generados.
  No optimices para parecer interesante ni equilibrado.
  No escribas un perfil ideal.
  No escribas un perfil genérico.
  
  VARIACIÓN OBLIGATORIA:
  Elige y desarrolla una única combinación coherente de los siguientes ejes. No mezcles estilos.
  
  1. Trayectoria vital dominante (elige una):
  - Vida muy estructurada y rutinaria
  - Vida caótica e inestable
  - Carrera profesional muy ambiciosa
  - Prioridad absoluta al ocio
  - Enfoque familiar tradicional
  - Individualismo fuerte
  - Búsqueda introspectiva o espiritual
  - Desencanto vital o cinismo
  - Optimismo ingenuo
  - Pragmatismo frío
  
  2. Relación con el trabajo (elige una):
  - Trabajo solo por dinero
  - Trabajo como vocación
  - Trabajo que odias pero necesitas
  - Trabajo creativo precario
  - Trabajo estable sin pasión
  - Emprendimiento fallido
  - Cambio de carrera reciente
  - Desempleo actual
  
  3. Historia sentimental dominante (elige una):
  - Nunca ha tenido relación seria
  - Ruptura muy reciente
  - Ruptura antigua ya superada
  - Relación tóxica pasada
  - Viudedad temprana
  - Miedo al compromiso
  - Deseo explícito de estabilidad
  - Rechazo actual a relaciones
  
  4. Estilo emocional (elige una):
  - Muy racional
  - Muy emocional
  - Distante
  - Dependiente
  - Autónoma
  - Desconfiada
  - Idealista
  - Escéptica
  
  REGLAS DE REDACCIÓN:
  Describe rutinas concretas (horarios, lugares, hábitos reales).
  Evita listas genéricas de hobbies.
  Evita frases típicas de perfiles de apps.
  Incluye al menos una limitación personal clara.
  Incluye al menos una incompatibilidad potencial con otras personas.
  No repitas estructuras narrativas comunes.
  
  EXTENSIÓN:
  Entre 400 y 700 palabras.
  
  RECORDATORIO FINAL:
  Este texto se usará para generar embeddings.
  La diversidad semántica es más importante que parecer atractivo.
  `;
  

  const timeout = AIConfig.ollama.summarizationTimeout; // Use same timeout as summarization
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // Use different seed for each user to ensure variation
    // If userIndex is provided, use it to create a unique seed
    // Otherwise, use a random seed or undefined to allow natural variation
    const baseSeed = AIConfig.ollama.summarizerParameters.seed;
    const seed = userIndex !== undefined 
      ? (baseSeed ? baseSeed + userIndex : undefined)
      : undefined; // No seed = more variation
    
    const requestBody = {
      model: model,
      prompt: prompt,
      stream: true,
      options: {
        temperature: AIConfig.ollama.summarizerParameters.temperature,
        num_predict: AIConfig.ollama.summarizerParameters.num_predict,
        num_ctx: AIConfig.ollama.summarizerParameters.num_ctx,
        ...(seed !== undefined && { seed }), // Only include seed if defined
        top_p: AIConfig.ollama.summarizerParameters.top_p,
        top_k: AIConfig.ollama.summarizerParameters.top_k,
        repeat_penalty: AIConfig.ollama.summarizerParameters.repeat_penalty,
      },
    };

    const apiUrl = `${baseUrl}/api/generate`;

    const response = await fetch(apiUrl, {
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
            if (!(parseError instanceof SyntaxError)) {
              console.warn('Error parsing chunk:', parseError);
            }
          }
        }
      }
    } finally {
      clearTimeout(timeoutId);
      reader.releaseLock();
    }

    if (!fullResponse || fullResponse.trim().length === 0) {
      throw new Error('Ollama returned empty response');
    }

    return fullResponse.trim();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw new Error(`Failed to generate biography: ${error.message}`);
    }
    throw new Error('Failed to generate biography: Unknown error');
  }
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
 * Parses command line arguments
 */
function parseArguments(): {
  gender: 'male' | 'female' | 'non_binary';
  targetUserId?: string;
} {
  const args = process.argv.slice(2);
  let gender: 'male' | 'female' | 'non_binary' | null = null;
  let targetUserId: string | undefined = undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--gender' && i + 1 < args.length) {
      const genderValue = args[i + 1].toLowerCase();
      if (genderValue === 'male' || genderValue === 'female' || genderValue === 'non_binary') {
        gender = genderValue;
      } else {
        throw new Error(`Invalid gender: ${genderValue}. Must be one of: male, female, non_binary`);
      }
      i++; // Skip next argument as it's the value
    } else if (args[i] === '--target-user-id' && i + 1 < args.length) {
      targetUserId = args[i + 1];
      i++; // Skip next argument as it's the value
    }
  }

  if (gender === null) {
    throw new Error('--gender parameter is required. Must be one of: male, female, non_binary');
  }

  return { gender, targetUserId };
}

/**
 * Determines lookingFor based on gender
 */
function getLookingFor(gender: 'male' | 'female' | 'non_binary'): 'male' | 'female' | 'both' {
  if (gender === 'male') {
    return 'female';
  } else if (gender === 'female') {
    return 'male';
  } else {
    return 'both';
  }
}

/**
 * Calculates birth date for 25 years old
 */
function getBirthDateForAge25(): string {
  const now = new Date();
  const birthYear = now.getFullYear() - 25;
  // Use January 1st as birth date
  return new Date(birthYear, 0, 1).toISOString();
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
 * Gets all messages written by a user
 */
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
  createdUsersNotInTop: Array<{ userId: string; name: string; email: string }>,
  createdUsersMessages: Map<string, Array<{ content: string; created_at: string; formatted: string }>>,
  createdUsersAffinity: Map<string, {
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
  const filePath = path.join(reportsDir, `affinity-analysis-${targetUserId}-${timestamp}.txt`);

  let content = '='.repeat(80) + '\n';
  content += 'AFFINITY ANALYSIS REPORT\n';
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

  // Created users not in top 10
  if (createdUsersNotInTop.length > 0) {
    content += '='.repeat(80) + '\n';
    content += 'CREATED USERS NOT IN TOP 10\n';
    content += '='.repeat(80) + '\n\n';
    
    createdUsersNotInTop.forEach((user) => {
      content += `User ID: ${user.userId}\n`;
      content += `Name: ${user.name}\n`;
      content += `Email: ${user.email}\n`;
      
      // Show affinity metrics if available
      const affinity = createdUsersAffinity.get(user.userId);
      if (affinity) {
        content += `Cosine Distance: ${affinity.cosine_distance.toFixed(6)}\n`;
        content += `Cosine Similarity: ${affinity.cosine_similarity.toFixed(6)}\n`;
        content += `Affinity %: ${affinity.affinity_pct.toFixed(2)}%\n`;
      } else {
        content += `(Affinity not calculated - user may not have embedding)\n`;
      }
      content += '\n';
      
      const messages = createdUsersMessages.get(user.userId) || [];
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

async function createTestUsers() {
  console.log('🚀 Starting test users creation...\n');

  // Parse command line arguments
  let gender: 'male' | 'female' | 'non_binary';
  let targetUserId: string | undefined;
  
  try {
    const parsed = parseArguments();
    gender = parsed.gender;
    targetUserId = parsed.targetUserId;
  } catch (error) {
    console.error('❌ Error parsing arguments:', error instanceof Error ? error.message : error);
    console.error('\nUsage:');
    console.error('  npx tsx scripts/testing_afinnity/create-test-users.ts --gender <male|female|non_binary> [--target-user-id <uuid>]');
    console.error('\nExample:');
    console.error('  npx tsx scripts/testing_afinnity/create-test-users.ts --gender female');
    process.exit(1);
  }

  // Read biography files from bios directory
  console.log('📂 Reading biography files from bios directory...');
  const biographyFiles: string[] = readBiographyFiles();
  console.log(`✅ Found ${biographyFiles.length} biography file(s)\n`);

  const count = biographyFiles.length; // Number of users = number of files
  const lookingFor = getLookingFor(gender);
  const birthDate = getBirthDateForAge25();
  const birthYear = new Date(birthDate).getFullYear();

  console.log('📋 Configuration:');
  console.log(`   Number of users: ${count} (from ${biographyFiles.length} biography file(s))`);
  console.log(`   Gender: ${gender}`);
  console.log(`   Looking for: ${lookingFor}`);
  console.log(`   Age: 25 years (born in ${birthYear})`);
  console.log(`   City: Barcelona`);
  console.log(`   Age range: 18-35\n`);

  // Initialize auth service
  const authService = new SupabaseAuthService();

  // Initialize Supabase admin client for profile updates
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

  // Note: LLM is no longer used - biographies are read from files

  // Initialize services for chat creation
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

  // Fixed values for all users
  const fixedCity = 'Barcelona';
  const fixedCountry = 'Spain';
  const fixedMinAge = 18;
  const fixedMaxAge = 35;

  const users: Array<{ 
    name: string; 
    email: string; 
    userId: string | null;
    success: boolean; 
    error?: string 
  }> = [];

  // Create test users
  const startUser = 1;
  const endUser = count;
  const totalUsers = count;

  // Determine prefix based on gender
  const namePrefix = gender === 'male' ? 'testio' : 'testia';

  for (let i = startUser; i <= endUser; i++) {
    const name = `${namePrefix}${i}`;
    const email = `${namePrefix}${i}@example.com`;
    const password = 'Test123456'; // Same password for all test users

    const registerRequest: RegisterRequest = {
      email,
      password,
      name,
      birthDate: birthDate,
      gender: gender,
      location: fixedCity,
      country: fixedCountry,
      lookingFor: lookingFor,
    };

    try {
      const currentNumber = i - startUser + 1;
      console.log(`[${currentNumber}/${totalUsers}] Creating user: ${name} (${email})...`);
      
      // Step 1: Read biography from file (before creating user, to fail fast if file is missing)
      const bioFileIndex = i - startUser; // 0-based index for array access
      const biographyFilePath_source = biographyFiles[bioFileIndex];
      console.log(`   📖 Reading biography from: ${path.basename(biographyFilePath_source)}...`);
      
      let biography: string;
      try {
        biography = readBiographyFile(biographyFilePath_source);
        console.log(`   ✅ Biography read (${biography.length} chars)`);
      } catch (error) {
        throw new Error(`Failed to read biography file: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Step 2: Create user
      const authUser = await authService.registerUser(registerRequest);
      console.log(`   ✅ User created: ${authUser.name} (ID: ${authUser.id})`);
      
      // Step 3: Update profile with min_age and max_age
      const { error: updateError } = await adminClient
        .from('users')
        .update({
          min_age: fixedMinAge,
          max_age: fixedMaxAge,
        })
        .eq('id', authUser.id);

      if (updateError) {
        console.warn(
          `   ⚠️  Failed to update min_age/max_age: ${updateError.message}`
        );
      } else {
        console.log(`   ✅ Profile updated with age preferences`);
      }

      // Step 5: Get or create match with Doc Love
      console.log(`   💬 Creating match with Doc Love...`);
      const chatId = await getOrCreateDocLoveMatch(
        matchRepository,
        authUser.id,
        docLoveId
      );
      console.log(`   ✅ Chat created: ${chatId}`);

      // Step 5: Split biography into messages and save to chat
      console.log(`   📝 Saving biography as chat messages...`);
      await saveBiographyAsChatMessages(
        messageRepository,
        chatId,
        authUser.id,
        biography
      );
      console.log(`   ✅ Biography saved as chat messages`);

      // Step 7: Process messages and generate profile summary
      console.log(`   🤖 Processing messages and generating profile summary...`);
      const profileResult = await generateUserProfile.execute(authUser.id);
      
      if (!profileResult.success) {
        throw new Error(
          `Failed to generate profile: ${profileResult.error.message}`
        );
      }

      if (profileResult.data === 'No unprocessed chats to analyze') {
        console.warn(`   ⚠️  No unprocessed chats found (may have been processed already)`);
      } else {
        console.log(`   ✅ Profile summary generated`);
      }

      // Step 7: Generate embedding from summary
      console.log(`   🔢 Generating embedding from summary...`);
      try {
        await embeddingService.generateEmbeddingFromSummary(authUser.id);
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

      // Note: No need to delete files - we're reading from source files, not creating temporary ones

      console.log(`   ✨ User ${name} processed successfully\n`);
      users.push({ name, email, userId: authUser.id, success: true });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`   ❌ Failed to process user ${name}: ${errorMessage}\n`);
      
      users.push({ name, email, userId: null, success: false, error: errorMessage });
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n📊 Summary:');
  console.log('='.repeat(50));
  const successful = users.filter((u) => u.success).length;
  const failed = users.filter((u) => !u.success).length;

  console.log(`✅ Successfully created: ${successful}/${totalUsers}`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}/${totalUsers}`);
    console.log('\nFailed users:');
    users
      .filter((u) => !u.success)
      .forEach((u) => {
        console.log(`  - ${u.name} (${u.email}): ${u.error}`);
      });
  }

  console.log('\n📝 Created users:');
  users
    .filter((u) => u.success)
    .forEach((u) => {
      console.log(`  - ${u.name} (${u.email}) - ID: ${u.userId}`);
    });

  // Step 10: Affinity analysis (if target user ID is provided or use default)
  const DEFAULT_TARGET_USER_ID = '70c0f5ab-e0dc-431c-8d62-823c79366395';
  const successfulUsers = users.filter((u) => u.success && u.userId);
  if (successfulUsers.length > 0) {
    const finalTargetUserId = targetUserId || DEFAULT_TARGET_USER_ID;
    
    console.log('\n🔍 Starting affinity analysis...');
    console.log(`   Target User ID: ${finalTargetUserId}`);
    
    try {
      // Execute affinity SQL query
      console.log(`   📊 Executing affinity query...`);
      const topUsers = await getTopAffinityUsers(adminClient, finalTargetUserId);
      console.log(`   ✅ Found ${topUsers.length} top affinity users`);

      // Get messages for top 10 users
      console.log(`   📝 Retrieving messages for top ${topUsers.length} users...`);
      const topUsersMessages = new Map<string, Array<{ content: string; created_at: string; formatted: string }>>();
      for (const user of topUsers) {
        const messages = await getUserMessages(adminClient as any, messageRepository, user.user_id, userRepository);
        topUsersMessages.set(user.user_id, messages);
      }

      // Calculate affinity for all created users (even if not in top 10)
      console.log(`   📊 Calculating affinity for all created users...`);
      const createdUsersAffinity = new Map<string, {
        user_id: string;
        email: string;
        cosine_distance: number;
        cosine_similarity: number;
        affinity_pct: number;
      }>();

      // Get target user's embedding for affinity calculation
      const { data: targetProfileData } = await adminClient
        .from('user_ai_profiles')
        .select('summary_embedding')
        .eq('user_id', finalTargetUserId)
        .single();

      if (targetProfileData?.summary_embedding) {
        const targetEmbedding = targetProfileData.summary_embedding as number[];
        
        for (const createdUser of successfulUsers) {
          if (!createdUser.userId) continue;

          // Get created user's embedding
          const { data: userProfileData } = await adminClient
            .from('user_ai_profiles')
            .select('summary_embedding')
            .eq('user_id', createdUser.userId)
            .single();

          if (userProfileData?.summary_embedding && Array.isArray(userProfileData.summary_embedding)) {
            const userEmbedding = userProfileData.summary_embedding as number[];
            
            if (targetEmbedding.length === userEmbedding.length) {
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
                
                createdUsersAffinity.set(createdUser.userId, {
                  user_id: createdUser.userId,
                  email: createdUser.email,
                  cosine_distance: cosineDistance,
                  cosine_similarity: cosineSimilarity,
                  affinity_pct: affinityPct,
                });
              }
            }
          }
        }
      }

      // Find created users not in top 10
      const topUserIds = new Set(topUsers.map((u) => u.user_id));
      const createdUsersNotInTop = successfulUsers
        .filter((u) => u.userId && !topUserIds.has(u.userId))
        .map((u) => ({
          userId: u.userId!,
          name: u.name,
          email: u.email,
        }));

      // Get messages for created users not in top 10
      console.log(`   📝 Retrieving messages for ${createdUsersNotInTop.length} created users not in top 10...`);
      const createdUsersMessages = new Map<string, Array<{ content: string; created_at: string; formatted: string }>>();
      for (const user of createdUsersNotInTop) {
        const messages = await getUserMessages(adminClient as any, messageRepository, user.userId, userRepository);
        createdUsersMessages.set(user.userId, messages);
      }

      // Generate SQL query text
      const sql = `
WITH me AS (
  SELECT summary_embedding AS e
  FROM public.user_ai_profiles
  WHERE user_id = '${finalTargetUserId}'
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
WHERE p.user_id <> '${finalTargetUserId}'
ORDER BY cosine_distance ASC
LIMIT 10;
`;

      // Get target user messages
      console.log(`   📝 Retrieving messages for target user...`);
      const targetUserMessages = await getUserMessages(
        adminClient as any,
        messageRepository,
        finalTargetUserId,
        userRepository
      );
      
      // Get target user info
      const targetUserResult = await userRepository.findById(finalTargetUserId);
      const targetUserName = targetUserResult.success ? targetUserResult.data.name : 'Unknown';
      const { data: targetAuthUser } = await adminClient.auth.admin.getUserById(finalTargetUserId);
      const targetUserEmail = targetAuthUser?.user?.email || 'unknown';

      // Save report
      console.log(`   💾 Saving affinity analysis report...`);
      const reportPath = await saveAffinityAnalysis(
        finalTargetUserId,
        sql,
        topUsers,
        topUsersMessages,
        createdUsersNotInTop,
        createdUsersMessages,
        createdUsersAffinity,
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
    console.log('\n⚠️  No successful users created, skipping affinity analysis');
  }

  console.log('\n✨ Done!');
}

// Run the script
createTestUsers().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
