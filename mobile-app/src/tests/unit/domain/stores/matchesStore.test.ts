import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  MatchWithUser,
  useMatchesStore,
} from '../../../../domain/stores/matchesStore';

const match = (
  id: string,
  createdAt: string,
  otherUserName: string,
  lastMessageCreatedAt?: string
): MatchWithUser => ({
  id,
  userId1: '11111111-1111-1111-1111-111111111111',
  userId2: '22222222-2222-2222-2222-222222222222',
  createdAt,
  otherUser: {
    id: `user-${id}`,
    name: otherUserName,
  },
  unreadCount: 0,
  ...(lastMessageCreatedAt && {
    lastMessage: {
      id: `message-${id}`,
      matchId: id,
      senderId: '33333333-3333-3333-3333-333333333333',
      content: 'Hello!',
      createdAt: lastMessageCreatedAt,
    },
  }),
});

const resetStore = () => {
  useMatchesStore.setState({
    matches: [],
    isLoading: false,
    error: null,
  });
};

describe('matchesStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('sorts matches by last interaction when setting the list', () => {
    const { setMatches } = useMatchesStore.getState();
    setMatches([
      match(
        '22222222-2222-2222-2222-222222222222',
        '2024-01-01T00:00:00.000Z',
        'Bob',
        '2024-01-01T01:00:00.000Z'
      ),
      match(
        '11111111-1111-1111-1111-111111111111',
        '2024-01-02T00:00:00.000Z',
        'Alice',
        '2024-01-02T01:00:00.000Z'
      ),
    ]);

    const state = useMatchesStore.getState();
    expect(state.matches.map((item) => item.otherUser.name)).toEqual([
      'Alice',
      'Bob',
    ]);
  });

  it('adds new matches while keeping the list sorted', () => {
    const { setMatches, addMatch } = useMatchesStore.getState();
    setMatches([
      match(
        '11111111-1111-1111-1111-111111111111',
        '2024-01-01T00:00:00.000Z',
        'Alice',
        '2024-01-01T01:00:00.000Z'
      ),
    ]);

    addMatch(
      match(
        '33333333-3333-3333-3333-333333333333',
        '2024-01-03T00:00:00.000Z',
        'Carol',
        '2024-01-03T02:00:00.000Z'
      )
    );

    const state = useMatchesStore.getState();
    expect(state.matches.map((item) => item.otherUser.name)).toEqual([
      'Carol',
      'Alice',
    ]);
  });

  it('merges data when adding an already existing match', () => {
    const { setMatches, addMatch } = useMatchesStore.getState();
    setMatches([
      match(
        '11111111-1111-1111-1111-111111111111',
        '2024-01-01T00:00:00.000Z',
        'Alice',
        '2024-01-01T01:00:00.000Z'
      ),
    ]);

    addMatch({
      ...match(
        '11111111-1111-1111-1111-111111111111',
        '2024-01-01T00:00:00.000Z',
        'Alice',
        '2024-01-02T01:00:00.000Z'
      ),
      unreadCount: 3,
    });

    const state = useMatchesStore.getState();
    expect(state.matches).toHaveLength(1);
    expect(state.matches[0].unreadCount).toBe(3);
    expect(state.matches[0].lastMessage?.createdAt).toBe(
      '2024-01-02T01:00:00.000Z'
    );
  });

  it('updates an existing match and keeps the ordering', () => {
    const { setMatches, updateMatch } = useMatchesStore.getState();
    setMatches([
      match(
        '11111111-1111-1111-1111-111111111111',
        '2024-01-01T00:00:00.000Z',
        'Alice',
        '2024-01-01T01:00:00.000Z'
      ),
      match(
        '22222222-2222-2222-2222-222222222222',
        '2024-01-02T00:00:00.000Z',
        'Bob',
        '2024-01-02T01:00:00.000Z'
      ),
    ]);

    updateMatch('11111111-1111-1111-1111-111111111111', {
      lastMessage: {
        id: 'message-new',
        matchId: '11111111-1111-1111-1111-111111111111',
        senderId: '33333333-3333-3333-3333-333333333333',
        content: 'Update',
        createdAt: '2024-01-03T00:00:00.000Z',
      },
      unreadCount: 5,
    });

    const state = useMatchesStore.getState();
    expect(state.matches[0].otherUser.name).toBe('Alice');
    expect(state.matches[0].unreadCount).toBe(5);
  });

  it('handles loading and error state as well as reset', () => {
    const { setLoading, setError, clearError, reset } =
      useMatchesStore.getState();

    setLoading(true);
    setError('something went wrong');

    let state = useMatchesStore.getState();
    expect(state.isLoading).toBe(true);
    expect(state.error).toBe('something went wrong');

    clearError();
    reset();
    state = useMatchesStore.getState();
    expect(state.matches).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });
});
