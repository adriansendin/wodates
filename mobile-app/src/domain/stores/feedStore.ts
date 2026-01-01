import { create } from 'zustand';
import { FeedCandidate } from '../entities/FeedCandidate';

interface FeedState {
  users: FeedCandidate[];
  currentIndex: number;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
}

interface FeedActions {
  setUsers: (users: FeedCandidate[]) => void;
  addUsers: (users: FeedCandidate[]) => void;
  removeUser: (userId: string) => void;
  setCurrentIndex: (index: number) => void;
  nextUser: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHasMore: (hasMore: boolean) => void;
  clearFeed: () => void;
  reset: () => void;
}

export const useFeedStore = create<FeedState & FeedActions>((set) => ({
  // State
  users: [],
  currentIndex: 0,
  isLoading: false,
  error: null,
  hasMore: true,

  // Actions
  setUsers: (users) => set({ users, currentIndex: 0 }),
  addUsers: (users) =>
    set((state) => ({
      users: [...state.users, ...users],
    })),
  removeUser: (userId) =>
    set((state) => {
      const filteredUsers = state.users.filter((user) => user.id !== userId);
      // Adjust currentIndex if we removed a user before the current position
      const removedIndex = state.users.findIndex((user) => user.id === userId);
      const newIndex =
        removedIndex >= 0 && removedIndex < state.currentIndex
          ? Math.max(0, state.currentIndex - 1)
          : state.currentIndex;
      return {
        users: filteredUsers,
        currentIndex: newIndex,
      };
    }),
  setCurrentIndex: (currentIndex) => set({ currentIndex }),
  nextUser: () =>
    set((state) => ({
      currentIndex: state.currentIndex + 1,
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setHasMore: (hasMore) => set({ hasMore }),
  clearFeed: () => set({ users: [], currentIndex: 0 }),
  reset: () =>
    set({
      users: [],
      currentIndex: 0,
      isLoading: false,
      error: null,
      hasMore: true,
    }),
}));
