import { beforeEach, describe, expect, it } from '@jest/globals';
import { useFeedStore } from '../../../../domain/stores/feedStore';
import { FeedCandidate } from '../../../../domain/entities/FeedCandidate';

const candidate = (id: string, name: string): FeedCandidate => ({
  id,
  name,
});

const resetStore = () => {
  useFeedStore.setState({
    users: [],
    currentIndex: 0,
    isLoading: false,
    error: null,
    hasMore: true,
  });
};

describe('feedStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('replaces the candidates list and resets the index', () => {
    const { setUsers } = useFeedStore.getState();
    setUsers([
      candidate('11111111-1111-1111-1111-111111111111', 'Alice'),
      candidate('22222222-2222-2222-2222-222222222222', 'Bob'),
    ]);

    const state = useFeedStore.getState();
    expect(state.users).toHaveLength(2);
    expect(state.currentIndex).toBe(0);
  });

  it('appends additional candidates without resetting the index', () => {
    const { setUsers, addUsers } = useFeedStore.getState();
    setUsers([candidate('11111111-1111-1111-1111-111111111111', 'Alice')]);
    addUsers([candidate('33333333-3333-3333-3333-333333333333', 'Carol')]);

    const state = useFeedStore.getState();
    expect(state.users).toHaveLength(2);
    expect(state.users.map((user) => user.name)).toEqual(['Alice', 'Carol']);
  });

  it('increments the index when consuming the feed', () => {
    const { setUsers, nextUser, setCurrentIndex } = useFeedStore.getState();
    setUsers([
      candidate('11111111-1111-1111-1111-111111111111', 'Alice'),
      candidate('22222222-2222-2222-2222-222222222222', 'Bob'),
    ]);

    nextUser();
    let state = useFeedStore.getState();
    expect(state.currentIndex).toBe(1);

    setCurrentIndex(0);
    state = useFeedStore.getState();
    expect(state.currentIndex).toBe(0);
  });

  it('updates loading, error and hasMore flags', () => {
    const { setLoading, setError, setHasMore, clearFeed } = useFeedStore.getState();
    setLoading(true);
    setError('timeout');
    setHasMore(false);

    let state = useFeedStore.getState();
    expect(state.isLoading).toBe(true);
    expect(state.error).toBe('timeout');
    expect(state.hasMore).toBe(false);

    clearFeed();
    state = useFeedStore.getState();
    expect(state.users).toEqual([]);
    expect(state.currentIndex).toBe(0);
  });

  it('resets the store to the initial state', () => {
    const { setUsers, nextUser, reset } = useFeedStore.getState();
    setUsers([candidate('11111111-1111-1111-1111-111111111111', 'Alice')]);
    nextUser();

    reset();

    const state = useFeedStore.getState();
    expect(state).toMatchObject({
      users: [],
      currentIndex: 0,
      isLoading: false,
      error: null,
      hasMore: true,
    });
  });
});

