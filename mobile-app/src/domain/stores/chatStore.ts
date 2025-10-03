import { create } from 'zustand';
import { Message } from '../entities/Message';
import { Result } from '../Result';
import { DomainError } from '../errors/DomainError';

interface ChatState {
  messages: Record<string, Message[]>; // matchId -> messages
  isLoading: boolean;
  error: string | null;
  isSending: boolean;
}

interface ChatActions {
  setMessages: (matchId: string, messages: Message[]) => void;
  addMessage: (matchId: string, message: Message) => void;
  addMessages: (matchId: string, messages: Message[]) => void;
  setLoading: (loading: boolean) => void;
  setSending: (sending: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  clearMessages: (matchId: string) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  // State
  messages: {},
  isLoading: false,
  error: null,
  isSending: false,

  // Actions
  setMessages: (matchId, messages) => set((state) => ({
    messages: {
      ...state.messages,
      [matchId]: messages
    }
  })),
  addMessage: (matchId, message) => set((state) => ({
    messages: {
      ...state.messages,
      [matchId]: [...(state.messages[matchId] || []), message]
    }
  })),
  addMessages: (matchId, messages) => set((state) => ({
    messages: {
      ...state.messages,
      [matchId]: [...(state.messages[matchId] || []), ...messages]
    }
  })),
  setLoading: (isLoading) => set({ isLoading }),
  setSending: (isSending) => set({ isSending }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  clearMessages: (matchId) => set((state) => {
    const newMessages = { ...state.messages };
    delete newMessages[matchId];
    return { messages: newMessages };
  }),
  reset: () => set({ 
    messages: {}, 
    isLoading: false, 
    error: null, 
    isSending: false 
  }),
}));
