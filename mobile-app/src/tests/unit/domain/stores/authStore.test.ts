import { beforeEach, describe, expect, it } from '@jest/globals';
import { useAuthStore } from '../../../../domain/stores/authStore';
import { User } from '../../../../domain/entities/User';
import { AuthTokens } from '../../../../domain/entities/Auth';

const validUser: User = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'user@example.com',
  name: 'Test User',
  birthDate: '1990-01-01T00:00:00.000Z',
  gender: 'male',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const validTokens: AuthTokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresIn: 3600,
};

const resetStore = () => {
  useAuthStore.setState({
    user: null,
    tokens: null,
    isLoading: false,
    error: null,
  });
};

describe('authStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('initialises with empty session state', () => {
    const state = useAuthStore.getState();

    expect(state.user).toBeNull();
    expect(state.tokens).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('login stores the user and tokens and clears previous errors', () => {
    const { setError, login } = useAuthStore.getState();
    setError('previous error');

    login(validUser, validTokens);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(validUser);
    expect(state.tokens).toEqual(validTokens);
    expect(state.error).toBeNull();
  });

  it('logout clears the session data', () => {
    const { login, logout } = useAuthStore.getState();
    login(validUser, validTokens);

    logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.tokens).toBeNull();
    expect(state.error).toBeNull();
  });

  it('updates loading and error flags independently', () => {
    const { setLoading, setError } = useAuthStore.getState();

    setLoading(true);
    setError('invalid credentials');

    let state = useAuthStore.getState();
    expect(state.isLoading).toBe(true);
    expect(state.error).toBe('invalid credentials');

    const { clearError } = useAuthStore.getState();
    setLoading(false);
    clearError();

    state = useAuthStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('supports updating user and tokens individually', () => {
    const { setUser, setTokens } = useAuthStore.getState();

    setUser(validUser);
    setTokens(validTokens);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(validUser);
    expect(state.tokens).toEqual(validTokens);
  });
});
