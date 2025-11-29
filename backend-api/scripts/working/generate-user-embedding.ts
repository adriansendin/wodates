/**
 * Script to generate embeddings from summaries for multiple users
 * 
 * This script generates vector embeddings from the summaries stored in user_ai_profiles table
 * for all user IDs specified in the USER_IDS array below.
 * 
 * Usage:
 *   npx tsx scripts/working/generate-user-embedding.ts
 * 
 * To add/remove users, edit the USER_IDS array in this file.
 */

import 'dotenv/config';
import { UserAIProfileEmbeddingService } from '../../src/app/ai/profile/UserAIProfileEmbeddingService';
import { SupabaseUserAIProfileRepository } from '../../src/data/repositories/SupabaseUserAIProfileRepository';
import { createEmbeddingModel } from '../../src/app/ai/core/config';

// ============================================================================
// CONFIGURACIÓN: Edita este array con los IDs de usuarios que quieres procesar
// ============================================================================
const USER_IDS: string[] = [
  'bf9e9fc1-ad44-46b0-933e-1e58bfc904a4',
  '9b290985-decc-46e4-817a-1e7d7cdf8f8b',
  '9cab4177-62c7-4979-9aa5-4eebf61c1c9c',
  'd5024075-6603-424d-8294-902ab53a1039',
  '04cb6fbb-0653-4bba-bfe3-2ecfd3870439',
  '41e7546e-022c-45f9-b218-212975ad7ca2',
  '548d75a8-7809-4bf6-9177-d6b11528253b',
  'f09badb7-243f-402b-8a78-0a5f601478e7',
  'e28eab14-29fc-40af-af6b-7c196522e6a6',
  '75be8215-4a0b-4195-8543-82073ab5e3bb',
  'b03ec57f-f526-4514-9a7b-10464b72d609',
  '228bcb33-fedf-4d75-b065-12fc5794ad44',
  '7f717335-68a9-40d2-a944-49bfd1712b26',
  '7314dcde-7e67-46f7-b46d-532e13765476',
  '238c62c1-b17d-483d-9f6e-78cbffc83976',
  'd56cbd11-ca16-40bd-ba73-28e33bc3b821',
  'f97e0ba5-6ba6-47f1-9f43-8644464a11e4',
  '74a74200-b995-4cfb-84f1-1aa3aee3a288',
  '33376305-e88d-4689-bdbf-31cd4a98db0c',
  '41b4cf05-e393-49b1-a938-167eea424fd0',
  '457ad77b-e8e8-4a02-bbfa-08bbd8d161cf',
  '67ea9182-68a7-46c7-bb35-e840789d4c2d',
  '5ee7d9bf-0f77-480b-8677-6aa98333066a',
  '87ca0479-a2b7-47eb-97b3-42a95e7b1669',
  '8e1139a4-e3ec-4e4c-964b-a98ad5417f71',
  '11d4f1de-59c5-498d-aeec-726e7052f9e7',
  'd765877a-5008-4f62-8a66-93882766d5ca',
  'a10de0ab-f97e-427f-9b18-b4f81066c18b',
  '18a28208-1c42-44c6-a7b8-58024a803b7a',
  '5c1ac6c2-689b-4a61-85e7-767117662573',
  'c437554c-d5fc-4155-a1f7-a77747aac300',
  '7db0ecdc-e4b1-48fa-9f50-34f2c36844ae',
  'bd3082a2-4046-4563-abec-f6eb781c703f',
  'deeeb34b-8fd7-4031-8cff-fd1308335ba0',
];


async function generateEmbedding(userId: string): Promise<boolean> {
  console.log(`\n🔄 Generating embedding for user: ${userId}`);
  console.log('─'.repeat(60));

  try {
    // Initialize dependencies
    const embeddingModel = createEmbeddingModel();
    const aiProfileRepository = new SupabaseUserAIProfileRepository();
    
    // Create service
    const embeddingService = new UserAIProfileEmbeddingService(
      embeddingModel,
      aiProfileRepository,
      {
        debug: (...args: any[]) => console.log('[DEBUG]', ...args),
        info: (...args: any[]) => console.log('[INFO]', ...args),
        error: (...args: any[]) => console.error('[ERROR]', ...args),
      },
    );

    // Generate embedding
    await embeddingService.generateEmbeddingFromSummary(userId);

    console.log(`✅ Successfully processed user: ${userId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error processing user ${userId}:`, error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    return false;
  }
}

async function processAllUsers() {
  if (USER_IDS.length === 0) {
    console.error('❌ Error: USER_IDS array is empty');
    console.error('   Please add at least one user ID to the USER_IDS array in this file.');
    process.exit(1);
  }

  console.log(`\n🚀 Starting batch processing for ${USER_IDS.length} user(s)\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < USER_IDS.length; i++) {
    const userId = USER_IDS[i];
    
    // Validate UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error(`\n⚠️  Skipping invalid UUID format: ${userId}`);
      errorCount++;
      continue;
    }

    const success = await generateEmbedding(userId);
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total users processed: ${USER_IDS.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log('='.repeat(60) + '\n');

  if (errorCount > 0) {
    process.exit(1);
  }
}

// Run the script
processAllUsers();