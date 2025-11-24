import { create } from 'zustand';
import { Match } from '../entities/Match';
import { User } from '../entities/User';
import { Message } from '../entities/Message';

export type MatchUser = Pick<User, 'id' | 'name'> &
  Partial<User> & {
    isBot?: boolean;
  };

export interface MatchWithUser extends Match {
  otherUser: MatchUser;
  lastMessage?: Message;
  unreadCount: number;
}

interface MatchesState {
  matches: MatchWithUser[];
  activeChatsCount: number;
  isLoading: boolean;
  error: string | null;
}

interface MatchesActions {
  setMatches: (matches: MatchWithUser[]) => void;
  setActiveChatsCount: (count: number) => void;
  addMatch: (match: MatchWithUser) => void;
  updateMatch: (matchId: string, updates: Partial<MatchWithUser>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

const lastInteractionAt = (match: MatchWithUser) => {
  const reference = match.lastMessage?.createdAt ?? match.createdAt;
  return new Date(reference).getTime();
};

const sortMatches = (matches: MatchWithUser[]) =>
  [...matches].sort((a, b) => lastInteractionAt(b) - lastInteractionAt(a));

export const useMatchesStore = create<MatchesState & MatchesActions>((set) => ({
  // State
  matches: [],
  activeChatsCount: 0,
  isLoading: false,
  error: null,

  // Actions
  setMatches: (matches) => set({ matches: sortMatches(matches) }),
  setActiveChatsCount: (count) => set({ activeChatsCount: count }),
  addMatch: (match) =>
    set((state) => {
      const exists = state.matches.some((existing) => existing.id === match.id);

      const updatedMatches = exists
        ? state.matches.map((existing) =>
            existing.id === match.id ? { ...existing, ...match } : existing
          )
        : [...state.matches, match];

      return {
        matches: sortMatches(updatedMatches),
      };
    }),
  updateMatch: (matchId, updates) =>
    set((state) => ({
      matches: sortMatches(
        state.matches.map((match) =>
          match.id === matchId ? { ...match, ...updates } : match
        )
      ),
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  reset: () =>
    set({
      matches: [],
      activeChatsCount: 0,
      isLoading: false,
      error: null,
    }),
}));
