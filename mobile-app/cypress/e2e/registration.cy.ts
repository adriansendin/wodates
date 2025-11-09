const registerResponse = {
  user: {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'new.user@wodates.test',
    name: 'New User',
    birthDate: '2000-01-01T00:00:00.000Z',
    gender: 'male',
    bio: null,
    photoUrl: null,
    location: {
      latitude: 40.4168,
      longitude: -3.7038,
      city: 'Madrid',
      country: 'Spain',
    },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  token: 'registration-access-token',
};

const profileResponse = {
  id: registerResponse.user.id,
  name: registerResponse.user.name,
  birthDate: '2000-01-01',
  gender: 'male',
  looking_for: 'both',
  min_age: 18,
  max_age: 99,
  bio: null,
  city: 'Madrid',
  avatarUrl: null,
  show_in_feed: true,
};

const completeRegistrationSteps = () => {
  // Step 1: Basic credentials
  cy.get('input[placeholder="Tu nombre"]').type(registerResponse.user.name);
  cy.get('input[placeholder="tu@email.com"]').clear().type(registerResponse.user.email);
  cy.get('input[type="password"]').type('Password1!');
  
  cy.contains('Continuar').click({ force: true });
  cy.location('pathname').should('include', 'step2');
  cy.contains('¿Cuándo naciste?').should('be.visible');

  // Step 2: Birth date (accept default date - default is already set)
  cy.get('[data-testid="continuar-step2-button"]').click({ force: true });
  cy.location('pathname', { timeout: 10000 }).should('include', 'step3');
  cy.contains('¿Dónde vives?').should('be.visible');

  // Step 3: Location
  cy.contains('Madrid').click({ force: true });
  cy.get('[data-testid="continuar-step3-button"]').click({ force: true });
  cy.location('pathname').should('include', 'step4');
  cy.contains('¿Cuál es tu género?').should('be.visible');

  // Step 4: Gender (keep default selection)
  cy.get('[data-testid="continuar-step4-button"]').click({ force: true });
  cy.location('pathname').should('include', 'step5');
  cy.contains('¿A quién buscas?').should('be.visible');

  // Step 5: Preferences (keep default selection)
  cy.get('[data-testid="continuar-step5-button"]').click({ force: true });
  cy.location('pathname').should('include', 'step6');
  cy.contains('¿Qué rango de edad buscas?').should('be.visible');

  // Step 6: Desired age range (keep defaults)
  cy.get('[data-testid="continuar-step6-button"]').click({ force: true });
  cy.location('pathname').should('include', 'step7');
  cy.contains('Añade tu foto de perfil').should('be.visible');

  // Step 7: Avatar (skip upload for web flow)
  cy.contains('Omitir por ahora').click({ force: true });
  cy.location('pathname').should('include', '/register/complete');
  cy.contains('Perfil básico completado').should('be.visible');
};

describe('Registration', () => {
  beforeEach(() => {
    cy.visit('/(auth)/register/step1');
    cy.contains('Comencemos creando tu cuenta').should('be.visible');
    cy.get('input[placeholder="Tu nombre"]').should('be.visible');
    cy.get('input[placeholder="tu@email.com"]').should('be.visible');
    cy.get('input[type="password"]').should('be.visible');
  });

  it('creates an account and redirects to the matches screen', () => {
    cy.intercept('POST', '**/auth/register', {
      statusCode: 200,
      body: registerResponse,
    }).as('register');

    cy.intercept('PUT', '**/users/me', {
      statusCode: 200,
      body: profileResponse,
    }).as('updateProfile');

    cy.intercept('GET', '**/users/me', {
      statusCode: 200,
      body: profileResponse,
    }).as('getProfile');

    completeRegistrationSteps();

    cy.get('[data-testid="complete-registration-button"]').click({ force: true });

    cy.wait('@register');
    cy.wait('@updateProfile');
    cy.wait('@getProfile');

    cy.location('pathname', { timeout: 10000 }).should('include', '/matches');
  });

  it('shows the backend error when registration fails', () => {
    const errorMessage = 'Este correo ya esta registrado';

    cy.intercept('POST', '**/auth/register', {
      statusCode: 409,
      body: { message: errorMessage },
    }).as('register');

    completeRegistrationSteps();

    cy.get('[data-testid="complete-registration-button"]').click({ force: true });
    cy.wait('@register');

    cy.contains(errorMessage).should('be.visible');
    cy.location('pathname').should('include', '/register/complete');
  });
});
