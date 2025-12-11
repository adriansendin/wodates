/**
 * Advanced test scenarios for Process 1 MAIN marking tests
 * Contains complex conversational scenarios to verify MAIN marking prevents contamination
 */

import { TEST_USER_ID, TEST_OTHER_USER_ID, TEST_DOC_LOVE_USER_ID } from './test-process-1-data';

/**
 * Test Scenario 1: Conflicting preferences
 * MAIN says "me gusta el queso", OTHER says "me gusta el jamón"
 * Verify that jamón does NOT appear as MAIN's preference
 */
export const SCENARIO_CONFLICTING_PREFERENCES = {
  mainUserMessages: [
    {
      id: 'sc1-msg-1',
      senderId: TEST_USER_ID,
      content: 'Me gusta mucho el queso',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc1-msg-2',
      senderId: TEST_USER_ID,
      content: 'Soy vegetariano, no como carne',
      createdAt: new Date('2024-01-01T10:05:00Z'),
      profileProcessedAt: null,
    },
  ],
  otherUserMessages: [
    {
      id: 'sc1-msg-3',
      senderId: TEST_OTHER_USER_ID,
      content: 'A mí me encanta el jamón',
      createdAt: new Date('2024-01-01T10:02:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc1-msg-4',
      senderId: TEST_OTHER_USER_ID,
      content: 'Yo como carne todos los días',
      createdAt: new Date('2024-01-01T10:07:00Z'),
      profileProcessedAt: null,
    },
  ],
  expectedInPrompt: {
    mainUserShouldHave: ['queso', 'vegetariano'],
    // Note: "carne" appears in MAIN's message but in negative context ("no como carne")
    // This is valid - MAIN is expressing a preference/dislike
    mainUserShouldNotHave: ['jamón'], // Only jamón should not appear in MAIN messages
    otherUserShouldHave: ['jamón', 'carne'],
  },
};

/**
 * Test Scenario 2: Personal qualities and values
 * MAIN says "soy introvertido", OTHER says "soy extrovertido"
 * Verify that extrovertido does NOT appear as MAIN's quality
 */
export const SCENARIO_PERSONAL_QUALITIES = {
  mainUserMessages: [
    {
      id: 'sc2-msg-1',
      senderId: TEST_USER_ID,
      content: 'Soy una persona introvertida',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc2-msg-2',
      senderId: TEST_USER_ID,
      content: 'Prefiero quedarme en casa leyendo',
      createdAt: new Date('2024-01-01T10:05:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc2-msg-3',
      senderId: TEST_USER_ID,
      content: 'Valoro mucho la tranquilidad',
      createdAt: new Date('2024-01-01T10:10:00Z'),
      profileProcessedAt: null,
    },
  ],
  otherUserMessages: [
    {
      id: 'sc2-msg-4',
      senderId: TEST_OTHER_USER_ID,
      content: 'Yo soy muy extrovertida',
      createdAt: new Date('2024-01-01T10:02:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc2-msg-5',
      senderId: TEST_OTHER_USER_ID,
      content: 'Me encanta salir de fiesta todos los fines de semana',
      createdAt: new Date('2024-01-01T10:07:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc2-msg-6',
      senderId: TEST_OTHER_USER_ID,
      content: 'Necesito estar rodeada de gente constantemente',
      createdAt: new Date('2024-01-01T10:12:00Z'),
      profileProcessedAt: null,
    },
  ],
  expectedInPrompt: {
    mainUserShouldHave: ['introvertida', 'casa', 'leyendo', 'tranquilidad'],
    mainUserShouldNotHave: ['extrovertida', 'fiesta', 'gente'],
    otherUserShouldHave: ['extrovertida', 'fiesta', 'gente'],
  },
};

/**
 * Test Scenario 3: Activities and hobbies
 * MAIN says "me gusta el senderismo", OTHER says "me gusta el fútbol"
 * Verify that fútbol does NOT appear as MAIN's activity
 */
export const SCENARIO_ACTIVITIES = {
  mainUserMessages: [
    {
      id: 'sc3-msg-1',
      senderId: TEST_USER_ID,
      content: 'Me encanta hacer senderismo los fines de semana',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc3-msg-2',
      senderId: TEST_USER_ID,
      content: 'Practico yoga todas las mañanas',
      createdAt: new Date('2024-01-01T10:05:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc3-msg-3',
      senderId: TEST_USER_ID,
      content: 'Colecciono libros antiguos',
      createdAt: new Date('2024-01-01T10:10:00Z'),
      profileProcessedAt: null,
    },
  ],
  otherUserMessages: [
    {
      id: 'sc3-msg-4',
      senderId: TEST_OTHER_USER_ID,
      content: 'Yo juego al fútbol tres veces por semana',
      createdAt: new Date('2024-01-01T10:02:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc3-msg-5',
      senderId: TEST_OTHER_USER_ID,
      content: 'Soy fanática del gimnasio',
      createdAt: new Date('2024-01-01T10:07:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc3-msg-6',
      senderId: TEST_OTHER_USER_ID,
      content: 'Me encanta ver partidos de fútbol en el bar',
      createdAt: new Date('2024-01-01T10:12:00Z'),
      profileProcessedAt: null,
    },
  ],
  expectedInPrompt: {
    mainUserShouldHave: ['senderismo', 'yoga', 'libros'],
    mainUserShouldNotHave: ['fútbol', 'gimnasio', 'bar'],
    otherUserShouldHave: ['fútbol', 'gimnasio', 'bar'],
  },
};

/**
 * Test Scenario 4: Work and career
 * MAIN says "soy programador", OTHER says "soy médico"
 * Verify that médico does NOT appear as MAIN's profession
 */
export const SCENARIO_WORK_CAREER = {
  mainUserMessages: [
    {
      id: 'sc4-msg-1',
      senderId: TEST_USER_ID,
      content: 'Soy programador y trabajo desde casa',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc4-msg-2',
      senderId: TEST_USER_ID,
      content: 'Me especializo en desarrollo web',
      createdAt: new Date('2024-01-01T10:05:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc4-msg-3',
      senderId: TEST_USER_ID,
      content: 'Trabajo con tecnologías como React y Node.js',
      createdAt: new Date('2024-01-01T10:10:00Z'),
      profileProcessedAt: null,
    },
  ],
  otherUserMessages: [
    {
      id: 'sc4-msg-4',
      senderId: TEST_OTHER_USER_ID,
      content: 'Yo soy médico en un hospital',
      createdAt: new Date('2024-01-01T10:02:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc4-msg-5',
      senderId: TEST_OTHER_USER_ID,
      content: 'Trabajo en el área de cardiología',
      createdAt: new Date('2024-01-01T10:07:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc4-msg-6',
      senderId: TEST_OTHER_USER_ID,
      content: 'Tengo turnos de noche muy seguido',
      createdAt: new Date('2024-01-01T10:12:00Z'),
      profileProcessedAt: null,
    },
  ],
  expectedInPrompt: {
    mainUserShouldHave: ['programador', 'desarrollo web', 'React', 'Node.js'],
    mainUserShouldNotHave: ['médico', 'hospital', 'cardiología', 'turnos'],
    otherUserShouldHave: ['médico', 'hospital', 'cardiología', 'turnos'],
  },
};

/**
 * Test Scenario 5: Relationship preferences
 * MAIN says "busco algo serio", OTHER says "busco algo casual"
 * Verify that casual does NOT appear as MAIN's preference
 */
export const SCENARIO_RELATIONSHIP_PREFERENCES = {
  mainUserMessages: [
    {
      id: 'sc5-msg-1',
      senderId: TEST_USER_ID,
      content: 'Busco una relación seria y estable',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc5-msg-2',
      senderId: TEST_USER_ID,
      content: 'Quiero formar una familia algún día',
      createdAt: new Date('2024-01-01T10:05:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc5-msg-3',
      senderId: TEST_USER_ID,
      content: 'Valoro la fidelidad y el compromiso',
      createdAt: new Date('2024-01-01T10:10:00Z'),
      profileProcessedAt: null,
    },
  ],
  otherUserMessages: [
    {
      id: 'sc5-msg-4',
      senderId: TEST_OTHER_USER_ID,
      content: 'Yo busco algo más casual',
      createdAt: new Date('2024-01-01T10:02:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc5-msg-5',
      senderId: TEST_OTHER_USER_ID,
      content: 'No quiero compromisos por ahora',
      createdAt: new Date('2024-01-01T10:07:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc5-msg-6',
      senderId: TEST_OTHER_USER_ID,
      content: 'Prefiero mantener mi libertad',
      createdAt: new Date('2024-01-01T10:12:00Z'),
      profileProcessedAt: null,
    },
  ],
  expectedInPrompt: {
    mainUserShouldHave: ['seria', 'estable', 'familia', 'fidelidad', 'compromiso'],
    mainUserShouldNotHave: ['casual', 'compromisos', 'libertad'],
    otherUserShouldHave: ['casual', 'compromisos', 'libertad'],
  },
};

/**
 * Test Scenario 6: Mixed conversation with Doc Love
 * MAIN talks to Doc Love about preferences, OTHER user is not involved
 * Verify that only MAIN's messages are marked
 */
export const SCENARIO_DOC_LOVE_CONVERSATION = {
  mainUserMessages: [
    {
      id: 'sc6-msg-1',
      senderId: TEST_USER_ID,
      content: 'Me gusta la música clásica',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc6-msg-2',
      senderId: TEST_USER_ID,
      content: 'Prefiero los libros de ciencia ficción',
      createdAt: new Date('2024-01-01T10:05:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc6-msg-3',
      senderId: TEST_USER_ID,
      content: 'Me encanta cocinar en mi tiempo libre',
      createdAt: new Date('2024-01-01T10:10:00Z'),
      profileProcessedAt: null,
    },
  ],
  docLoveMessages: [
    {
      id: 'sc6-msg-4',
      senderId: TEST_DOC_LOVE_USER_ID,
      content: '¿Qué tipo de música te gusta?',
      createdAt: new Date('2024-01-01T10:01:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc6-msg-5',
      senderId: TEST_DOC_LOVE_USER_ID,
      content: 'Cuéntame sobre tus hobbies',
      createdAt: new Date('2024-01-01T10:06:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc6-msg-6',
      senderId: TEST_DOC_LOVE_USER_ID,
      content: '¿Qué te gusta hacer en tu tiempo libre?',
      createdAt: new Date('2024-01-01T10:11:00Z'),
      profileProcessedAt: null,
    },
  ],
  expectedInPrompt: {
    mainUserShouldHave: ['música clásica', 'libros', 'ciencia ficción', 'cocinar'],
    mainUserShouldNotHave: [],
    docLoveShouldHave: ['música', 'hobbies', 'tiempo libre'],
  },
};

/**
 * Test Scenario 7: Complex conversation with multiple topics
 * MAIN and OTHER discuss different topics, verify separation
 */
export const SCENARIO_COMPLEX_MULTI_TOPIC = {
  mainUserMessages: [
    {
      id: 'sc7-msg-1',
      senderId: TEST_USER_ID,
      content: 'Soy vegano desde hace 5 años',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc7-msg-2',
      senderId: TEST_USER_ID,
      content: 'Me encanta el arte contemporáneo',
      createdAt: new Date('2024-01-01T10:05:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc7-msg-3',
      senderId: TEST_USER_ID,
      content: 'Vivo en el centro de la ciudad',
      createdAt: new Date('2024-01-01T10:10:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc7-msg-4',
      senderId: TEST_USER_ID,
      content: 'Tengo dos gatos',
      createdAt: new Date('2024-01-01T10:15:00Z'),
      profileProcessedAt: null,
    },
  ],
  otherUserMessages: [
    {
      id: 'sc7-msg-5',
      senderId: TEST_OTHER_USER_ID,
      content: 'Yo como carne todos los días',
      createdAt: new Date('2024-01-01T10:02:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc7-msg-6',
      senderId: TEST_OTHER_USER_ID,
      content: 'Prefiero el arte clásico',
      createdAt: new Date('2024-01-01T10:07:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc7-msg-7',
      senderId: TEST_OTHER_USER_ID,
      content: 'Vivo en las afueras, en una casa con jardín',
      createdAt: new Date('2024-01-01T10:12:00Z'),
      profileProcessedAt: null,
    },
    {
      id: 'sc7-msg-8',
      senderId: TEST_OTHER_USER_ID,
      content: 'Tengo un perro grande',
      createdAt: new Date('2024-01-01T10:17:00Z'),
      profileProcessedAt: null,
    },
  ],
  expectedInPrompt: {
    mainUserShouldHave: ['vegano', 'arte contemporáneo', 'centro', 'gatos'],
    mainUserShouldNotHave: ['carne', 'arte clásico', 'afueras', 'perro'],
    otherUserShouldHave: ['carne', 'arte clásico', 'afueras', 'perro'],
  },
};

