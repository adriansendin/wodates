/**
 * Smoke test script to validate embedding similarity calculation
 * 
 * This script compares embeddings from two specific users and calculates
 * cosine similarity and affinity score. It serves as a technical validation
 * to confirm the embedding pipeline works correctly.
 * 
 * Usage:
 *   npx tsx scripts/working/test-embedding-similarity.ts
 */

import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { normalizeEmbedding } from '../../src/utils/embedding-utils';

// Load .env from backend-api directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../.env');
dotenv.config({ path: envPath });

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

const USER_A_ID = '1806d6c0-9fd3-401d-b602-e0b474694cbe';
const USER_B_ID = '27322fa5-a727-4b86-a136-83fc71c6e47c';
const EXPECTED_DIMENSION = 1536;
const NORMALIZATION_THRESHOLD = 0.01; // Consider normalized if ||v|| is within 1.0 ± 0.01

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

function parseEmbedding(embedding: unknown): number[] {
  const normalized = normalizeEmbedding(embedding);
  if (!normalized) {
    throw new Error('Embedding is null, undefined, or could not be normalized');
  }
  return normalized;
}

function calculateMagnitude(vector: number[]): number {
  const sumOfSquares = vector.reduce((sum, value) => sum + value * value, 0);
  return Math.sqrt(sumOfSquares);
}

function calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error(`Vectors have different dimensions: ${vectorA.length} vs ${vectorB.length}`);
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    throw new Error('One or both vectors have zero magnitude');
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

function calculateAffinity(cosineSimilarity: number): number {
  // Convert cosine similarity [-1, 1] to affinity [0, 100]
  return ((cosineSimilarity + 1) / 2) * 100;
}

function isNormalized(magnitude: number): boolean {
  return Math.abs(magnitude - 1.0) <= NORMALIZATION_THRESHOLD;
}

async function main() {
  // Start timing
  const startTime = performance.now();

  console.log('=== Wodates Embedding Smoke Test ===\n');
  console.log(`User A: ${USER_A_ID}`);
  console.log(`User B: ${USER_B_ID}\n`);

  try {
    // Get configuration
    const config = getSupabaseConfig();
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Fetch embeddings for both users
    const { data: profileA, error: errorA } = await client
      .from('user_ai_profiles')
      .select('user_id, summary_embedding')
      .eq('user_id', USER_A_ID)
      .maybeSingle();

    if (errorA) {
      throw new Error(`Failed to fetch embedding for User A: ${errorA.message}`);
    }

    if (!profileA) {
      throw new Error(`User A (${USER_A_ID}) not found in user_ai_profiles`);
    }

    const { data: profileB, error: errorB } = await client
      .from('user_ai_profiles')
      .select('user_id, summary_embedding')
      .eq('user_id', USER_B_ID)
      .maybeSingle();

    if (errorB) {
      throw new Error(`Failed to fetch embedding for User B: ${errorB.message}`);
    }

    if (!profileB) {
      throw new Error(`User B (${USER_B_ID}) not found in user_ai_profiles`);
    }

    // Parse embeddings
    const embeddingA = parseEmbedding(profileA.summary_embedding);
    const embeddingB = parseEmbedding(profileB.summary_embedding);

    // Validate dimensions
    if (embeddingA.length !== EXPECTED_DIMENSION) {
      throw new Error(`User A embedding has dimension ${embeddingA.length}, expected ${EXPECTED_DIMENSION}`);
    }

    if (embeddingB.length !== EXPECTED_DIMENSION) {
      throw new Error(`User B embedding has dimension ${embeddingB.length}, expected ${EXPECTED_DIMENSION}`);
    }

    // Calculate magnitudes
    const magnitudeA = calculateMagnitude(embeddingA);
    const magnitudeB = calculateMagnitude(embeddingB);

    // Check normalization
    const normalizedA = isNormalized(magnitudeA);
    const normalizedB = isNormalized(magnitudeB);

    console.log(`Embedding A: dimension ${embeddingA.length}, magnitude ${magnitudeA.toFixed(4)} (normalized: ${normalizedA ? 'yes' : 'no'})`);
    console.log(`Embedding B: dimension ${embeddingB.length}, magnitude ${magnitudeB.toFixed(4)} (normalized: ${normalizedB ? 'yes' : 'no'})`);
    console.log('La normalización de momento NO hay que aplicarla');

    // Calculate cosine similarity
    const cosineSimilarity = calculateCosineSimilarity(embeddingA, embeddingB);
    const affinity = calculateAffinity(cosineSimilarity);

    console.log(`Cosine similarity: ${cosineSimilarity.toFixed(4)}`);
    console.log(`Affinity score: ${affinity.toFixed(0)}%`);
    console.log('');

    // End timing
    const endTime = performance.now();
    const totalTimeMs = endTime - startTime;
    const totalTimeSeconds = (totalTimeMs / 1000).toFixed(3);

    // Validation passed
    console.log('✓ Validation passed: embeddings are comparable');
    console.log(`⏱️  Execution time: ${totalTimeSeconds}s (${totalTimeMs.toFixed(2)}ms)`);

  } catch (error) {
    // End timing even on error
    const endTime = performance.now();
    const totalTimeMs = endTime - startTime;
    const totalTimeSeconds = (totalTimeMs / 1000).toFixed(3);
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
    console.error(`⏱️  Execution time before error: ${totalTimeSeconds}s (${totalTimeMs.toFixed(2)}ms)`);
    process.exit(1);
  }
}

// Run the script
main();
