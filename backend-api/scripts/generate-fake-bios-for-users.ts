/// <reference types="node" />

/**
 * Script to generate fake biographies for users with null summary
 * 
 * This script:
 * 1. Finds users with user_ai_profiles.summary = NULL
 * 2. For each user, generates a fake biography using the LLM configured in AI_MODEL_PROFILE_CHATS_TO_RESUME
 * 3. Saves the biography as chat messages with Doc Love
 * 
 * Usage:
 *   npx tsx scripts/generate-fake-bios-for-users.ts
 * 
 * Environment variables required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - AI_MODEL_PROFILE_CHATS_TO_RESUME (LLM model to use)
 *   - OLLAMA_URL (default: http://localhost:11434)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { DocLoveHelper } from '../src/app/services/doc-love-helper';
import { SupabaseMatchRepository } from '../src/data/repositories/SupabaseMatchRepository';
import { SupabaseMessageRepository } from '../src/data/repositories/SupabaseMessageRepository';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

/**
 * Generates a fake biography using the LLM
 */
async function generateFakeBiography(
  baseUrl: string,
  model: string
): Promise<string> {
  // Generate random age between 25 and 45
  const age = Math.floor(Math.random() * 21) + 25;
  
  // Random hobbies pool
  const hobbies = [
    'leer libros de ciencia ficción',
    'hacer senderismo los fines de semana',
    'cocinar platos mediterráneos',
    'tocar la guitarra',
    'practicar yoga',
    'ir al cine',
    'jugar al fútbol',
    'hacer voluntariado',
    'viajar por Europa',
    'fotografía urbana',
    'bailar salsa',
    'coleccionar vinos',
    'hacer running',
    'visitar museos',
    'aprender idiomas',
  ];
  
  // Random jobs pool
  const jobs = [
    'diseñador gráfico',
    'ingeniero de software',
    'profesor de secundaria',
    'médico',
    'arquitecto',
    'psicólogo',
    'chef',
    'periodista',
    'fotógrafo',
    'consultor de marketing',
    'enfermero',
    'abogado',
    'farmacéutico',
    'veterinario',
    'economista',
  ];
  
  // Random experiences pool
  const experiences = [
    'viví un año en Londres trabajando',
    'hice un viaje de mochilero por Sudamérica',
    'estudié un máster en Madrid',
    'trabajé en una startup tecnológica',
    'participé en un voluntariado en África',
    'hice un intercambio universitario en Italia',
    'trabajé como freelance durante dos años',
    'fundé un pequeño negocio que luego vendí',
    'hice prácticas en una multinacional',
    'colaboré en un proyecto social',
  ];
  
  // Select random items
  const selectedHobbies = hobbies
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .join(', ');
  
  const selectedJob = jobs[Math.floor(Math.random() * jobs.length)];
  const selectedExperience = experiences[Math.floor(Math.random() * experiences.length)];
  
  const prompt = `Genera una biografía inventada y realista de una persona que vive en Barcelona, tiene ${age} años, trabaja como ${selectedJob}, tiene hobbies como ${selectedHobbies}, y ${selectedExperience}. 

La biografía debe ser:
- Natural y creíble, como si fuera escrita por la propia persona
- Entre 150 y 250 palabras
- En primera persona
- Incluir detalles personales sobre su vida, valores, y lo que busca en una relación
- No mencionar explícitamente que es inventada o ficticia

Responde SOLO con la biografía, sin explicaciones adicionales.`;

  const timeout = 120000; // 2 minutes timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const requestBody = {
      model: model,
      prompt: prompt,
      stream: true,
      options: {
        temperature: 0.8, // Higher temperature for more creative/random biographies
        num_predict: 500,
        top_p: 0.9,
        num_ctx: 2048,
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
  // Use create method which automatically checks if match exists and returns it
  // If it doesn't exist, it creates a new one
  const matchResult = await matchRepository.create({
    userId1: userId,
    userId2: docLoveId,
  });

  if (!matchResult.success) {
    throw new Error(
      `Failed to get or create match: ${matchResult.error.message}`
    );
  }

  if (!matchResult.data || !matchResult.data.id) {
    throw new Error('Match created but missing ID');
  }

  return matchResult.data.id;
}

/**
 * Saves biography as chat messages written by the user to Doc Love
 * Splits the biography into multiple messages to simulate a conversation
 * Messages are saved with the user as the sender (not Doc Love)
 */
async function saveBiographyAsChat(
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
    
    if (!sentence) {
      continue;
    }
    
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
    const firstMessage = messages[0];
    if (!firstMessage) {
      throw new Error('No messages to save');
    }
    
    const result = await messageRepository.create({
      matchId: chatId,
      senderId: userId,
      content: firstMessage,
    });

    if (!result.success) {
      throw new Error(`Failed to save message: ${result.error.message}`);
    }
    return;
  }

  // Save multiple messages with small delays to simulate conversation
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (!message) {
      continue;
    }
    
    const result = await messageRepository.create({
      matchId: chatId,
      senderId: userId,
      content: message,
    });

    if (!result.success) {
      throw new Error(`Failed to save message ${i + 1}: ${result.error.message}`);
    }

    // Small delay between messages (except for the last one)
    if (i < messages.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return { url, serviceRoleKey };
}

function getLLMConfig(): { baseUrl: string; model: string } {
  const baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = process.env.AI_MODEL_PROFILE_CHATS_TO_RESUME;

  if (!model) {
    throw new Error(
      'AI_MODEL_PROFILE_CHATS_TO_RESUME environment variable is required'
    );
  }

  return { baseUrl, model };
}

async function main() {
  console.log('🚀 Starting fake biography generation script...\n');

  try {
    // Get configuration
    const supabaseConfig = getSupabaseConfig();
    const llmConfig = getLLMConfig();

    console.log('📋 Configuration:');
    console.log(`   Supabase URL: ${supabaseConfig.url}`);
    console.log(`   LLM Base URL: ${llmConfig.baseUrl}`);
    console.log(`   LLM Model: ${llmConfig.model}\n`);

    // Initialize Supabase client
    const supabaseClient = createClient(
      supabaseConfig.url,
      supabaseConfig.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Initialize services
    const docLoveHelper = new DocLoveHelper(supabaseConfig);
    const matchRepository = new SupabaseMatchRepository(supabaseConfig);
    const messageRepository = new SupabaseMessageRepository(supabaseConfig);

    // Get Doc Love user ID
    console.log('📧 Getting Doc Love user ID...');
    const docLoveId = await docLoveHelper.getDocLoveUserId();
    console.log(`✅ Doc Love ID: ${docLoveId}\n`);

    // Find users with null summary
    console.log('🔍 Finding users with null summary...');
    const { data: users, error: usersError } = await supabaseClient
      .from('user_ai_profiles')
      .select('user_id')
      .is('summary', null);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    if (!users || users.length === 0) {
      console.log('✨ No users found with null summary. All done!');
      return;
    }

    console.log(`✅ Found ${users.length} users to process\n`);

    // Process users
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      if (!user || !user.user_id) {
        console.warn(`   ⚠️  Skipping user at index ${i}: missing user_id`);
        continue;
      }
      
      const userId = user.user_id;
      console.log(
        `\n[${i + 1}/${users.length}] Processing user: ${userId}`
      );

      try {
        // Generate fake biography
        console.log('   🤖 Generating fake biography...');
        const biography = await generateFakeBiography(
          llmConfig.baseUrl,
          llmConfig.model
        );
        console.log(`   ✅ Biography generated (${biography.length} chars)`);

        // Get or create match with Doc Love
        console.log('   💬 Getting or creating Doc Love match...');
        const chatId = await getOrCreateDocLoveMatch(
          matchRepository,
          userId,
          docLoveId
        );
        console.log(`   ✅ Chat ID: ${chatId}`);

        // Save biography as chat messages
        console.log('   💾 Saving biography as chat messages...');
        await saveBiographyAsChat(messageRepository, chatId, userId, biography);
        console.log('   ✅ Biography saved as chat messages');

        successCount++;
        console.log(`   ✨ User ${userId} processed successfully`);

        // Small delay between users to avoid overwhelming the system
        if (i < users.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        errorCount++;
        console.error(`   ❌ Error processing user ${userId}:`);
        if (error instanceof Error) {
          console.error(`      ${error.message}`);
        } else {
          console.error(`      Unknown error: ${error}`);
        }
      }
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Summary:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total: ${users.length}`);
    console.log('═'.repeat(60));

    if (errorCount > 0) {
      console.log(
        '\n⚠️  Some users failed to process. Check the errors above.'
      );
      process.exit(1);
    } else {
      console.log('\n✨ All users processed successfully!');
    }
  } catch (error) {
    console.error('\n❌ Script failed:');
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
