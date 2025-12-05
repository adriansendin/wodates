/**
 * Integration tests for Process 1: LLM Response Verification
 * 
 * These tests call the REAL LLM (Ollama) to verify that:
 * 1. The LLM correctly extracts information from MAIN user messages
 * 2. The LLM does NOT extract information from context messages (no contamination)
 * 
 * IMPORTANT: These tests require:
 * - Ollama running locally (http://localhost:11434)
 * - Model configured in .env: AI_MODEL_PROFILE_CHATS_TO_RESUME
 * - These tests WILL make real API calls to Ollama
 * 
 * The test uses the same model as production:
 * - Reads from .env: AI_MODEL_PROFILE_CHATS_TO_RESUME
 * - Falls back to default if not set
 * 
 * Usage:
 *   npx tsx scripts/testjobs/test-process-1-integration-llm.ts
 * 
 * To skip these tests (if Ollama is not available):
 *   SKIP_LLM_TESTS=true npx tsx scripts/testjobs/test-process-1-integration-llm.ts
 */

import 'dotenv/config';
import { GetAllUserChats } from '../../src/domain/use-cases/chat/GetAllUserChats';
import { GetUnprocessedMessages } from '../../src/domain/use-cases/chat/GetUnprocessedMessages';
import { GenerateUserProfileFromChats } from '../../src/domain/use-cases/chat/GenerateUserProfileFromChats';
import { createSummarizerModel } from '../../src/app/ai/core/config';
import {
  TEST_USER_ID,
  TEST_OTHER_USER_ID,
  TEST_DOC_LOVE_USER_ID,
  TEST_USERS,
} from './test-process-1-data';
import {
  MockMatchRepository,
  MockUserRepository,
  MockMessageRepository,
  MockUserAIProfileRepository,
  MockDocLoveHelper,
} from './test-process-1-helpers';
import {
  SCENARIO_CONFLICTING_PREFERENCES,
  SCENARIO_PERSONAL_QUALITIES,
  SCENARIO_ACTIVITIES,
} from './test-process-1-advanced-data';

/**
 * Test results structure
 */
interface IntegrationTestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
  profileGenerated?: string;
  contaminationFound?: string[];
}

/**
 * Helper to create test setup with custom messages (using REAL LLM)
 */
function createIntegrationTestSetup(
  scenario: {
    mainUserMessages: any[];
    otherUserMessages?: any[];
    docLoveMessages?: any[];
  }
) {
  const realSummarizer = createSummarizerModel(console);
  const mockUserRepo = new MockUserRepository();
  const mockMessageRepo = new MockMessageRepository();
  const mockMatchRepo = new MockMatchRepository();
  const mockProfileRepo = new MockUserAIProfileRepository();
  const mockDocLoveHelper = new MockDocLoveHelper();

  // Prepare messages
  const allMessages: any[] = [];
  
  // Add main user messages (to regular user conversation)
  scenario.mainUserMessages.forEach((msg) => {
    allMessages.push({
      id: msg.id,
      matchId: `match-${TEST_OTHER_USER_ID}`,
      senderId: msg.senderId,
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
      profileProcessedAt: msg.profileProcessedAt ? msg.profileProcessedAt.toISOString() : null,
    });
  });

  // Add other user messages if provided
  if (scenario.otherUserMessages) {
    scenario.otherUserMessages.forEach((msg) => {
      allMessages.push({
        id: msg.id,
        matchId: `match-${TEST_OTHER_USER_ID}`,
        senderId: msg.senderId,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
        profileProcessedAt: msg.profileProcessedAt ? msg.profileProcessedAt.toISOString() : null,
      });
    });
  }

  // Add Doc Love messages if provided
  if (scenario.docLoveMessages) {
    scenario.docLoveMessages.forEach((msg) => {
      allMessages.push({
        id: msg.id,
        matchId: `match-${TEST_DOC_LOVE_USER_ID}`,
        senderId: msg.senderId,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
        profileProcessedAt: msg.profileProcessedAt ? msg.profileProcessedAt.toISOString() : null,
      });
    });
  }

  // Sort by timestamp
  allMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Set custom messages
  mockMessageRepo.setMessages(allMessages);

  const getUnprocessedMessages = new GetUnprocessedMessages(
    mockMessageRepo,
    mockMatchRepo
  );

  const getAllUserChats = new GetAllUserChats(
    mockMatchRepo,
    mockUserRepo,
    getUnprocessedMessages,
    mockMessageRepo,
    mockDocLoveHelper as any,
    console
  );

  const generateProfile = new GenerateUserProfileFromChats(
    getAllUserChats,
    mockProfileRepo,
    mockUserRepo,
    realSummarizer, // ← REAL LLM, not mock!
    mockDocLoveHelper as any,
    console
  );

  return {
    realSummarizer,
    generateProfile,
    mockUserRepo,
    mockProfileRepo,
  };
}

/**
 * Extract profile sections from LLM response
 */
function extractProfileSections(profile: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = profile.split('\n');
  
  let currentSection = '';
  let currentContent: string[] = [];
  
  for (const line of lines) {
    // Check if line is a section header (ends with :)
    if (line.includes(':') && line.length < 100) {
      // Save previous section
      if (currentSection) {
        sections[currentSection] = currentContent.join(' ').trim();
      }
      // Start new section
      currentSection = line.split(':')[0].trim().toLowerCase();
      currentContent = [];
    } else if (currentSection && line.trim()) {
      currentContent.push(line.trim());
    }
  }
  
  // Save last section
  if (currentSection) {
    sections[currentSection] = currentContent.join(' ').trim();
  }
  
  return sections;
}

/**
 * Check if profile contains contamination (context user's information)
 */
function checkContamination(
  profile: string,
  contextUserInfo: string[]
): string[] {
  const profileLower = profile.toLowerCase();
  const contamination: string[] = [];
  
  for (const info of contextUserInfo) {
    const infoLower = info.toLowerCase();
    // Check if context user's info appears in the profile
    if (profileLower.includes(infoLower)) {
      contamination.push(info);
    }
  }
  
  return contamination;
}

/**
 * Test 1: Conflicting preferences - Verify LLM doesn't extract jamón from context
 */
async function testLLMConflictingPreferences(): Promise<IntegrationTestResult> {
  console.log('[INTEGRATION TEST 1] LLM: Conflicting preferences (queso vs jamón)...');
  console.log('  ⚠️  This test calls the REAL LLM - may take 30-60 seconds...');

  try {
    const { generateProfile, mockProfileRepo } = createIntegrationTestSetup(
      SCENARIO_CONFLICTING_PREFERENCES
    );

    const result = await generateProfile.execute(TEST_USER_ID);

    if (!result.success) {
      // Try to get the original error from InternalError
      const errorDetails = result.error.message || result.error.code || 'Unknown error';
      const errorObj = result.error as any;
      const originalError = errorObj.details || errorObj.originalError || errorObj.cause;
      let originalMessage = '';
      
      if (originalError) {
        if (originalError instanceof Error) {
          originalMessage = originalError.message;
          if (originalError.stack) {
            originalMessage += `\nStack: ${originalError.stack.substring(0, 500)}`;
          }
        } else {
          originalMessage = String(originalError);
        }
      }
      
      return {
        name: 'LLM: Conflicting preferences',
        passed: false,
        error: `Error: ${errorDetails}${originalMessage ? `\n\nOriginal error: ${originalMessage}` : ''}`,
      };
    }

    // Get the generated profile
    const profileResult = await mockProfileRepo.findByUserId(TEST_USER_ID);
    if (!profileResult.success || !profileResult.data) {
      return {
        name: 'LLM: Conflicting preferences',
        passed: false,
        error: 'Profile was not generated',
      };
    }

    const profile = profileResult.data.summary || '';
    const profileLower = profile.toLowerCase();

    // Verify MAIN user's information IS present
    const { mainUserShouldHave, mainUserShouldNotHave } = 
      SCENARIO_CONFLICTING_PREFERENCES.expectedInPrompt;
    
    const missingInfo = mainUserShouldHave.filter(
      (info) => !profileLower.includes(info.toLowerCase())
    );

    if (missingInfo.length > 0) {
      return {
        name: 'LLM: Conflicting preferences',
        passed: false,
        error: `LLM did not extract MAIN user's info: ${missingInfo.join(', ')}`,
        profileGenerated: profile.substring(0, 500),
      };
    }

    // Verify CONTEXT user's information is NOT present (NO CONTAMINATION)
    const contamination = checkContamination(profile, mainUserShouldNotHave);

    if (contamination.length > 0) {
      return {
        name: 'LLM: Conflicting preferences',
        passed: false,
        error: `CONTAMINATION DETECTED: LLM extracted context user's info: ${contamination.join(', ')}`,
        profileGenerated: profile,
        contaminationFound: contamination,
      };
    }

    console.log('  ✅ PASSED - LLM correctly extracted MAIN info, no contamination');
    return {
      name: 'LLM: Conflicting preferences',
      passed: true,
      details: `LLM extracted: ${mainUserShouldHave.join(', ')}. No contamination: ${mainUserShouldNotHave.join(', ')}`,
      profileGenerated: profile.substring(0, 300),
    };
  } catch (error) {
    console.log('  ❌ FAILED');
    const errorMessage = error instanceof Error 
      ? `${error.message}${error.stack ? `\nStack: ${error.stack.substring(0, 800)}` : ''}`
      : String(error);
    return {
      name: 'LLM: Conflicting preferences',
      passed: false,
      error: errorMessage,
    };
  }
}

/**
 * Test 2: Personal qualities - Verify LLM doesn't extract extrovertido from context
 */
async function testLLMPersonalQualities(): Promise<IntegrationTestResult> {
  console.log('[INTEGRATION TEST 2] LLM: Personal qualities (introvertido vs extrovertido)...');
  console.log('  ⚠️  This test calls the REAL LLM - may take 30-60 seconds...');

  try {
    const { generateProfile, mockProfileRepo } = createIntegrationTestSetup(
      SCENARIO_PERSONAL_QUALITIES
    );

    const result = await generateProfile.execute(TEST_USER_ID);

    if (!result.success) {
      return {
        name: 'LLM: Personal qualities',
        passed: false,
        error: result.error.message,
      };
    }

    const profileResult = await mockProfileRepo.findByUserId(TEST_USER_ID);
    if (!profileResult.success || !profileResult.data) {
      return {
        name: 'LLM: Personal qualities',
        passed: false,
        error: 'Profile was not generated',
      };
    }

    const profile = profileResult.data.summary || '';
    const profileLower = profile.toLowerCase();
    const { mainUserShouldHave, mainUserShouldNotHave } = 
      SCENARIO_PERSONAL_QUALITIES.expectedInPrompt;

    // Verify MAIN user's information IS present
    // Use flexible matching: check for word stems, variations, and semantic equivalents
    const missingInfo = mainUserShouldHave.filter((info) => {
      const infoLower = info.toLowerCase();
      // Direct match
      if (profileLower.includes(infoLower)) return false;
      
      // Flexible matching for common variations
      if (infoLower === 'introvertida' || infoLower === 'introvertido') {
        // Accept "introvert" stem or semantic equivalents (casa, tranquilidad, soledad)
        return !(profileLower.includes('introvert') || 
                 profileLower.includes('casa') || 
                 profileLower.includes('tranquilidad') ||
                 profileLower.includes('solitario'));
      }
      if (infoLower === 'extrovertida' || infoLower === 'extrovertido') {
        return !profileLower.includes('extrovert');
      }
      // For other words, check for partial matches (e.g., "leyendo" matches "leyendo")
      if (infoLower.length > 4) {
        // Check if a significant portion of the word appears
        const stem = infoLower.substring(0, Math.min(5, infoLower.length));
        if (profileLower.includes(stem)) return false;
      }
      return true;
    });

    if (missingInfo.length > 0) {
      return {
        name: 'LLM: Personal qualities',
        passed: false,
        error: `LLM did not extract MAIN user's info: ${missingInfo.join(', ')}`,
        profileGenerated: profile.substring(0, 500),
      };
    }

    // Verify CONTEXT user's information is NOT present
    const contamination = checkContamination(profile, mainUserShouldNotHave);

    if (contamination.length > 0) {
      return {
        name: 'LLM: Personal qualities',
        passed: false,
        error: `CONTAMINATION DETECTED: LLM extracted context user's qualities: ${contamination.join(', ')}`,
        profileGenerated: profile,
        contaminationFound: contamination,
      };
    }

    console.log('  ✅ PASSED - LLM correctly extracted MAIN qualities, no contamination');
    return {
      name: 'LLM: Personal qualities',
      passed: true,
      details: `LLM extracted: ${mainUserShouldHave.join(', ')}. No contamination: ${mainUserShouldNotHave.join(', ')}`,
      profileGenerated: profile.substring(0, 300),
    };
  } catch (error) {
    console.log('  ❌ FAILED');
    return {
      name: 'LLM: Personal qualities',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test 3: Activities - Verify LLM doesn't extract fútbol from context
 */
async function testLLMActivities(): Promise<IntegrationTestResult> {
  console.log('[INTEGRATION TEST 3] LLM: Activities (senderismo vs fútbol)...');
  console.log('  ⚠️  This test calls the REAL LLM - may take 30-60 seconds...');

  try {
    const { generateProfile, mockProfileRepo } = createIntegrationTestSetup(
      SCENARIO_ACTIVITIES
    );

    const result = await generateProfile.execute(TEST_USER_ID);

    if (!result.success) {
      return {
        name: 'LLM: Activities',
        passed: false,
        error: result.error.message,
      };
    }

    const profileResult = await mockProfileRepo.findByUserId(TEST_USER_ID);
    if (!profileResult.success || !profileResult.data) {
      return {
        name: 'LLM: Activities',
        passed: false,
        error: 'Profile was not generated',
      };
    }

    const profile = profileResult.data.summary || '';
    const profileLower = profile.toLowerCase();
    const { mainUserShouldHave, mainUserShouldNotHave } = 
      SCENARIO_ACTIVITIES.expectedInPrompt;

    // Verify MAIN user's information IS present
    // Use flexible matching: check for word stems, variations, and semantic equivalents
    const missingInfo = mainUserShouldHave.filter((info) => {
      const infoLower = info.toLowerCase();
      // Direct match
      if (profileLower.includes(infoLower)) return false;
      
      // Flexible matching for common variations
      if (infoLower === 'introvertida' || infoLower === 'introvertido') {
        // Accept "introvert" stem or semantic equivalents (casa, tranquilidad, soledad)
        return !(profileLower.includes('introvert') || 
                 profileLower.includes('casa') || 
                 profileLower.includes('tranquilidad') ||
                 profileLower.includes('solitario'));
      }
      if (infoLower === 'extrovertida' || infoLower === 'extrovertido') {
        return !profileLower.includes('extrovert');
      }
      // For other words, check for partial matches (e.g., "leyendo" matches "leyendo")
      if (infoLower.length > 4) {
        // Check if a significant portion of the word appears
        const stem = infoLower.substring(0, Math.min(5, infoLower.length));
        if (profileLower.includes(stem)) return false;
      }
      return true;
    });

    if (missingInfo.length > 0) {
      return {
        name: 'LLM: Activities',
        passed: false,
        error: `LLM did not extract MAIN user's activities: ${missingInfo.join(', ')}`,
        profileGenerated: profile.substring(0, 500),
      };
    }

    // Verify CONTEXT user's information is NOT present
    const contamination = checkContamination(profile, mainUserShouldNotHave);

    if (contamination.length > 0) {
      return {
        name: 'LLM: Activities',
        passed: false,
        error: `CONTAMINATION DETECTED: LLM extracted context user's activities: ${contamination.join(', ')}`,
        profileGenerated: profile,
        contaminationFound: contamination,
      };
    }

    console.log('  ✅ PASSED - LLM correctly extracted MAIN activities, no contamination');
    return {
      name: 'LLM: Activities',
      passed: true,
      details: `LLM extracted: ${mainUserShouldHave.join(', ')}. No contamination: ${mainUserShouldNotHave.join(', ')}`,
      profileGenerated: profile.substring(0, 300),
    };
  } catch (error) {
    console.log('  ❌ FAILED');
    return {
      name: 'LLM: Activities',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Main test runner
 */
async function runIntegrationTests(): Promise<void> {
  // Check if tests should be skipped
  if (process.env.SKIP_LLM_TESTS === 'true') {
    console.log('═'.repeat(80));
    console.log('SKIPPING LLM INTEGRATION TESTS');
    console.log('═'.repeat(80));
    console.log('Set SKIP_LLM_TESTS=false or remove it to run these tests');
    return;
  }

  // Get the model that will be used
  const { AIConfig } = await import('../../src/app/ai/ai-settings');
  const modelName = AIConfig.ollama.profileChatsToResumeModel;

  console.log('═'.repeat(80));
  console.log('INTEGRATION TESTS: Process 1 - LLM Response Verification');
  console.log('═'.repeat(80));
  console.log('');
  console.log('⚠️  WARNING: These tests call the REAL LLM (Ollama)');
  console.log(`   - Model: ${modelName} (from AI_MODEL_PROFILE_CHATS_TO_RESUME)`);
  console.log('   - Make sure Ollama is running on http://localhost:11434');
  console.log('   - These tests may take 2-5 minutes total');
  console.log('   - To skip: SKIP_LLM_TESTS=true npx tsx ...');
  console.log('');

  const results: IntegrationTestResult[] = [];

  // Run integration tests
  results.push(await testLLMConflictingPreferences());
  results.push(await testLLMPersonalQualities());
  results.push(await testLLMActivities());

  // Print summary
  printSummary(results);
}

/**
 * Print test summary
 */
function printSummary(results: IntegrationTestResult[]): void {
  console.log('');
  console.log('═'.repeat(80));
  console.log('INTEGRATION TEST SUMMARY');
  console.log('═'.repeat(80));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('');

  if (failed > 0) {
    console.log('Failed tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  ❌ ${r.name}`);
        if (r.error) {
          console.log(`     Error: ${r.error}`);
        }
        if (r.contaminationFound && r.contaminationFound.length > 0) {
          console.log(`     ⚠️  CONTAMINATION FOUND: ${r.contaminationFound.join(', ')}`);
        }
        if (r.profileGenerated) {
          console.log(`     Profile generated:`);
          console.log(`     ${r.profileGenerated.substring(0, 500)}...`);
        }
      });
    console.log('');
  }

  console.log('═'.repeat(80));

  // Exit with error code if any tests failed
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests if executed directly
runIntegrationTests().catch((error) => {
  console.error('Fatal error running integration tests:', error);
  console.error('');
  console.error('Make sure Ollama is running:');
  console.error('  - Check: curl http://localhost:11434/api/tags');
  console.error('  - Start: ollama serve');
  process.exit(1);
});

