/**
 * Test data for Process 1 MAIN marking tests
 * Contains sample users, messages, and expected outputs
 */

export const TEST_USER_ID = 'test-user-123';
export const TEST_OTHER_USER_ID = 'test-other-user-456';
export const TEST_DOC_LOVE_USER_ID = 'doc-love-user-id';

export const TEST_USERS = {
  mainUser: {
    id: TEST_USER_ID,
    name: 'Adrian',
    bio: 'Test bio',
    birthDate: '1990-01-01',
    isBot: false,
  },
  otherUser: {
    id: TEST_OTHER_USER_ID,
    name: 'Laura',
    bio: 'Other user bio',
    birthDate: '1992-05-15',
    isBot: false,
  },
  docLoveUser: {
    id: TEST_DOC_LOVE_USER_ID,
    name: 'Doc Love',
    bio: 'AI assistant',
    birthDate: null,
    isBot: true,
  },
};

/**
 * Test cases for name variations (to test case-insensitive comparison)
 */
export const NAME_VARIATIONS = {
  exact: 'Adrian',
  lowercase: 'adrian',
  uppercase: 'ADRIAN',
  mixedCase: 'AdRiAn',
  withSpaces: '  Adrian  ',
  differentName: 'María',
};

/**
 * Sample messages for testing
 */
export const SAMPLE_MESSAGES = {
  // Messages from main user
  mainUserMessages: [
    {
      id: 'msg-1',
      senderId: TEST_USER_ID,
      content: 'Me gusta el queso',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'msg-2',
      senderId: TEST_USER_ID,
      content: 'Prefiero la comida italiana',
      createdAt: new Date('2024-01-01T10:05:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'msg-3',
      senderId: TEST_USER_ID,
      content: 'Me encanta viajar',
      createdAt: new Date('2024-01-01T10:10:00Z'),
      profileProcessedAt: null,
    },
  ],
  // Messages from other user
  otherUserMessages: [
    {
      id: 'msg-4',
      senderId: TEST_OTHER_USER_ID,
      content: 'A mí me gusta el jamón',
      createdAt: new Date('2024-01-01T10:02:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'msg-5',
      senderId: TEST_OTHER_USER_ID,
      content: 'Yo prefiero la comida española',
      createdAt: new Date('2024-01-01T10:07:00Z'),
      profileProcessedAt: null,
    },
  ],
  // Messages from Doc Love (conversation needs messages from both users)
  docLoveMessages: [
    {
      id: 'msg-6',
      senderId: TEST_DOC_LOVE_USER_ID,
      content: '¿Qué tipo de comida prefieres?',
      createdAt: new Date('2024-01-01T10:01:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'msg-8',
      senderId: TEST_USER_ID, // Main user responds to Doc Love
      content: 'Me gusta la comida mediterránea',
      createdAt: new Date('2024-01-01T10:03:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'msg-7',
      senderId: TEST_DOC_LOVE_USER_ID,
      content: 'Cuéntame más sobre tus gustos',
      createdAt: new Date('2024-01-01T10:06:00Z'),
      profileProcessedAt: null,
    },
  ],
};

/**
 * Expected prompt patterns for verification
 * Note: Patterns are flexible to handle case variations and whitespace
 */
export const EXPECTED_PROMPT_PATTERNS = {
  // Main user with (MAIN) - case insensitive, allows whitespace
  mainUserWithMain: /Adrian\s+\(MAIN\):/i,
  // Main user without (MAIN) - should NOT match when MAIN is present
  mainUserWithoutMain: /^Adrian\s*:\s*(?!.*\(MAIN\))/m,
  // Other user without (MAIN)
  otherUserWithoutMain: /^Laura\s*:/m,
  // Doc Love without (MAIN)
  docLoveWithoutMain: /^Doc Love\s*:/m,
  // Variations
  mainUserVariations: {
    lowercase: /adrian\s+\(MAIN\):/i,
    uppercase: /ADRIAN\s+\(MAIN\):/i,
    mixedCase: /AdRiAn\s+\(MAIN\):/i,
    withSpaces: /\s+Adrian\s+\s+\(MAIN\):/i,
  },
};

/**
 * Helper to create a match object for testing
 */
export function createTestMatch(
  otherUserId: string,
  otherUserName: string,
  isDocLove: boolean = false
) {
  return {
    id: `match-${otherUserId}`,
    userId1: TEST_USER_ID,
    userId2: otherUserId,
    createdAt: new Date('2024-01-01T09:00:00Z'),
    isDocLove,
  };
}

/**
 * Helper to create all messages for a conversation (sorted by timestamp)
 */
export function createConversationMessages(
  mainUserMsgs: typeof SAMPLE_MESSAGES.mainUserMessages,
  otherUserMsgs: typeof SAMPLE_MESSAGES.otherUserMessages
) {
  return [...mainUserMsgs, ...otherUserMsgs].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
}

