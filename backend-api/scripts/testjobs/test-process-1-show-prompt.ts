/**
 * Test de demostración que muestra el prompt generado
 * y explica exactamente qué criterios se usan para verificar que funciona
 * 
 * Usage:
 *   npx tsx scripts/testjobs/test-process-1-show-prompt.ts
 */

import 'dotenv/config';
import { GetAllUserChats } from '../../src/domain/use-cases/chat/GetAllUserChats';
import { GetUnprocessedMessages } from '../../src/domain/use-cases/chat/GetUnprocessedMessages';
import { GenerateUserProfileFromChats } from '../../src/domain/use-cases/chat/GenerateUserProfileFromChats';
import { TEST_USER_ID } from './test-process-1-data';
import {
  MockMatchRepository,
  MockUserRepository,
  MockMessageRepository,
  MockUserAIProfileRepository,
  MockDocLoveHelper,
  MockSummarizerModel,
} from './test-process-1-helpers';
import { SCENARIO_CONFLICTING_PREFERENCES } from './test-process-1-advanced-data';

async function demonstrateTestCriteria() {
  console.log('═'.repeat(80));
  console.log('DEMOSTRACIÓN: Criterios de Verificación de Tests');
  console.log('═'.repeat(80));
  console.log('');

  // Setup
  const mockSummarizer = new MockSummarizerModel();
  const mockUserRepo = new MockUserRepository();
  const mockMessageRepo = new MockMessageRepository();
  const mockMatchRepo = new MockMatchRepository();
  const mockProfileRepo = new MockUserAIProfileRepository();
  const mockDocLoveHelper = new MockDocLoveHelper();

  // Preparar mensajes del escenario
  const allMessages: any[] = [];
  
  SCENARIO_CONFLICTING_PREFERENCES.mainUserMessages.forEach((msg) => {
    allMessages.push({
      id: msg.id,
      matchId: `match-${TEST_USER_ID}`,
      senderId: msg.senderId,
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
      profileProcessedAt: null,
    });
  });

  SCENARIO_CONFLICTING_PREFERENCES.otherUserMessages.forEach((msg) => {
    allMessages.push({
      id: msg.id,
      matchId: `match-${TEST_USER_ID}`,
      senderId: msg.senderId,
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
      profileProcessedAt: null,
    });
  });

  allMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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

  // Ejecutar
  await generateProfile.execute(TEST_USER_ID);

  // Mostrar el prompt generado
  const prompt = mockSummarizer.lastPrompt || '';
  
  console.log('═'.repeat(80));
  console.log('1. PROMPT GENERADO (lo que el LLM recibe):');
  console.log('═'.repeat(80));
  console.log(prompt);
  console.log('');

  // Mostrar criterios de verificación
  console.log('═'.repeat(80));
  console.log('2. CRITERIOS DE VERIFICACIÓN:');
  console.log('═'.repeat(80));
  console.log('');

  // Criterio 1: Verificar marcado (MAIN)
  console.log('CRITERIO 1: Verificar que los mensajes del MAIN tienen (MAIN)');
  console.log('─'.repeat(80));
  const mainUserPattern = /Adrian\s+\(MAIN\):/gi;
  const mainMatches = prompt.match(mainUserPattern);
  console.log(`Buscamos: "Adrian (MAIN):"`);
  console.log(`Encontrado: ${mainMatches ? mainMatches.length : 0} vez(ces)`);
  console.log(`Resultado: ${mainMatches && mainMatches.length > 0 ? '✅ PASÓ' : '❌ FALLÓ'}`);
  if (mainMatches) {
    mainMatches.forEach((match, i) => {
      console.log(`  ${i + 1}. ${match}`);
    });
  }
  console.log('');

  // Criterio 2: Verificar que OTHER no tiene (MAIN)
  console.log('CRITERIO 2: Verificar que los mensajes del OTHER NO tienen (MAIN)');
  console.log('─'.repeat(80));
  const otherUserWithMainPattern = /Laura\s+\(MAIN\):/gi;
  const otherWithMainMatches = prompt.match(otherUserWithMainPattern);
  console.log(`Buscamos: "Laura (MAIN):" (NO debería existir)`);
  console.log(`Encontrado: ${otherWithMainMatches ? otherWithMainMatches.length : 0} vez(ces)`);
  console.log(`Resultado: ${!otherWithMainMatches || otherWithMainMatches.length === 0 ? '✅ PASÓ' : '❌ FALLÓ (CONTAMINACIÓN)'}`);
  console.log('');

  // Criterio 3: Verificar presencia de información del MAIN
  console.log('CRITERIO 3: Verificar que el MAIN tiene su información');
  console.log('─'.repeat(80));
  const { mainUserShouldHave } = SCENARIO_CONFLICTING_PREFERENCES.expectedInPrompt;
  console.log(`Información que el MAIN debería tener: ${mainUserShouldHave.join(', ')}`);
  console.log('');
  
  mainUserShouldHave.forEach((info) => {
    const found = prompt.toLowerCase().includes(info.toLowerCase());
    console.log(`  "${info}": ${found ? '✅ Encontrado' : '❌ NO encontrado'}`);
  });
  console.log('');

  // Criterio 4: Verificar NO contaminación
  console.log('CRITERIO 4: Verificar que el MAIN NO tiene información del OTHER');
  console.log('─'.repeat(80));
  const { mainUserShouldNotHave } = SCENARIO_CONFLICTING_PREFERENCES.expectedInPrompt;
  console.log(`Información que el MAIN NO debería tener: ${mainUserShouldNotHave.join(', ')}`);
  console.log('');

  // Extraer solo la sección del MAIN user
  const mainUserSectionMatch = prompt.match(/Adrian\s+\(MAIN\):[\s\S]*?(?=Laura:|Doc Love:|$)/i);
  const mainUserSection = mainUserSectionMatch ? mainUserSectionMatch[0] : '';
  
  console.log('Sección del MAIN user extraída:');
  console.log('─'.repeat(80));
  console.log(mainUserSection);
  console.log('─'.repeat(80));
  console.log('');

  mainUserShouldNotHave.forEach((info) => {
    const foundInMainSection = mainUserSection.toLowerCase().includes(info.toLowerCase());
    const foundInFullPrompt = prompt.toLowerCase().includes(info.toLowerCase());
    
    console.log(`  "${info}":`);
    console.log(`    En TODO el prompt: ${foundInFullPrompt ? '✅ Sí' : '❌ No'} (esperado: Sí - está en mensajes de OTHER)`);
    console.log(`    En sección MAIN: ${foundInMainSection ? '❌ Sí (CONTAMINACIÓN)' : '✅ No'} (esperado: No)`);
  });
  console.log('');

  // Resumen
  console.log('═'.repeat(80));
  console.log('3. RESUMEN DE VERIFICACIÓN:');
  console.log('═'.repeat(80));
  console.log('');

  let allPassed = true;

  // Verificar criterio 1
  if (mainMatches && mainMatches.length > 0) {
    console.log('✅ Criterio 1: MAIN tiene marcado (MAIN)');
  } else {
    console.log('❌ Criterio 1: MAIN NO tiene marcado (MAIN)');
    allPassed = false;
  }

  // Verificar criterio 2
  if (!otherWithMainMatches || otherWithMainMatches.length === 0) {
    console.log('✅ Criterio 2: OTHER NO tiene marcado (MAIN)');
  } else {
    console.log('❌ Criterio 2: OTHER tiene marcado (MAIN) (CONTAMINACIÓN)');
    allPassed = false;
  }

  // Verificar criterio 3
  const allMainInfoPresent = mainUserShouldHave.every((info) => 
    prompt.toLowerCase().includes(info.toLowerCase())
  );
  if (allMainInfoPresent) {
    console.log('✅ Criterio 3: MAIN tiene toda su información');
  } else {
    console.log('❌ Criterio 3: MAIN falta información');
    allPassed = false;
  }

  // Verificar criterio 4
  const noContamination = mainUserShouldNotHave.every((info) => 
    !mainUserSection.toLowerCase().includes(info.toLowerCase())
  );
  if (noContamination) {
    console.log('✅ Criterio 4: NO hay contaminación (MAIN no tiene info del OTHER)');
  } else {
    console.log('❌ Criterio 4: HAY CONTAMINACIÓN (MAIN tiene info del OTHER)');
    allPassed = false;
  }

  console.log('');
  console.log('═'.repeat(80));
  console.log(`RESULTADO FINAL: ${allPassed ? '✅ TODOS LOS CRITERIOS PASARON' : '❌ ALGUNOS CRITERIOS FALLARON'}`);
  console.log('═'.repeat(80));
}

// Ejecutar
demonstrateTestCriteria().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

