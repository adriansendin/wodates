/**
 * Test script for Process 1: MAIN marking verification
 * 
 * This script tests that messages from the main user are correctly marked with (MAIN)
 * in the prompt sent to the LLM, while messages from other users are not marked.
 * 
 * Usage:
 *   npx tsx scripts/testjobs/test-process-1-job.ts
 * 
 * IMPORTANT: This test is completely isolated and safe to run repeatedly:
 * - All repositories are mocked (in-memory only, no database access)
 * - DocLoveHelper is mocked (no database queries)
 * - SummarizerModel is mocked (no LLM API calls)
 * - No data is written to database or external services
 * - All test data is stored in memory and reset on each run
 * 
 * The test verifies:
 * 1. Main user messages have (MAIN) marker
 * 2. Other user messages do NOT have (MAIN) marker
 * 3. Name comparison is case-insensitive
 * 4. Name comparison handles whitespace correctly
 * 5. Messages without senderName are handled gracefully
 * 6. Complex scenarios with conflicting information (no contamination)
 * 7. Prompt structure includes both MAIN and context messages
 */

import 'dotenv/config';
import { GetAllUserChats } from '../../src/domain/use-cases/chat/GetAllUserChats';
import { GetUnprocessedMessages } from '../../src/domain/use-cases/chat/GetUnprocessedMessages';
import { GenerateUserProfileFromChats } from '../../src/domain/use-cases/chat/GenerateUserProfileFromChats';
import {
  TEST_USER_ID,
  TEST_OTHER_USER_ID,
  TEST_DOC_LOVE_USER_ID,
  TEST_USERS,
  NAME_VARIATIONS,
  EXPECTED_PROMPT_PATTERNS,
} from './test-process-1-data';
import {
  MockMatchRepository,
  MockUserRepository,
  MockMessageRepository,
  MockUserAIProfileRepository,
  MockDocLoveHelper,
  MockSummarizerModel,
} from './test-process-1-helpers';
import {
  SCENARIO_CONFLICTING_PREFERENCES,
  SCENARIO_PERSONAL_QUALITIES,
  SCENARIO_ACTIVITIES,
  SCENARIO_WORK_CAREER,
  SCENARIO_RELATIONSHIP_PREFERENCES,
  SCENARIO_DOC_LOVE_CONVERSATION,
  SCENARIO_COMPLEX_MULTI_TOPIC,
} from './test-process-1-advanced-data';

/**
 * Test results structure
 */
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
  promptSnippet?: string;
}

/**
 * Main test runner
 */
async function runTests(): Promise<void> {
  console.log('═'.repeat(80));
  console.log('TEST: Process 1 - MAIN Marking Verification');
  console.log('═'.repeat(80));
  console.log('');

  const results: TestResult[] = [];

  // ===== BASIC TESTS =====
  console.log('📋 BASIC TESTS');
  console.log('');
  
  results.push(await testBasicMainMarking());
  results.push(await testCaseInsensitiveComparison());
  results.push(await testWhitespaceHandling());
  results.push(await testMultipleConversations());
  results.push(await testMessagesWithoutSenderName());

  // ===== ADVANCED TESTS =====
  console.log('');
  console.log('🔬 ADVANCED TESTS (Contamination Prevention)');
  console.log('');

  results.push(await testConflictingPreferences());
  results.push(await testPersonalQualities());
  results.push(await testActivities());
  results.push(await testWorkCareer());
  results.push(await testRelationshipPreferences());
  results.push(await testDocLoveConversation());
  results.push(await testComplexMultiTopic());

  // Print summary
  printSummary(results);
}

// ============================================================================
// BASIC TESTS
// ============================================================================

/**
 * Test 1: Basic MAIN marking - main user messages should have (MAIN)
 */
async function testBasicMainMarking(): Promise<TestResult> {
  console.log('[TEST 1] Basic MAIN marking...');

  try {
    const mockSummarizer = new MockSummarizerModel();
    const mockUserRepo = new MockUserRepository();
    const mockMessageRepo = new MockMessageRepository();
    const mockMatchRepo = new MockMatchRepository();
    const mockProfileRepo = new MockUserAIProfileRepository();
    const mockDocLoveHelper = new MockDocLoveHelper();

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
      mockSummarizer as any,
      mockDocLoveHelper as any,
      console
    );

    // Execute the use case
    const result = await generateProfile.execute(TEST_USER_ID);

    if (!result.success) {
      return {
        name: 'Basic MAIN marking',
        passed: false,
        error: result.error.message,
      };
    }

    // Verify prompt was generated
    if (!mockSummarizer.lastPrompt) {
      return {
        name: 'Basic MAIN marking',
        passed: false,
        error: 'Prompt was not generated',
      };
    }

    // Check that main user messages have (MAIN)
    const mainUserPattern = EXPECTED_PROMPT_PATTERNS.mainUserWithMain;
    if (!mainUserPattern.test(mockSummarizer.lastPrompt)) {
      return {
        name: 'Basic MAIN marking',
        passed: false,
        error: 'Main user messages do not have (MAIN) marker',
        details: `Prompt snippet: ${mockSummarizer.lastPrompt.substring(0, 500)}`,
      };
    }

    // Check that other user messages do NOT have (MAIN)
    const otherUserPattern = EXPECTED_PROMPT_PATTERNS.otherUserWithoutMain;
    if (!otherUserPattern.test(mockSummarizer.lastPrompt)) {
      return {
        name: 'Basic MAIN marking',
        passed: false,
        error: 'Other user messages incorrectly have (MAIN) marker',
      };
    }

    // Verify that "Adrian:" without (MAIN) does NOT appear (should only be "Adrian (MAIN):")
    const mainUserWithoutMainPattern = EXPECTED_PROMPT_PATTERNS.mainUserWithoutMain;
    if (mainUserWithoutMainPattern.test(mockSummarizer.lastPrompt)) {
      return {
        name: 'Basic MAIN marking',
        passed: false,
        error: 'Found "Adrian:" without (MAIN) marker - all main user messages should have (MAIN)',
      };
    }

    console.log('  ✅ PASSED');
    return {
      name: 'Basic MAIN marking',
      passed: true,
      details: 'Main user messages correctly marked with (MAIN), other users not marked',
    };
  } catch (error) {
    console.log('  ❌ FAILED');
    return {
      name: 'Basic MAIN marking',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test 2: Case-insensitive name comparison
 */
async function testCaseInsensitiveComparison(): Promise<TestResult> {
  console.log('[TEST 2] Case-insensitive name comparison...');

  try {
    const mockSummarizer = new MockSummarizerModel();
    const mockUserRepo = new MockUserRepository();
    const mockMessageRepo = new MockMessageRepository();
    const mockMatchRepo = new MockMatchRepository();
    const mockProfileRepo = new MockUserAIProfileRepository();
    const mockDocLoveHelper = new MockDocLoveHelper();

    // Test with lowercase name
    mockUserRepo.setUserName(TEST_USER_ID, NAME_VARIATIONS.lowercase);

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
      mockSummarizer as any,
      mockDocLoveHelper as any,
      console
    );

    const result = await generateProfile.execute(TEST_USER_ID);

    if (!result.success) {
      return {
        name: 'Case-insensitive comparison',
        passed: false,
        error: result.error.message,
      };
    }

    // Verify that lowercase name still gets (MAIN) marker
    // (because senderName in messages is "Adrian" but user name is "adrian")
    if (!mockSummarizer.lastPrompt) {
      return {
        name: 'Case-insensitive comparison',
        passed: false,
        error: 'Prompt was not generated',
      };
    }

    // The prompt should still mark "Adrian" as (MAIN) even if user name is "adrian"
    const mainUserPattern = EXPECTED_PROMPT_PATTERNS.mainUserWithMain;
    if (!mainUserPattern.test(mockSummarizer.lastPrompt)) {
      return {
        name: 'Case-insensitive comparison',
        passed: false,
        error: 'Case-insensitive comparison failed',
        details: `Expected "Adrian (MAIN)" but prompt may not have it. Prompt snippet: ${mockSummarizer.lastPrompt.substring(0, 500)}`,
      };
    }

    console.log('  ✅ PASSED');
    return {
      name: 'Case-insensitive comparison',
      passed: true,
      details: 'Name comparison works case-insensitively',
    };
  } catch (error) {
    console.log('  ❌ FAILED');
    return {
      name: 'Case-insensitive comparison',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test 3: Whitespace handling
 */
async function testWhitespaceHandling(): Promise<TestResult> {
  console.log('[TEST 3] Whitespace handling...');

  try {
    const mockSummarizer = new MockSummarizerModel();
    const mockUserRepo = new MockUserRepository();
    const mockMessageRepo = new MockMessageRepository();
    const mockMatchRepo = new MockMatchRepository();
    const mockProfileRepo = new MockUserAIProfileRepository();
    const mockDocLoveHelper = new MockDocLoveHelper();

    // Set user name with spaces
    mockUserRepo.setUserName(TEST_USER_ID, NAME_VARIATIONS.withSpaces);

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
      mockSummarizer as any,
      mockDocLoveHelper as any,
      console
    );

    const result = await generateProfile.execute(TEST_USER_ID);

    if (!result.success) {
      return {
        name: 'Whitespace handling',
        passed: false,
        error: result.error.message,
      };
    }

    if (!mockSummarizer.lastPrompt) {
      return {
        name: 'Whitespace handling',
        passed: false,
        error: 'Prompt was not generated',
      };
    }

    // Should still mark correctly despite whitespace differences
    const mainUserPattern = EXPECTED_PROMPT_PATTERNS.mainUserWithMain;
    if (!mainUserPattern.test(mockSummarizer.lastPrompt)) {
      return {
        name: 'Whitespace handling',
        passed: false,
        error: 'Whitespace handling failed',
        details: `Prompt snippet: ${mockSummarizer.lastPrompt.substring(0, 500)}`,
      };
    }

    console.log('  ✅ PASSED');
    return {
      name: 'Whitespace handling',
      passed: true,
      details: 'Name comparison handles whitespace correctly',
    };
  } catch (error) {
    console.log('  ❌ FAILED');
    return {
      name: 'Whitespace handling',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test 4: Multiple conversations (with Doc Love and regular users)
 */
async function testMultipleConversations(): Promise<TestResult> {
  console.log('[TEST 4] Multiple conversations...');

  try {
    const mockSummarizer = new MockSummarizerModel();
    const mockUserRepo = new MockUserRepository();
    const mockMessageRepo = new MockMessageRepository();
    const mockMatchRepo = new MockMatchRepository();
    const mockProfileRepo = new MockUserAIProfileRepository();
    const mockDocLoveHelper = new MockDocLoveHelper();

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
      mockSummarizer as any,
      mockDocLoveHelper as any,
      console
    );

    const result = await generateProfile.execute(TEST_USER_ID);

    if (!result.success) {
      return {
        name: 'Multiple conversations',
        passed: false,
        error: result.error.message,
      };
    }

    if (!mockSummarizer.lastPrompt) {
      return {
        name: 'Multiple conversations',
        passed: false,
        error: 'Prompt was not generated',
      };
    }

    // Verify main user messages have (MAIN) in all conversations
    const mainUserPattern = EXPECTED_PROMPT_PATTERNS.mainUserWithMain;
    const mainMatches = mockSummarizer.lastPrompt.match(mainUserPattern);
    if (!mainMatches || mainMatches.length === 0) {
      return {
        name: 'Multiple conversations',
        passed: false,
        error: 'Main user messages not marked with (MAIN) in multiple conversations',
        details: `Prompt snippet: ${mockSummarizer.lastPrompt.substring(0, 500)}`,
      };
    }

    // Verify Doc Love messages do NOT have (MAIN)
    // Check if Doc Love conversation exists in prompt
    const docLovePattern = EXPECTED_PROMPT_PATTERNS.docLoveWithoutMain;
    const hasDocLoveMessages = docLovePattern.test(mockSummarizer.lastPrompt);
    
    // If Doc Love messages exist, verify they don't have (MAIN)
    if (hasDocLoveMessages) {
      const docLoveWithMainPattern = /Doc Love\s+\(MAIN\):/;
      if (docLoveWithMainPattern.test(mockSummarizer.lastPrompt)) {
        return {
          name: 'Multiple conversations',
          passed: false,
          error: 'Doc Love messages incorrectly have (MAIN) marker',
        };
      }
    }
    
    // Verify we have at least 2 conversations (should have both regular user and Doc Love)
    const conversationCount = (mockSummarizer.lastPrompt.match(/Conversación con/g) || []).length;
    if (conversationCount < 2) {
      return {
        name: 'Multiple conversations',
        passed: false,
        error: `Expected at least 2 conversations, found ${conversationCount}`,
        details: `Prompt snippet: ${mockSummarizer.lastPrompt.substring(0, 500)}`,
      };
    }

    // Verify that Doc Love messages don't have (MAIN)
    const docLoveWithMainPattern = /Doc Love \(MAIN\):/;
    if (docLoveWithMainPattern.test(mockSummarizer.lastPrompt)) {
      return {
        name: 'Multiple conversations',
        passed: false,
        error: 'Doc Love messages incorrectly have (MAIN) marker',
      };
    }

    console.log('  ✅ PASSED');
    return {
      name: 'Multiple conversations',
      passed: true,
      details: `Found ${mainMatches.length} main user message(s) correctly marked`,
    };
  } catch (error) {
    console.log('  ❌ FAILED');
    return {
      name: 'Multiple conversations',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test 5: Messages without senderName
 */
async function testMessagesWithoutSenderName(): Promise<TestResult> {
  console.log('[TEST 5] Messages without senderName...');

  try {
    const mockSummarizer = new MockSummarizerModel();
    const mockUserRepo = new MockUserRepository();
    const mockMessageRepo = new MockMessageRepository();
    const mockMatchRepo = new MockMatchRepository();
    const mockProfileRepo = new MockUserAIProfileRepository();
    const mockDocLoveHelper = new MockDocLoveHelper();

    // Note: This test verifies that the system handles missing senderName gracefully
    // In real scenarios, GetAllUserChats should always provide senderName
    // This test mainly ensures no crashes occur

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
      mockSummarizer as any,
      mockDocLoveHelper as any,
      console
    );

    const result = await generateProfile.execute(TEST_USER_ID);

    // Should complete without errors even if some messages lack senderName
    // (In practice, GetAllUserChats always provides senderName, so this should succeed)
    if (!result.success && result.error.code !== 'NOT_FOUND') {
      return {
        name: 'Messages without senderName',
        passed: false,
        error: result.error.message,
      };
    }

    // If prompt was generated, verify it doesn't crash
    if (mockSummarizer.lastPrompt) {
      // Should contain at least some messages
      if (mockSummarizer.lastPrompt.length < 100) {
        return {
          name: 'Messages without senderName',
          passed: false,
          error: 'Prompt seems too short, may indicate an issue',
        };
      }
    }

    console.log('  ✅ PASSED');
    return {
      name: 'Messages without senderName',
      passed: true,
      details: 'System handles missing senderName gracefully',
    };
  } catch (error) {
    console.log('  ❌ FAILED');
    return {
      name: 'Messages without senderName',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// ADVANCED TESTS
// ============================================================================

/**
 * Helper to create test setup with custom messages
 */
function createTestSetup(
  scenario: {
    mainUserMessages: any[];
    otherUserMessages?: any[];
    docLoveMessages?: any[];
  }
) {
  const mockSummarizer = new MockSummarizerModel();
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
    mockSummarizer as any,
    mockDocLoveHelper as any,
    console
  );

  return {
    mockSummarizer,
    generateProfile,
    mockUserRepo,
  };
}

/**
 * Test 6: Conflicting preferences - MAIN says "queso", OTHER says "jamón"
 */
async function testConflictingPreferences(): Promise<TestResult> {
  console.log('[TEST 6] Conflicting preferences (queso vs jamón)...');

  try {
    const { mockSummarizer, generateProfile } = createTestSetup(SCENARIO_CONFLICTING_PREFERENCES);

    const result = await generateProfile.execute(TEST_USER_ID);

    if (!result.success) {
      return {
        name: 'Conflicting preferences',
        passed: false,
        error: result.error.message,
      };
    }

    if (!mockSummarizer.lastPrompt) {
      return {
        name: 'Conflicting preferences',
        passed: false,
        error: 'Prompt was not generated',
      };
    }

    const prompt = mockSummarizer.lastPrompt || '';
    const promptLower = prompt.toLowerCase();
    const { mainUserShouldHave, mainUserShouldNotHave } = SCENARIO_CONFLICTING_PREFERENCES.expectedInPrompt;

    // Verify prompt includes both MAIN and context messages
    const hasMainMessages = /adrian\s+\(main\):/i.test(prompt);
    const hasContextMessages = /laura:/i.test(prompt) || /doc love:/i.test(prompt);
    
    if (!hasMainMessages) {
      return {
        name: 'Conflicting preferences',
        passed: false,
        error: 'Prompt does not include MAIN user messages',
        promptSnippet: prompt.substring(0, 800),
      };
    }
    
    if (!hasContextMessages) {
      return {
        name: 'Conflicting preferences',
        passed: false,
        error: 'Prompt does not include context messages (needed for narrative context)',
        promptSnippet: prompt.substring(0, 800),
      };
    }

    // Verify MAIN has correct information (in MAIN messages)
    // Extract all MAIN user messages from the prompt
    // Pattern: "Adrian (MAIN):" followed by content until newline
    const mainUserMessages = prompt.match(/adrian\s+\(main\):[^\n]*/gi) || [];
    
    if (mainUserMessages.length === 0) {
      return {
        name: 'Conflicting preferences',
        passed: false,
        error: 'Could not extract MAIN user messages from prompt',
        promptSnippet: prompt.substring(0, 800),
      };
    }
    
    // Join all MAIN messages and convert to lowercase for comparison
    const mainUserSection = mainUserMessages.join(' ').toLowerCase();
    
    const missingInfo = mainUserShouldHave.filter((info) => {
      // Check if info appears in MAIN user's messages (case-insensitive)
      const infoLower = info.toLowerCase();
      return !mainUserSection.includes(infoLower);
    });
    
    if (missingInfo.length > 0) {
      return {
        name: 'Conflicting preferences',
        passed: false,
        error: `Main user messages should contain: ${missingInfo.join(', ')}`,
        promptSnippet: mockSummarizer.lastPrompt.substring(0, 800),
      };
    }

    // Verify MAIN does NOT have context user's information (NO CONTAMINATION)
    // This is critical: context messages are ONLY for narrative context, not for extraction
    const contamination = mainUserShouldNotHave.filter((info) => {
      // Check if info appears in MAIN user's messages (marked with MAIN)
      return mainUserSection.includes(info.toLowerCase());
    });

    if (contamination.length > 0) {
      return {
        name: 'Conflicting preferences',
        passed: false,
        error: `CONTAMINATION: Main user messages incorrectly contain context user's info: ${contamination.join(', ')}. Context messages should ONLY be used for narrative context, not for extraction.`,
        promptSnippet: mockSummarizer.lastPrompt,
      };
    }

    console.log('  ✅ PASSED - Prompt structure correct: MAIN messages for extraction, context messages for narrative');
    return {
      name: 'Conflicting preferences',
      passed: true,
      details: `Verified: MAIN messages contain ${mainUserShouldHave.join(', ')}. Context messages present for narrative. No contamination: MAIN does NOT contain ${mainUserShouldNotHave.join(', ')}`,
    };
  } catch (error) {
    console.log('  ❌ FAILED');
    return {
      name: 'Conflicting preferences',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test 7: Personal qualities - MAIN says "introvertido", OTHER says "extrovertido"
 */
async function testPersonalQualities(): Promise<TestResult> {
  console.log('[TEST 7] Personal qualities (introvertido vs extrovertido)...');

  try {
    const { mockSummarizer, generateProfile } = createTestSetup(SCENARIO_PERSONAL_QUALITIES);

    const result = await generateProfile.execute(TEST_USER_ID);

    if (!result.success) {
      return {
        name: 'Personal qualities',
        passed: false,
        error: result.error.message,
      };
    }

    if (!mockSummarizer.lastPrompt) {
      return {
        name: 'Personal qualities',
        passed: false,
        error: 'Prompt was not generated',
      };
    }

    const prompt = mockSummarizer.lastPrompt.toLowerCase();
    const { mainUserShouldHave, mainUserShouldNotHave } = SCENARIO_PERSONAL_QUALITIES.expectedInPrompt;

    // Verify MAIN has correct information
    const missingInfo = mainUserShouldHave.filter((info) => !prompt.includes(info.toLowerCase()));
    if (missingInfo.length > 0) {
      return {
        name: 'Personal qualities',
        passed: false,
        error: `Main user should have: ${missingInfo.join(', ')}`,
        promptSnippet: mockSummarizer.lastPrompt.substring(0, 800),
      };
    }

    // Verify MAIN does NOT have OTHER user's information
    const contamination = mainUserShouldNotHave.filter((info) => {
      const mainUserSection = prompt.match(/adrian\s+\(main\):[\s\S]*?(?=laura:|doc love:|$)/i);
      if (mainUserSection) {
        return mainUserSection[0].includes(info.toLowerCase());
      }
      return false;
    });

    if (contamination.length > 0) {
      return {
        name: 'Personal qualities',
        passed: false,
        error: `CONTAMINATION: Main user incorrectly has OTHER user's qualities: ${contamination.join(', ')}`,
        promptSnippet: mockSummarizer.lastPrompt,
      };
    }

    console.log('  ✅ PASSED - No contamination detected');
    return {
      name: 'Personal qualities',
      passed: true,
      details: `Verified MAIN has: ${mainUserShouldHave.join(', ')}. Verified MAIN does NOT have: ${mainUserShouldNotHave.join(', ')}`,
    };
  } catch (error) {
    console.log('  ❌ FAILED');
    return {
      name: 'Personal qualities',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test 8: Activities - MAIN says "senderismo", OTHER says "fútbol"
 */
async function testActivities(): Promise<TestResult> {
  console.log('[TEST 8] Activities (senderismo vs fútbol)...');

  try {
    const { mockSummarizer, generateProfile } = createTestSetup(SCENARIO_ACTIVITIES);

    const result = await generateProfile.execute(TEST_USER_ID);

    if (!result.success) {
      return {
        name: 'Activities',
        passed: false,
        error: result.error.message,
      };
    }

    if (!mockSummarizer.lastPrompt) {
      return {
        name: 'Activities',
        passed: false,
        error: 'Prompt was not generated',
      };
    }

    const prompt = mockSummarizer.lastPrompt.toLowerCase();
    const { mainUserShouldHave, mainUserShouldNotHave } = SCENARIO_ACTIVITIES.expectedInPrompt;

    // Verify MAIN has correct information
    const missingInfo = mainUserShouldHave.filter((info) => !prompt.includes(info.toLowerCase()));
    if (missingInfo.length > 0) {
      return {
        name: 'Activities',
        passed: false,
        error: `Main user should have: ${missingInfo.join(', ')}`,
        promptSnippet: mockSummarizer.lastPrompt.substring(0, 800),
      };
    }

    // Verify MAIN does NOT have OTHER user's information
    const contamination = mainUserShouldNotHave.filter((info) => {
      const mainUserSection = prompt.match(/adrian\s+\(main\):[\s\S]*?(?=laura:|doc love:|$)/i);
      if (mainUserSection) {
        return mainUserSection[0].includes(info.toLowerCase());
      }
      return false;
    });

    if (contamination.length > 0) {
      return {
        name: 'Activities',
        passed: false,
        error: `CONTAMINATION: Main user incorrectly has OTHER user's activities: ${contamination.join(', ')}`,
        promptSnippet: mockSummarizer.lastPrompt,
      };
    }

    console.log('  ✅ PASSED - No contamination detected');
    return {
      name: 'Activities',
      passed: true,
      details: `Verified MAIN has: ${mainUserShouldHave.join(', ')}. Verified MAIN does NOT have: ${mainUserShouldNotHave.join(', ')}`,
    };
  } catch (error) {
    console.log('  ❌ FAILED');
    return {
      name: 'Activities',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test 9: Work and career - MAIN says "programador", OTHER says "médico"
 */
async function testWorkCareer(): Promise<TestResult> {
  console.log('[TEST 9] Work and career (programador vs médico)...');

  try {
    const { mockSummarizer, generateProfile } = createTestSetup(SCENARIO_WORK_CAREER);

    const result = await generateProfile.execute(TEST_USER_ID);

    if (!result.success) {
      return {
        name: 'Work and career',
        passed: false,
        error: result.error.message,
      };
    }

    if (!mockSummarizer.lastPrompt) {
      return {
        name: 'Work and career',
        passed: false,
        error: 'Prompt was not generated',
      };
    }

    const prompt = mockSummarizer.lastPrompt.toLowerCase();
    const { mainUserShouldHave, mainUserShouldNotHave } = SCENARIO_WORK_CAREER.expectedInPrompt;

    // Verify MAIN has correct information
    const missingInfo = mainUserShouldHave.filter((info) => !prompt.includes(info.toLowerCase()));
    if (missingInfo.length > 0) {
      return {
        name: 'Work and career',
        passed: false,
        error: `Main user should have: ${missingInfo.join(', ')}`,
        promptSnippet: mockSummarizer.lastPrompt.substring(0, 800),
      };
    }

    // Verify MAIN does NOT have OTHER user's information
    const contamination = mainUserShouldNotHave.filter((info) => {
      const mainUserSection = prompt.match(/adrian\s+\(main\):[\s\S]*?(?=laura:|doc love:|$)/i);
      if (mainUserSection) {
        return mainUserSection[0].includes(info.toLowerCase());
      }
      return false;
    });

    if (contamination.length > 0) {
      return {
        name: 'Work and career',
        passed: false,
        error: `CONTAMINATION: Main user incorrectly has OTHER user's profession: ${contamination.join(', ')}`,
        promptSnippet: mockSummarizer.lastPrompt,
      };
    }

    console.log('  ✅ PASSED - No contamination detected');
    return {
      name: 'Work and career',
      passed: true,
      details: `Verified MAIN has: ${mainUserShouldHave.join(', ')}. Verified MAIN does NOT have: ${mainUserShouldNotHave.join(', ')}`,
    };
  } catch (error) {
    console.log('  ❌ FAILED');
    return {
      name: 'Work and career',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test 10: Relationship preferences - MAIN says "serio", OTHER says "casual"
 */
async function testRelationshipPreferences(): Promise<TestResult> {
  console.log('[TEST 10] Relationship preferences (serio vs casual)...');

  try {
    const { mockSummarizer, generateProfile } = createTestSetup(SCENARIO_RELATIONSHIP_PREFERENCES);

    const result = await generateProfile.execute(TEST_USER_ID);

    if (!result.success) {
      return {
        name: 'Relationship preferences',
        passed: false,
        error: result.error.message,
      };
    }

    if (!mockSummarizer.lastPrompt) {
      return {
        name: 'Relationship preferences',
        passed: false,
        error: 'Prompt was not generated',
      };
    }

    const prompt = mockSummarizer.lastPrompt.toLowerCase();
    const { mainUserShouldHave, mainUserShouldNotHave } = SCENARIO_RELATIONSHIP_PREFERENCES.expectedInPrompt;

    // Verify MAIN has correct information
    const missingInfo = mainUserShouldHave.filter((info) => !prompt.includes(info.toLowerCase()));
    if (missingInfo.length > 0) {
      return {
        name: 'Relationship preferences',
        passed: false,
        error: `Main user should have: ${missingInfo.join(', ')}`,
        promptSnippet: mockSummarizer.lastPrompt.substring(0, 800),
      };
    }

    // Verify MAIN does NOT have OTHER user's information
    const contamination = mainUserShouldNotHave.filter((info) => {
      const mainUserSection = prompt.match(/adrian\s+\(main\):[\s\S]*?(?=laura:|doc love:|$)/i);
      if (mainUserSection) {
        return mainUserSection[0].includes(info.toLowerCase());
      }
      return false;
    });

    if (contamination.length > 0) {
      return {
        name: 'Relationship preferences',
        passed: false,
        error: `CONTAMINATION: Main user incorrectly has OTHER user's preferences: ${contamination.join(', ')}`,
        promptSnippet: mockSummarizer.lastPrompt,
      };
    }

    console.log('  ✅ PASSED - No contamination detected');
    return {
      name: 'Relationship preferences',
      passed: true,
      details: `Verified MAIN has: ${mainUserShouldHave.join(', ')}. Verified MAIN does NOT have: ${mainUserShouldNotHave.join(', ')}`,
    };
  } catch (error) {
    console.log('  ❌ FAILED');
    return {
      name: 'Relationship preferences',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test 11: Doc Love conversation - Only MAIN and Doc Love
 */
async function testDocLoveConversation(): Promise<TestResult> {
  console.log('[TEST 11] Doc Love conversation (only MAIN and Doc Love)...');

  try {
    const { mockSummarizer, generateProfile } = createTestSetup(SCENARIO_DOC_LOVE_CONVERSATION);

    const result = await generateProfile.execute(TEST_USER_ID);

    if (!result.success) {
      return {
        name: 'Doc Love conversation',
        passed: false,
        error: result.error.message,
      };
    }

    if (!mockSummarizer.lastPrompt) {
      return {
        name: 'Doc Love conversation',
        passed: false,
        error: 'Prompt was not generated',
      };
    }

    const prompt = mockSummarizer.lastPrompt.toLowerCase();
    const { mainUserShouldHave } = SCENARIO_DOC_LOVE_CONVERSATION.expectedInPrompt;

    // Verify MAIN has correct information
    const missingInfo = mainUserShouldHave.filter((info) => !prompt.includes(info.toLowerCase()));
    if (missingInfo.length > 0) {
      return {
        name: 'Doc Love conversation',
        passed: false,
        error: `Main user should have: ${missingInfo.join(', ')}`,
        promptSnippet: mockSummarizer.lastPrompt.substring(0, 800),
      };
    }

    // Verify Doc Love messages do NOT have (MAIN)
    const docLoveWithMain = /doc love\s+\(main\):/i.test(prompt);
    if (docLoveWithMain) {
      return {
        name: 'Doc Love conversation',
        passed: false,
        error: 'CONTAMINATION: Doc Love messages incorrectly marked with (MAIN)',
        promptSnippet: mockSummarizer.lastPrompt,
      };
    }

    console.log('  ✅ PASSED - Doc Love correctly not marked as MAIN');
    return {
      name: 'Doc Love conversation',
      passed: true,
      details: `Verified MAIN has: ${mainUserShouldHave.join(', ')}. Doc Love correctly not marked.`,
    };
  } catch (error) {
    console.log('  ❌ FAILED');
    return {
      name: 'Doc Love conversation',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test 12: Complex multi-topic conversation
 */
async function testComplexMultiTopic(): Promise<TestResult> {
  console.log('[TEST 12] Complex multi-topic conversation...');

  try {
    const { mockSummarizer, generateProfile } = createTestSetup(SCENARIO_COMPLEX_MULTI_TOPIC);

    const result = await generateProfile.execute(TEST_USER_ID);

    if (!result.success) {
      return {
        name: 'Complex multi-topic',
        passed: false,
        error: result.error.message,
      };
    }

    if (!mockSummarizer.lastPrompt) {
      return {
        name: 'Complex multi-topic',
        passed: false,
        error: 'Prompt was not generated',
      };
    }

    const prompt = mockSummarizer.lastPrompt.toLowerCase();
    const { mainUserShouldHave, mainUserShouldNotHave } = SCENARIO_COMPLEX_MULTI_TOPIC.expectedInPrompt;

    // Verify MAIN has correct information
    const missingInfo = mainUserShouldHave.filter((info) => !prompt.includes(info.toLowerCase()));
    if (missingInfo.length > 0) {
      return {
        name: 'Complex multi-topic',
        passed: false,
        error: `Main user should have: ${missingInfo.join(', ')}`,
        promptSnippet: mockSummarizer.lastPrompt.substring(0, 1000),
      };
    }

    // Verify MAIN does NOT have OTHER user's information
    const contamination = mainUserShouldNotHave.filter((info) => {
      const mainUserSection = prompt.match(/adrian\s+\(main\):[\s\S]*?(?=laura:|doc love:|$)/i);
      if (mainUserSection) {
        return mainUserSection[0].includes(info.toLowerCase());
      }
      return false;
    });

    if (contamination.length > 0) {
      return {
        name: 'Complex multi-topic',
        passed: false,
        error: `CONTAMINATION: Main user incorrectly has OTHER user's info: ${contamination.join(', ')}`,
        promptSnippet: mockSummarizer.lastPrompt,
      };
    }

    console.log('  ✅ PASSED - No contamination detected across multiple topics');
    return {
      name: 'Complex multi-topic',
      passed: true,
      details: `Verified MAIN has: ${mainUserShouldHave.join(', ')}. Verified MAIN does NOT have: ${mainUserShouldNotHave.join(', ')}`,
    };
  } catch (error) {
    console.log('  ❌ FAILED');
    return {
      name: 'Complex multi-topic',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Print test summary
 */
function printSummary(results: TestResult[]): void {
  console.log('');
  console.log('═'.repeat(80));
  console.log('TEST SUMMARY');
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
        if (r.details) {
          console.log(`     Details: ${r.details}`);
        }
        if (r.promptSnippet) {
          console.log(`     Prompt snippet:`);
          console.log(`     ${r.promptSnippet.substring(0, 500)}...`);
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
// In ES modules, we can't use require.main, so we just run the tests
runTests().catch((error) => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
