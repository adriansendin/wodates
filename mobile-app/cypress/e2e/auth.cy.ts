describe('Authentication', () => {
  it('allows a user with valid credentials to enter the app', () => {
    const feedResponse = {
      users: [
        {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'Carla Tester',
          age: 29,
          gender: 'female' as const,
          bio: 'Runner and coffee lover.',
          photoUrl: null,
          location: {
            latitude: 40.4168,
            longitude: -3.7038,
            city: 'Madrid',
            country: 'Spain',
          },
        },
      ],
      pagination: {
        limit: 10,
        offset: 0,
        hasMore: false,
      },
    };

    cy.uiLogin({
      feedResponse,
    });

    cy.contains('Carla Tester').should('be.visible');
    cy.contains('Wodates prioriza calidad sobre cantidad. Mejora tu afinidad hablando con Doc Love').should('not.exist');
  });

  it('shows an inline error when the credentials are invalid', () => {
    const errorMessage = 'Credenciales incorrectas';

    cy.intercept('POST', '**/auth/login', {
      statusCode: 401,
      body: { message: errorMessage },
    }).as('loginRequest');

    cy.visit('/(auth)/login');
    cy.get('input[placeholder="Email"]').type('wrong@wodates.test');
    cy.get('input[placeholder="Password"]').type('invalid-password');

    cy.contains('Login').click();
    cy.wait('@loginRequest');

    cy.contains(/Credenciales incorrectas|No se pudo iniciar sesion|Unauthorized/i).should('be.visible');
    cy.location('pathname').should('match', /\/login$/);
  });
});
