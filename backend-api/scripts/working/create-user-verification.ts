/**
 * Verification phase for users created by create-user.ts.
 *
 * Checks that each newly created user is in a coherent state and eligible
 * for the profile generation job, using only logical state (no SQL/table/column
 * names in the script output).
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { MessageRepository } from '../../src/domain/repositories/MessageRepository';
import { MatchRepository } from '../../src/domain/repositories/MatchRepository';
import { DocLoveHelper } from '../../src/app/services/doc-love-helper';

/** Match repository with the extra method used by the profile job. */
export type MatchRepositoryWithActiveCount = MatchRepository & {
  getActiveChatsWithRealUsersCount(userId: string): Promise<number>;
};

export type VerificationDeps = {
  adminClient: SupabaseClient;
  messageRepository: MessageRepository;
  matchRepository: MatchRepositoryWithActiveCount;
  docLoveHelper: DocLoveHelper;
};

export type VerificationResult = {
  userId: string;
  userName: string;
  checks: {
    isRealUser: boolean;
    hasUnprocessedMessages: boolean;
    unprocessedMessagesBelongToUser: boolean;
    onlyActiveChatIsWithDocLove: boolean;
    noActiveChatWithHuman: boolean;
  };
  eligible: boolean;
  reason?: string | undefined;
};

/**
 * Reads whether the user is a real user (not system, not bot).
 * Uses the admin client to read the user's bot flag.
 */
async function checkIsRealUser(
  userId: string,
  adminClient: SupabaseClient
): Promise<boolean> {
  const { data: row, error } = await adminClient
    .from('users')
    .select('is_bot')
    .eq('id', userId)
    .maybeSingle();

  if (error || row == null) {
    return false;
  }
  return row.is_bot !== true;
}

/**
 * Runs the conceptual verification for a single created user.
 * Logs each check and returns a structured result.
 */
export async function runVerificationForUser(
  userId: string,
  userName: string,
  deps: VerificationDeps
): Promise<VerificationResult> {
  const { adminClient, messageRepository, matchRepository, docLoveHelper } =
    deps;

  const checks = {
    isRealUser: false,
    hasUnprocessedMessages: false,
    unprocessedMessagesBelongToUser: false,
    onlyActiveChatIsWithDocLove: false,
    noActiveChatWithHuman: false,
  };

  // 1. Es un usuario real (no sistema, no bot)
  checks.isRealUser = await checkIsRealUser(userId, adminClient);

  // 2. Tiene mensajes propios pendientes de ser analizados para su perfil
  const unprocessedResult = await messageRepository.findUnprocessedBySenderId(
    userId,
    500
  );
  const unprocessedMessages =
    unprocessedResult.success && unprocessedResult.data
      ? unprocessedResult.data
      : [];
  checks.hasUnprocessedMessages = unprocessedMessages.length > 0;

  // 3. Esos mensajes pertenecen únicamente al propio usuario
  checks.unprocessedMessagesBelongToUser =
    unprocessedMessages.length > 0 &&
    unprocessedMessages.every((m) => m.senderId === userId);

  // 4. Su único chat activo es con el chatbot (Doc Love)
  const docLoveId = await docLoveHelper.getDocLoveUserId();
  const matchesResult = await matchRepository.findByUserId(userId);
  const matches =
    matchesResult.success && matchesResult.data ? matchesResult.data : [];
  const firstMatch = matches[0];
  const onlyChatIsWithDocLove =
    matches.length === 1 &&
    firstMatch !== undefined &&
    (firstMatch.userId1 === docLoveId || firstMatch.userId2 === docLoveId);
  checks.onlyActiveChatIsWithDocLove = onlyChatIsWithDocLove;

  // 5. No tiene ninguna conversación activa con otro usuario humano
  const activeChatsWithRealUsers =
    await matchRepository.getActiveChatsWithRealUsersCount(userId);
  checks.noActiveChatWithHuman = activeChatsWithRealUsers === 0;

  const allPassed =
    checks.isRealUser &&
    checks.hasUnprocessedMessages &&
    checks.unprocessedMessagesBelongToUser &&
    checks.onlyActiveChatIsWithDocLove &&
    checks.noActiveChatWithHuman;

  let reason: string | undefined;
  if (!allPassed) {
    if (!checks.isRealUser)
      reason = 'el usuario no es un usuario real (sistema o bot)';
    else if (!checks.hasUnprocessedMessages)
      reason = 'no tiene mensajes pendientes de análisis para su perfil';
    else if (!checks.unprocessedMessagesBelongToUser)
      reason =
        'los mensajes pendientes no pertenecen únicamente al propio usuario';
    else if (!checks.onlyActiveChatIsWithDocLove)
      reason =
        'su único chat activo no es con el chatbot Doc Love (hay más chats o no es con Doc Love)';
    else if (!checks.noActiveChatWithHuman)
      reason =
        'tiene al menos una conversación activa con otro usuario humano';
  }

  return {
    userId,
    userName,
    checks,
    eligible: allPassed,
    reason,
  };
}

/**
 * Logs verification result to console (one line per check, then summary).
 */
export function logVerificationResult(result: VerificationResult): void {
  const { userId, userName, checks, eligible, reason } = result;

  console.log('\n   ─── Verificación conceptual ───');
  console.log(`   Usuario: ${userName} (ID: ${userId})`);
  console.log('');
  console.log(
    `   1. Es un usuario real (no sistema, no bot) ...................... ${checks.isRealUser ? '✔️ cumple' : '❌ no cumple'}`
  );
  console.log(
    `   2. Tiene mensajes pendientes de análisis para su perfil ........... ${checks.hasUnprocessedMessages ? '✔️ cumple' : '❌ no cumple'}`
  );
  console.log(
    `   3. Esos mensajes pertenecen únicamente al propio usuario .......... ${checks.unprocessedMessagesBelongToUser ? '✔️ cumple' : '❌ no cumple'}`
  );
  console.log(
    `   4. Su único chat activo es con el chatbot (Doc Love) .............. ${checks.onlyActiveChatIsWithDocLove ? '✔️ cumple' : '❌ no cumple'}`
  );
  console.log(
    `   5. No tiene conversación activa con otro usuario humano ........... ${checks.noActiveChatWithHuman ? '✔️ cumple' : '❌ no cumple'}`
  );
  console.log('');
  if (eligible) {
    console.log(
      '   ► Este usuario debería ser procesado por el job de generación de perfil.'
    );
  } else {
    console.log(
      `   ► Este usuario no debería ser procesado por el job, y el motivo es: ${reason ?? 'desconocido'}.`
    );
  }
  console.log('');
}
