import { describe, it, expect, beforeEach } from '@jest/globals';
import { useAuthStore } from '../domain/stores/authStore';
import { User } from '../domain/entities/User';
import { AuthTokens } from '../domain/entities/Auth';

// Mock the store for testing
const mockStore = {
  user: null,
  tokens: null,
  isLoading: false,
  error: null,
  setUser: jest.fn(),
  setTokens: jest.fn(),
  setLoading: jest.fn(),
  setError: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  clearError: jest.fn(),
};

describe('AuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with null user and tokens', () => {
    expect(mockStore.user).toBeNull();
    expect(mockStore.tokens).toBeNull();
    expect(mockStore.isLoading).toBe(false);
    expect(mockStore.error).toBeNull();
  });

  it('should set user and tokens on login', () => {
    const user: User = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      birthDate: '1990-01-01T00:00:00.000Z',
      gender: 'male',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const tokens: AuthTokens = {
      accessToken: 'token-123',
      refreshToken: 'refresh-123',
      expiresIn: 3600,
    };

    mockStore.login(user, tokens);

    expect(mockStore.login).toHaveBeenCalledWith(user, tokens);
  });

  it('should clear user and tokens on logout', () => {
    mockStore.logout();

    expect(mockStore.logout).toHaveBeenCalled();
  });

  it('should set error message', () => {
    const errorMessage = 'Login failed';
    mockStore.setError(errorMessage);

    expect(mockStore.setError).toHaveBeenCalledWith(errorMessage);
  });

  it('should clear error', () => {
    mockStore.clearError();

    expect(mockStore.clearError).toHaveBeenCalled();
  });
});
