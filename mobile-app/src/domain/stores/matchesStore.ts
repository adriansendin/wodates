import { create } from 'zustand';
import { Match } from '../entities/Match';
import { User } from '../entities/User';
import { Message } from '../entities/Message';

interface MatchWithUser extends Match {
  otherUser: User;
  lastMessage?: Message;
  unreadCount: number;
}

interface MatchesState {
  matches: MatchWithUser[];
  isLoading: boolean;
  error: string | null;
}

interface MatchesActions {
  setMatches: (matches: MatchWithUser[]) => void;
  addMatch: (match: MatchWithUser) => void;
  updateMatch: (matchId: string, updates: Partial<MatchWithUser>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

export const useMatchesStore = create<MatchesState & MatchesActions>((set, get) => ({
  // State
  matches: [],
  isLoading: false,
  error: null,

  // Actions
  setMatches: (matches) => set({ matches }),
  addMatch: (match) => set((state) => ({ 
    matches: [...state.matches, match] 
  })),
  updateMatch: (matchId, updates) => set((state) => ({
    matches: state.matches.map(match => 
      match.id === matchId ? { ...match, ...updates } : match
    )
  })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  reset: () => set({ 
    matches: [], 
    isLoading: false, 
    error: null 
  }),
}));
