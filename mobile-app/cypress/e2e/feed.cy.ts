describe('Feed and interactions', () => {
  it('lets the user browse suggestions and reach the empty state', () => {
    const feedResponse = {
      users: [
        {
          id: '44444444-4444-4444-4444-444444444441',
          name: 'Alex Runner',
          age: 30,
          gender: 'male' as const,
          photoUrl: null,
          bio: 'Trail running enthusiast.',
          location: {
            latitude: 41.3874,
            longitude: 2.1686,
            city: 'Barcelona',
            country: 'Spain',
          },
        },
        {
          id: '44444444-4444-4444-4444-444444444442',
          name: 'Marta Foodie',
          age: 28,
          gender: 'female' as const,
          photoUrl: null,
          bio: 'Chef in the making.',
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

    cy.uiLogin({ feedResponse });

    cy.contains('Alex Runner').should('be.visible');

    cy.intercept('POST', '**/passes', {
      statusCode: 200,
      body: {
        action: 'pass',
        result: { skipped: true },
      },
    }).as('passUser');

    cy.get('[aria-label="Ignorar perfil"]').click();
    cy.wait('@passUser');
    cy.contains('Marta Foodie').should('be.visible');

    cy.get('[aria-label="Ignorar perfil"]').click();
    cy.contains('No more users to show').should('be.visible');
  });

  it('creates a match from the feed and enables chatting', () => {
    const matchId = '55555555-5555-5555-5555-555555555555';
    const feedResponse = {
      users: [
        {
          id: '66666666-6666-6666-6666-666666666666',
          name: 'Sofia Talks',
          age: 27,
          gender: 'female' as const,
          bio: 'Community builder and climber.',
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

    cy.uiLogin({ feedResponse });

    const likeResponse = {
      action: 'like',
      result: {
        id: matchId,
        userId1: '11111111-1111-1111-1111-111111111111',
        userId2: feedResponse.users[0].id,
        createdAt: '2024-01-02T00:00:00.000Z',
      },
      isMatch: true,
    };

    cy.intercept('POST', '**/likes', {
      statusCode: 200,
      body: likeResponse,
    }).as('likeUser');

    const existingMessage = {
      id: '77777777-7777-7777-7777-777777777777',
      matchId,
      senderId: feedResponse.users[0].id,
      content: 'Hola, encantada de conocerte!',
      createdAt: '2024-01-03T10:00:00.000Z',
    };

    cy.intercept('GET', `**/chats/${matchId}/messages**`, {
      statusCode: 200,
      body: {
        messages: [existingMessage],
        pagination: {
          limit: 50,
          hasMore: false,
        },
      },
    }).as('initialMessages');

    cy.intercept('POST', `**/chats/${matchId}/messages`, (req) => {
      const content = (req.body as { content: string }).content;
      req.reply({
        statusCode: 200,
        body: {
          message: {
            id: '88888888-8888-8888-8888-888888888888',
            matchId,
            senderId: '11111111-1111-1111-1111-111111111111',
            content,
            createdAt: '2024-01-03T10:05:00.000Z',
          },
        },
      });
    }).as('sendMessage');

    const alerts: string[] = [];
    cy.on('window:alert', (text) => {
      alerts.push(text);
    });

    cy.get('[aria-label="Dar like al perfil"]').click();
    cy.wait('@likeUser');

    cy.location('pathname', { timeout: 10000 }).should('include', `/chat/${matchId}`);
    cy.wait('@initialMessages');
    cy.contains(existingMessage.content).should('be.visible');

    const reply = 'Hola Sofia, gracias por tu mensaje!';
    cy.get('[placeholder="Type a message..."]').type(reply);
    cy.contains('Send').click();

    cy.wait('@sendMessage');
    cy.contains(reply).should('be.visible');

    cy.wrap(alerts).should((messages) => {
      expect(messages.join(' ')).to.include('You and this person liked each other');
    });
  });
});
