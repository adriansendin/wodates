import { defineConfig } from 'cypress';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:8081',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    env: {
      apiUrl: API_URL,
    },
    setupNodeEvents() {
      // Node event hooks can be registered here when needed.
    },
  },
  video: false,
  retries: 1,
});
