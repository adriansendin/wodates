import { beforeEach, describe, expect, it } from '@jest/globals';
import { useChatStore } from '../../../../domain/stores/chatStore';
import { Message } from '../../../../domain/entities/Message';

const MATCH_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MATCH_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const message = (id: string, matchId: string, createdAt: string): Message => ({
  id,
  matchId,
  senderId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  content: `message-${id}`,
  createdAt,
});

const resetStore = () => {
  useChatStore.setState({
    messages: {},
    isLoading: false,
    error: null,
    isSending: false,
  });
};

describe('chatStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('stores messages by match identifier', () => {
    const { setMessages } = useChatStore.getState();

    setMessages(MATCH_A, [message('1', MATCH_A, '2024-01-01T00:00:00.000Z')]);

    const state = useChatStore.getState();
    expect(state.messages[MATCH_A]).toHaveLength(1);
    expect(state.messages[MATCH_B]).toBeUndefined();
  });

  it('appends single and multiple messages', () => {
    const { setMessages, addMessage, addMessages } = useChatStore.getState();
    setMessages(MATCH_A, [message('1', MATCH_A, '2024-01-01T00:00:00.000Z')]);

    addMessage(MATCH_A, message('2', MATCH_A, '2024-01-01T00:01:00.000Z'));
    addMessages(MATCH_A, [
      message('3', MATCH_A, '2024-01-01T00:02:00.000Z'),
      message('4', MATCH_A, '2024-01-01T00:03:00.000Z'),
    ]);

    const state = useChatStore.getState();
    expect(state.messages[MATCH_A]).toHaveLength(4);
    expect(state.messages[MATCH_A]?.map((m) => m.id)).toEqual(['1', '2', '3', '4']);
  });

  it('removes messages for a match and can reset the store', () => {
    const { setMessages, clearMessages, reset } = useChatStore.getState();
    setMessages(MATCH_A, [message('1', MATCH_A, '2024-01-01T00:00:00.000Z')]);

    clearMessages(MATCH_A);
    let state = useChatStore.getState();
    expect(state.messages[MATCH_A]).toBeUndefined();

    reset();
    state = useChatStore.getState();
    expect(state.messages).toEqual({});
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.isSending).toBe(false);
  });

  it('tracks loading, sending and error flags', () => {
    const { setLoading, setSending, setError, clearError } = useChatStore.getState();

    setLoading(true);
    setSending(true);
    setError('network error');
    let state = useChatStore.getState();
    expect(state.isLoading).toBe(true);
    expect(state.isSending).toBe(true);
    expect(state.error).toBe('network error');

    setLoading(false);
    setSending(false);
    clearError();
    state = useChatStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.isSending).toBe(false);
    expect(state.error).toBeNull();
  });
});

