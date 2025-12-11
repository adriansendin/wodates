/// <reference types="cypress" />

type Gender = 'male' | 'female' | 'non_binary';

interface Location {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
}

interface UserResponse {
  id: string;
  email: string;
  name: string;
  birthDate: string;
  gender: Gender;
  bio?: string | null;
  photoUrl?: string | null;
  location?: Location;
  createdAt: string;
  updatedAt: string;
}

interface FeedCandidateResponse {
  id: string;
  name: string;
  age?: number | null;
  birthDate?: string | null;
  gender?: Gender | null;
  photoUrl?: string | null;
  bio?: string | null;
  location?: Location | null;
}

interface FeedResponse {
  users: FeedCandidateResponse[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface MatchesResponse {
  matches: Array<Record<string, unknown>>;
}

interface UiLoginOptions {
  email?: string;
  password?: string;
  user?: Partial<UserResponse>;
  token?: string;
  feedResponse?: FeedResponse;
  matchesResponse?: MatchesResponse;
}

const defaultUser: UserResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'patricia.tester@wodates.test',
  name: 'Patricia Tester',
  birthDate: '1995-06-15T00:00:00.000Z',
  gender: 'female',
  bio: 'Loves testing delightful experiences.',
  photoUrl: null,
  location: {
    latitude: 40.4168,
    longitude: -3.7038,
    city: 'Madrid',
    country: 'Spain',
  },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const defaultFeedResponse: FeedResponse = {
  users: [],
  pagination: {
    limit: 10,
    offset: 0,
    hasMore: false,
  },
};

const defaultMatchesResponse: MatchesResponse = {
  matches: [],
};

Cypress.Commands.add('uiLogin', (options: UiLoginOptions = {}) => {
  const {
    email,
    password = 'SuperSecret1!',
    user: userOverride = {},
    token = 'test-access-token',
    feedResponse = defaultFeedResponse,
    matchesResponse = defaultMatchesResponse,
  } = options;

  const resolvedUser: UserResponse = {
    ...defaultUser,
    ...userOverride,
  };

  if (email) {
    resolvedUser.email = email;
  }

  cy.intercept('POST', '**/auth/login', {
    statusCode: 200,
    body: {
      user: resolvedUser,
      token,
    },
  }).as('loginRequest');

  cy.intercept('GET', '**/feed*', {
    statusCode: 200,
    body: feedResponse,
  }).as('feedRequest');

  cy.intercept('GET', '**/matches', {
    statusCode: 200,
    body: matchesResponse,
  });

  cy.visit('/(auth)/login');
  cy.get('input[placeholder="Email"]').type(resolvedUser.email);
  cy.get('input[placeholder="Password"]').type(password, { log: false });
  cy.contains('Login').click();

  cy.wait('@loginRequest');
  
  // Only wait for feed request if we're navigating to the feed
  if (feedResponse !== defaultFeedResponse) {
    cy.wait('@feedRequest');
    cy.location('pathname', { timeout: 10000 }).should((pathname) => {
      expect(['/(app)/feed', '/feed']).to.include(pathname);
    });
  } else {
    // For non-feed tests, just wait for navigation to complete
    cy.location('pathname', { timeout: 10000 }).should('not.include', '/login');
  }
});

Cypress.Commands.add('setAuthState', (user: Partial<UserResponse> = {}, token: string = 'test-access-token') => {
  const resolvedUser: UserResponse = {
    ...defaultUser,
    ...user,
  };

  // Set the auth state in localStorage to simulate being logged in
  cy.window().then((win) => {
    const authState = {
      state: {
        user: resolvedUser,
        tokens: {
          accessToken: token,
          refreshToken: token,
          expiresIn: 7 * 24 * 60 * 60,
        },
        isLoading: false,
        error: null,
      },
      version: 0,
    };
    win.localStorage.setItem('auth-storage', JSON.stringify(authState));
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Logs a user in through the UI using stubbed API responses.
       */
      uiLogin(options?: UiLoginOptions): Chainable<void>;
      /**
       * Sets the auth state directly in localStorage without going through the login flow.
       */
      setAuthState(user?: Partial<UserResponse>, token?: string): Chainable<void>;
    }
  }
}

export {};
