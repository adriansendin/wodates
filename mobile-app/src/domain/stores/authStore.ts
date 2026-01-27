import { create } from 'zustand';
import { User } from '../entities/User';
import { AuthTokens } from '../entities/Auth';
import { AsyncStorageAuthRepository } from '../../data/repositories/AsyncStorageAuthRepository';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: (user: User, tokens: AuthTokens) => void;
  logout: () => void;
  clearError: () => void;
  restoreAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  // State
  user: null,
  tokens: null,
  isLoading: false,
  error: null,

  // Actions
  setUser: (user) => set({ user }),
  setTokens: (tokens) => set({ tokens }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  login: (user, tokens) =>
    set({
      user,
      tokens,
      error: null,
    }),

  logout: () =>
    set({
      user: null,
      tokens: null,
      error: null,
    }),

  clearError: () => set({ error: null }),

  restoreAuth: async () => {
    try {
      console.log('[AuthStore] Restoring auth state from AsyncStorage...');
      const authRepo = new AsyncStorageAuthRepository();
      const userResult = await authRepo.getUser();
      const tokensResult = await authRepo.getTokens();

      set({
        user: userResult.success ? userResult.data : null,
        tokens: tokensResult.success ? tokensResult.data : null,
        error: null,
      });

      console.log('[AuthStore] Auth state restored:', {
        hasUser: userResult.success,
        hasTokens: tokensResult.success,
      });
    } catch (error) {
      console.error('[AuthStore] Failed to restore auth state:', error);
      set({
        user: null,
        tokens: null,
        error: 'Failed to restore authentication',
      });
    }
  },
}));
