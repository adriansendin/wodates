/// <reference types="cypress" />

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
  show_bio_in_feed: true,
};

const completeRegistrationSteps = () => {
  // Step 1: City selection
  cy.contains('¿Dónde vives?').should('be.visible');
  cy.contains('Madrid').click({ force: true });
  cy.get('[data-testid="continuar-step3-button"]').click({ force: true });
  cy.location('pathname').should('include', 'step4');
  
  // Step 2: Gender and Looking For (combined screen)
  cy.contains('¿Cuál es tu género?').should('be.visible');
  cy.contains('¿A quién buscas?').should('be.visible');
  // Gender is already selected by default (male), so we just need to select "Looking For"
  cy.contains('Ambos').click({ force: true });
  cy.get('[data-testid="continuar-step4-button"]').click({ force: true });
  cy.location('pathname').should('include', 'step2');
  
  // Step 3: Birth date and Age range (combined screen)
  cy.contains('¿Cuándo naciste?').should('be.visible');
  cy.contains('¿Qué rango de edad buscas?').should('be.visible');
  // Birth date and age range are already set to defaults, so we can continue
  cy.get('[data-testid="continuar-step2-button"]').click({ force: true });
  cy.location('pathname', { timeout: 10000 }).should('include', 'step1');
  cy.contains('Email').should('be.visible');

  // Step 4: Basic credentials (final step - registration happens here; only email and password)
  cy.get('input[placeholder="you@email.com"]').clear().type(registerResponse.user.email);
  cy.get('input[placeholder="Password"]').type('Password1!');
};

describe('Registration', () => {
  beforeEach(() => {
    cy.visit('/(auth)/register/step3');
    cy.contains('¿Dónde vives?').should('be.visible');
    cy.contains('Barcelona').should('be.visible');
    cy.contains('Madrid').should('be.visible');
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

    // Click "Enter Wodates" button to complete registration
    cy.contains('Enter Wodates').click({ force: true });

    cy.wait('@register');
    cy.wait('@updateProfile');
    cy.wait('@getProfile');

    cy.location('pathname', { timeout: 10000 }).should('include', '/matches');
  });

  it('shows the backend error when registration fails', () => {
    const errorMessage = 'Este correo1 ya esta registrado';

    cy.intercept('POST', '**/auth/register', {
      statusCode: 409,
      body: { message: errorMessage },
    }).as('register');

    completeRegistrationSteps();

    // Click "Enter Wodates" button to attempt registration
    cy.contains('Enter Wodates').click({ force: true });
    cy.wait('@register');

    cy.contains(errorMessage).should('be.visible');
    cy.location('pathname').should('include', '/register/step1');
  });
});
