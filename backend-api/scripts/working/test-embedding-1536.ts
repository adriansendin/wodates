/**
 * Local test script for 1536-dimensional embeddings
 * 
 * This script:
 * 1. Generates an embedding for a test user using OpenAI text-embedding-3-small
 * 2. Stores it in summary_embedding (pgvector 1536)
 * 3. Runs a similarity query to find similar users
 * 
 * Usage:
 *   npx tsx scripts/working/test-embedding-1536.ts [USER_ID]
 * 
 * If USER_ID is not provided, uses the first user with a summary.
 */

import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { SupabaseUserAIProfileRepository } from '../../src/data/repositories/SupabaseUserAIProfileRepository';
import { UserAIProfileEmbeddingService } from '../../src/app/ai/profile/UserAIProfileEmbeddingService';
import { normalizeEmbedding } from '../../src/utils/embedding-utils';

// Load .env from backend-api directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../.env');
dotenv.config({ path: envPath });

const EXPECTED_DIMENSION = 1536;

function getSupabaseConfig(): { url: string; serviceRoleKey: string } {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  return { url, serviceRoleKey };
}

async function findUserWithSummary(
  client: ReturnType<typeof createClient>
): Promise<string | null> {
  const { data, error } = await client
    .from('user_ai_profiles')
    .select('user_id, summary')
    .not('summary', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to find user with summary: ${error.message}`);
  }

  return data?.user_id || null;
}

async function generateAndStoreEmbedding(userId: string): Promise<void> {
  console.log(`\n🔄 Generating embedding for user: ${userId}`);
  console.log('─'.repeat(60));

  const config = getSupabaseConfig();
  const repository = new SupabaseUserAIProfileRepository(config);
  const embeddingService = new UserAIProfileEmbeddingService(repository, {
    debug: (...args: any[]) => console.log('[DEBUG]', ...args),
    info: (...args: any[]) => console.log('[INFO]', ...args),
    error: (...args: any[]) => console.error('[ERROR]', ...args),
  });

  await embeddingService.generateEmbeddingFromSummary(userId);
  console.log(`✅ Embedding generated and stored successfully`);
}

async function runSimilarityQuery(
  client: ReturnType<typeof createClient>,
  targetUserId: string
): Promise<void> {
  console.log(`\n🔍 Running similarity query for user: ${targetUserId}`);
  console.log('─'.repeat(60));

  // Get target user's embedding
  const { data: targetProfile, error: targetError } = await client
    .from('user_ai_profiles')
    .select('user_id, summary_embedding')
    .eq('user_id', targetUserId)
    .single();

  if (targetError || !targetProfile?.summary_embedding) {
    throw new Error(
      `Target user ${targetUserId} not found or has no embedding`
    );
  }

  const targetEmbedding = normalizeEmbedding(targetProfile.summary_embedding);
  if (!targetEmbedding) {
    throw new Error('Target embedding is null or could not be normalized');
  }

  if (targetEmbedding.length !== EXPECTED_DIMENSION) {
    throw new Error(
      `Target embedding has dimension ${targetEmbedding.length}, expected ${EXPECTED_DIMENSION}`
    );
  }

  console.log(`✓ Target embedding dimension: ${targetEmbedding.length}`);

  // Fetch candidate profiles and calculate cosine distance in JS
  const { data: allProfiles, error: queryError } = await client
    .from('user_ai_profiles')
    .select('user_id, summary_embedding')
    .neq('user_id', targetUserId)
    .not('summary_embedding', 'is', null)
    .limit(1000);

  if (queryError) {
    throw new Error(
      typeof queryError === "string"
        ? queryError
        : (queryError?.message || JSON.stringify(queryError))
    );
  }

  const totalCandidates = allProfiles?.length || 0;
  console.log(`✓ Found ${totalCandidates} candidate profiles`);

  // Calculate cosine similarity for each candidate
  const results: Array<{
    user_id: string;
    cosine_distance: number;
    cosine_similarity: number;
    affinity_pct: number;
  }> = [];

  let usableCandidates = 0;
  let skippedWrongDim = 0;

  for (const profile of allProfiles || []) {
    const embedding = normalizeEmbedding(profile.summary_embedding);
    if (!embedding) {
      continue;
    }

    if (embedding.length !== EXPECTED_DIMENSION) {
      skippedWrongDim++;
      continue;
    }

    usableCandidates++;

    // Calculate cosine similarity using dot product and norms
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < EXPECTED_DIMENSION; i++) {
      dotProduct += targetEmbedding[i] * embedding[i];
      normA += targetEmbedding[i] * targetEmbedding[i];
      normB += embedding[i] * embedding[i];
    }

    const normProduct = Math.sqrt(normA) * Math.sqrt(normB);
    if (normProduct === 0) continue;

    const cosineSimilarity = dotProduct / normProduct;
    const cosineDistance = 1 - cosineSimilarity;
    const affinityPct = (1 - cosineDistance) * 100.0;

    results.push({
      user_id: profile.user_id,
      cosine_distance: cosineDistance,
      cosine_similarity: cosineSimilarity,
      affinity_pct: affinityPct,
    });
  }

  console.log(`✓ usable ${usableCandidates} / total ${totalCandidates} (skipped ${skippedWrongDim} wrong-dim)`);

  // Sort by distance (ascending) and take top 5
  const similarUsers = results
    .sort((a, b) => a.cosine_distance - b.cosine_distance)
    .slice(0, 5);

  console.log(`\n📊 Top ${similarUsers.length} similar users:`);
  console.log('─'.repeat(60));
  similarUsers.forEach((user, index) => {
    console.log(
      `${index + 1}. User: ${user.user_id.substring(0, 8)}... | ` +
      `Distance: ${user.cosine_distance.toFixed(4)} | ` +
      `Similarity: ${user.cosine_similarity.toFixed(4)} | ` +
      `Affinity: ${user.affinity_pct.toFixed(1)}%`
    );
  });
}

async function main() {
  const startTime = performance.now();
  const userIdArg = process.argv[2];

  console.log('=== Wodates Embedding Test (1536 dims) ===\n');

  try {
    const config = getSupabaseConfig();
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Determine target user
    let targetUserId: string;
    if (userIdArg) {
      targetUserId = userIdArg;
      console.log(`Using provided user ID: ${targetUserId}`);
    } else {
      console.log('Finding user with summary...');
      const foundUserId = await findUserWithSummary(client);
      if (!foundUserId) {
        throw new Error('No user with summary found in database');
      }
      targetUserId = foundUserId;
      console.log(`Found user: ${targetUserId}`);
    }

    // Step 1: Generate and store embedding
    await generateAndStoreEmbedding(targetUserId);

    // Step 2: Run similarity query
    await runSimilarityQuery(client, targetUserId);

    const endTime = performance.now();
    const totalTimeSeconds = ((endTime - startTime) / 1000).toFixed(3);

    console.log(`\n✅ Test completed successfully`);
    console.log(`⏱️  Execution time: ${totalTimeSeconds}s`);

  } catch (error) {
    const endTime = performance.now();
    const totalTimeSeconds = ((endTime - startTime) / 1000).toFixed(3);

    console.error('\n❌ Error:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    } else {
      console.error('   Unknown error:', error);
    }
    console.error(`⏱️  Execution time before error: ${totalTimeSeconds}s`);
    process.exit(1);
  }
}

// Run the script
main();
