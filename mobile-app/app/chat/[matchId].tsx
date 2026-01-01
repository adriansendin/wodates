import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Global counter to track component instances
let globalComponentCounter = 0;
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Keyboard,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiClient } from '../../src/data/api/apiClient';
import { ChatApi } from '../../src/data/api/chatApi';
import { BlockApi } from '../../src/data/api/blockApi';
import { MatchApi } from '../../src/data/api/matchApi';
import { useAuthStore } from '../../src/domain/stores/authStore';
import { useChatStore } from '../../src/domain/stores/chatStore';
import { Message, MessageSchema } from '../../src/domain/entities/Message';
import { useMatchesStore } from '../../src/domain/stores/matchesStore';
import { z } from 'zod';

import { pickZipFile, uploadZipFile } from '../../src/data/api/zipUploadService';

// More lenient message schema for displaying messages - allows longer content
// The backend may return messages that exceed the normal 1000 char limit
const DisplayMessageSchema = MessageSchema.extend({
  content: z.string().min(1), // Remove max(1000) restriction for display purposes
});

import { getApiUrl } from '../../src/utils/apiConfig';

const API_URL = getApiUrl();

// Simple global flag to prevent any duplicate API calls during the entire chat session
const activeChatSession = {
  matchId: null as string | null,
  isActive: false,
  lastMessageLoad: 0,
  markedAsRead: false,

  startSession(matchId: string): boolean {
    const now = Date.now();
    console.log(`[ChatSession] startSession called at ${new Date(now).toISOString()}, requested: ${matchId}, current: ${this.matchId}, isActive: ${this.isActive}`);

    if (this.isActive && this.matchId === matchId) {
      console.log(`[ChatSession] Session already active for ${matchId} - BLOCKING`);
      return false; // Already active for this matchId
    }

    if (this.isActive && this.matchId !== matchId) {
      console.log(`[ChatSession] Switching from ${this.matchId} to ${matchId}`);
      this.endSession();
    }

    this.matchId = matchId;
    this.isActive = true;
    this.lastMessageLoad = 0;
    this.markedAsRead = false;
    console.log(`[ChatSession] STARTED NEW SESSION for ${matchId} at ${new Date(now).toISOString()}`);
    return true;
  },

  canLoadMessages(): boolean {
    const now = Date.now();
    console.log(`[ChatSession] canLoadMessages called at ${new Date(now).toISOString()}, isActive: ${this.isActive}, matchId: ${this.matchId}`);

    if (!this.isActive) {
      console.log(`[ChatSession] BLOCKED - session not active`);
      return false;
    }

    const timeSinceLastLoad = now - this.lastMessageLoad;
    if (timeSinceLastLoad < 2000) { // 2 seconds minimum between loads
      console.log(`[ChatSession] BLOCKED - only ${timeSinceLastLoad}ms since last load (need 2000ms)`);
      return false;
    }

    console.log(`[ChatSession] ALLOWED - time since last load: ${timeSinceLastLoad}ms`);
    return true;
  },

  markMessageLoad(): void {
    const now = Date.now();
    this.lastMessageLoad = now;
    console.log(`[ChatSession] Marked message load at ${new Date(now).toISOString()}`);
  },

  canMarkAsRead(): boolean {
    if (!this.isActive || this.markedAsRead) {
      console.log(`[ChatSession] Cannot mark as read: active=${this.isActive}, alreadyMarked=${this.markedAsRead}`);
      return false;
    }
    return true;
  },

  markAsReadDone(): void {
    this.markedAsRead = true;
    console.log(`[ChatSession] Marked as read for ${this.matchId}`);
  },

  endSession(): void {
    const now = Date.now();
    if (this.matchId) {
      console.log(`[ChatSession] ENDING SESSION for ${this.matchId} at ${new Date(now).toISOString()}`);
    } else {
      console.log(`[ChatSession] ENDING SESSION (no active matchId) at ${new Date(now).toISOString()}`);
    }
    this.matchId = null;
    this.isActive = false;
    this.lastMessageLoad = 0;
    this.markedAsRead = false;
    console.log(`[ChatSession] Session ended - state reset`);
  }
};

// Función para formatear la fecha según las especificaciones
const formatDateSeparator = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Resetear las horas para comparar solo fechas
  const messageDate = new Date(date);
  messageDate.setHours(0, 0, 0, 0);
  const todayDate = new Date(today);
  todayDate.setHours(0, 0, 0, 0);
  const yesterdayDate = new Date(yesterday);
  yesterdayDate.setHours(0, 0, 0, 0);
  
  if (messageDate.getTime() === todayDate.getTime()) {
    return 'Hoy';
  }
  
  if (messageDate.getTime() === yesterdayDate.getTime()) {
    return 'Ayer';
  }
  
  // Para fechas anteriores: "Mie, 20 Ago"
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                     'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  
  const dayName = dayNames[date.getDay()];
  const day = date.getDate();
  const monthName = monthNames[date.getMonth()];
  
  return `${dayName}, ${day} ${monthName}`;
};

// Función para verificar si dos fechas son del mismo día
const isSameDay = (date1: Date, date2: Date): boolean => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return d1.getTime() === d2.getTime();
};

export default function ChatScreen() {
  const componentInstanceId = useRef(++globalComponentCounter);
  const mountTime = useRef(Date.now());

  const params = useLocalSearchParams<{
    matchId?: string | string[];
    name?: string | string[];
    photoUrl?: string | string[];
    otherUserId?: string | string[];
    isBot?: string | string[];
  }>();

  const matchId = useMemo(() => {
    if (!params.matchId) return undefined;
    return Array.isArray(params.matchId) ? params.matchId[0] : params.matchId;
  }, [params.matchId]);

  // Log component mount/unmount for debugging
  useEffect(() => {
    const componentId = `ChatScreen-${componentInstanceId.current}`;
    console.log(`[${componentId}] MOUNTED at ${new Date().toISOString()}, matchId: ${matchId}, uptime: ${Date.now() - mountTime.current}ms`);
    return () => {
      console.log(`[${componentId}] UNMOUNTED at ${new Date().toISOString()}, matchId: ${matchId}, lifetime: ${Date.now() - mountTime.current}ms`);
    };
  }, [matchId]);

  const otherUserName = useMemo(() => {
    if (!params.name) return undefined;
    return Array.isArray(params.name) ? params.name[0] : params.name;
  }, [params.name]);

  const otherUserId = useMemo(() => {
    if (!params.otherUserId) return undefined;
    return Array.isArray(params.otherUserId) ? params.otherUserId[0] : params.otherUserId;
  }, [params.otherUserId]);

  const photoUrl = useMemo(() => {
    if (!params.photoUrl) return undefined;
    return Array.isArray(params.photoUrl) ? params.photoUrl[0] : params.photoUrl;
  }, [params.photoUrl]);

  const isBot = useMemo(() => {
    if (!params.isBot) return false;
    const isBotValue = Array.isArray(params.isBot) ? params.isBot[0] : params.isBot;
    return isBotValue === 'true';
  }, [params.isBot]);

  const router = useRouter();
  const { tokens, user } = useAuthStore();
  const {
    messages,
    setMessages,
    addMessage,
    addMessages,
    prependMessages,
    setLoading,
    setError,
    clearError,
    isLoading,
    isSending,
    setSending,
  } = useChatStore();
  const { updateMatch, matches } = useMatchesStore();

  const [message, setMessage] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isUploadingZip, setIsUploadingZip] = useState(false);
  const [showUploadSuccessModal, setShowUploadSuccessModal] = useState(false);
  const [showUploadErrorModal, setShowUploadErrorModal] = useState(false);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string>('');
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const oldestMessageCursorRef = useRef<string | null>(null);
  const flatListRef = useRef<FlatList<Message>>(null);

  const apiClient = useMemo(() => new ApiClient(API_URL), []);
  const chatApi = useMemo(() => new ChatApi(apiClient), [apiClient]);
  const blockApi = useMemo(() => new BlockApi(apiClient), [apiClient]);
  const matchApi = useMemo(() => new MatchApi(apiClient), [apiClient]);
  const isInitialLoad = useRef(true);
  const hasScrolledToBottom = useRef(false);
  const lastMessageIdRef = useRef<string | null>(null);
  const isUserAtBottom = useRef(true);
  const contentSizeChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasMarkedAsReadRef = useRef(false);
  const isLoadingMessagesRef = useRef(false);
  const lastLoadTimeRef = useRef<number>(0);
  const loadMessagesTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const matchMessages = useMemo(
    () => (matchId ? messages[matchId] || [] : []),
    [matchId, messages],
  );

  useEffect(() => {
    isInitialLoad.current = true;
    hasScrolledToBottom.current = false;
    lastMessageIdRef.current = null;
    isUserAtBottom.current = true;
    oldestMessageCursorRef.current = null;
    hasMarkedAsReadRef.current = false;
    isLoadingMessagesRef.current = false;
    setHasMoreMessages(true);
    setIsLoadingOlder(false);
  }, [matchId]);

  // Scroll inicial solo una vez, sin animación
  // Este efecto se ejecuta cuando los mensajes cambian, pero esperamos a que el contenido esté renderizado
  useEffect(() => {
    if (matchMessages.length > 0 && !hasScrolledToBottom.current && isInitialLoad.current) {
      // Usar múltiples requestAnimationFrame para asegurar que el layout esté completamente renderizado
      const timeoutId = setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (flatListRef.current && matchMessages.length > 0 && !hasScrolledToBottom.current) {
              const lastIndex = matchMessages.length - 1;
              // Intentar scrollToIndex primero (más preciso)
              try {
                flatListRef.current.scrollToIndex({ 
                  index: lastIndex, 
                  animated: false,
                  viewPosition: 1 // 1 = al final de la vista
                });
              } catch (e) {
                // Si falla scrollToIndex, usar scrollToEnd
                flatListRef.current.scrollToEnd({ animated: false });
              }
              
              // Segundo intento después de un delay
              setTimeout(() => {
                if (flatListRef.current && !hasScrolledToBottom.current) {
                  try {
                    flatListRef.current.scrollToIndex({ 
                      index: lastIndex, 
                      animated: false,
                      viewPosition: 1
                    });
                  } catch (e) {
                    flatListRef.current.scrollToEnd({ animated: false });
                  }
                  hasScrolledToBottom.current = true;
                  lastMessageIdRef.current = matchMessages[lastIndex].id;
                  isInitialLoad.current = false;
                }
              }, 300);
            }
          });
        });
      }, 800);
      
      return () => clearTimeout(timeoutId);
    }
  }, [matchMessages.length, matchMessages]);

  // Handle keyboard show/hide events
  useEffect(() => {
      const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        // Scroll to bottom when keyboard appears (solo si ya se hizo scroll inicial)
        if (hasScrolledToBottom.current) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // Store refs to avoid recreating the function
  const chatApiRef = useRef(chatApi);
  const matchApiRef = useRef(matchApi);
  const tokensRef = useRef(tokens?.accessToken);
  const matchIdRef = useRef(matchId);

  // Update refs when values change
  useEffect(() => {
    chatApiRef.current = chatApi;
    matchApiRef.current = matchApi;
    tokensRef.current = tokens?.accessToken;
    matchIdRef.current = matchId;
  }, [chatApi, matchApi, tokens?.accessToken, matchId]);

  const loadMessages = useCallback(async () => {
    const currentMatchId = matchIdRef.current;
    const currentToken = tokensRef.current;
    const componentId = `ChatScreen-${componentInstanceId.current}`;
    const callTime = Date.now();

    console.log(`[${componentId}] loadMessages CALLED at ${new Date(callTime).toISOString()}, matchId: ${currentMatchId}, timeSinceMount: ${callTime - mountTime.current}ms`);

    if (!currentToken || !currentMatchId) {
      console.log(`[${componentId}] loadMessages SKIPPED - missing token or matchId`);
      return;
    }

    // Global protection: prevent multiple instances from loading the same matchId
    if (!activeChatSession.canLoadMessages()) {
      console.log(`[ChatScreen] loadMessages blocked by session protection`);
      return;
    }

    // Prevent concurrent calls (local protection)
    if (isLoadingMessagesRef.current) {
      console.log('[ChatScreen] Already loading (local ref), skipping');
      return;
    }

    // Mark as loading globally and locally
    activeChatSession.markMessageLoad();
    isLoadingMessagesRef.current = true;
    console.log(`[ChatScreen] Starting to load messages for matchId: ${currentMatchId}`);

    if (isInitialLoad.current) {
      setLoading(true);
    }

    try {
      clearError();
      const result = await chatApiRef.current.getMessages(currentMatchId, 25, undefined, currentToken);
      if (!result.success) {
        const messageText = result.error.message || 'Could not load messages.';
        
        // Si es rate limit (429), no mostrar error y esperar más tiempo antes del siguiente intento
        // El statusCode puede estar en el error si es un DomainError
        const isRateLimit = result.error.statusCode === 429 || 
                          messageText.toLowerCase().includes('rate limit');
        
        if (isRateLimit) {
          // No mostrar error al usuario, solo log
          console.warn('[ChatScreen] Rate limit exceeded, will retry later');
          // No hacer return aquí, dejar que el finally se ejecute
        } else {
          setError(messageText);
          if (isInitialLoad.current) {
            Alert.alert('Error', messageText);
          }
        }
        return;
      }

      const validation = DisplayMessageSchema.array().safeParse(result.data.messages);
      if (!validation.success) {
        setError('Invalid messages received from server.');
        console.warn('Invalid messages payload', validation.error);
        if (isInitialLoad.current) {
          Alert.alert('Error', 'Received invalid messages data.');
        }
        return;
      }

      const orderedMessages = [...validation.data].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      
      // Detectar si llegó un mensaje nuevo comparando con el último ID conocido
      const previousLastId = lastMessageIdRef.current;
      const latestMessageId = orderedMessages.length > 0 
        ? orderedMessages[orderedMessages.length - 1].id 
        : null;
      
      const hasNewMessage = !isInitialLoad.current && 
        latestMessageId !== null && 
        latestMessageId !== previousLastId;
      
      // En carga inicial: reemplazar todos los mensajes
      // En polling: preservar mensajes anteriores cargados y solo añadir los nuevos al final
      if (isInitialLoad.current) {
        setMessages(currentMatchId, orderedMessages);
      } else {
        // Preservar todos los mensajes actuales (incluyendo los anteriores cargados)
        // y solo añadir mensajes nuevos que no existen
        // Usar getState() para leer el estado actual sin depender de messages en las dependencias
        const currentState = useChatStore.getState();
        const currentMessages = currentMatchId ? currentState.messages[currentMatchId] || [] : [];
        const currentIds = new Set(currentMessages.map((msg) => msg.id));
        
        // Filtrar solo mensajes nuevos que no están en la lista actual
        const newMessages = orderedMessages.filter((msg) => !currentIds.has(msg.id));
        
        if (newMessages.length > 0) {
          // Añadir solo los mensajes nuevos al final, preservando todos los anteriores
          addMessages(currentMatchId, newMessages);
        }
        // Si no hay mensajes nuevos, no hacer nada para preservar los mensajes anteriores cargados
      }

      if (orderedMessages.length > 0) {
        const latestMessage = orderedMessages[orderedMessages.length - 1];
        const oldestMessage = orderedMessages[0];
        updateMatch(currentMatchId, { lastMessage: latestMessage, unreadCount: 0 });
        
        // Actualizar referencias
        lastMessageIdRef.current = latestMessage.id;
        if (isInitialLoad.current) {
          oldestMessageCursorRef.current = oldestMessage.id;
          // Verificar si hay más mensajes (si recibimos menos de 25, no hay más)
          setHasMoreMessages(result.data.messages.length === 25);
        }
        
        // Auto-scroll solo si llegó un mensaje nuevo Y el usuario está abajo
        if (hasNewMessage && isUserAtBottom.current && hasScrolledToBottom.current) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      } else {
        updateMatch(currentMatchId, { lastMessage: undefined, unreadCount: 0 });
        if (isInitialLoad.current) {
          setHasMoreMessages(false);
        }
      }

      // Mark messages as read when opening the chat (only once on initial load)
      if (isInitialLoad.current && currentToken && activeChatSession.canMarkAsRead()) {
        activeChatSession.markAsReadDone();
        hasMarkedAsReadRef.current = true;
        // Await to ensure it completes before user can navigate away
        matchApiRef.current.markAsRead(currentMatchId, currentToken).catch((error) => {
          console.error('[ChatScreen] Failed to mark messages as read:', error);
          // Log error but don't block UI
        });
      }
    } catch (error) {
      console.error('Failed to load chat messages', error);
      setError('Network error. Please try again.');
      if (isInitialLoad.current) {
        Alert.alert('Error', 'Network error. Please try again.');
      }
    } finally {
      isLoadingMessagesRef.current = false;
      // Mark load as complete (no specific endLoad needed with new system)
      if (isInitialLoad.current) {
        setLoading(false);
        // El scroll se maneja en el useEffect y onContentSizeChange
        // No hacer scroll aquí para evitar conflictos
      }
    }
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!tokens?.accessToken || !matchId || isLoadingOlder || !oldestMessageCursorRef.current || !hasMoreMessages) {
      return;
    }

    setIsLoadingOlder(true);
    clearError();

    try {
      const result = await chatApi.getMessages(
        matchId,
        25,
        oldestMessageCursorRef.current,
        tokens.accessToken
      );

      if (!result.success) {
        setError(result.error.message || 'Could not load older messages.');
        return;
      }

      const validation = DisplayMessageSchema.array().safeParse(result.data.messages);
      if (!validation.success) {
        setError('Invalid messages received from server.');
        console.warn('Invalid messages payload', validation.error);
        return;
      }

      if (validation.data.length === 0) {
        setHasMoreMessages(false);
        return;
      }

      // Ordenar a ASC (antiguos → nuevos)
      const orderedOlderMessages = [...validation.data].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      // Prepend al inicio de la lista
      prependMessages(matchId, orderedOlderMessages);

      // Actualizar cursor al mensaje más antiguo de los nuevos
      const newOldestMessage = orderedOlderMessages[0];
      oldestMessageCursorRef.current = newOldestMessage.id;

      // Verificar si hay más mensajes (si recibimos menos de 25, no hay más)
      setHasMoreMessages(validation.data.length === 25);
    } catch (error) {
      console.error('Failed to load older messages', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoadingOlder(false);
    }
  }, [chatApi, clearError, matchId, prependMessages, setError, tokens?.accessToken, isLoadingOlder, hasMoreMessages]);

  useEffect(() => {
    const componentId = `ChatScreen-${componentInstanceId.current}`;
    const effectTime = Date.now();

    if (!matchId) {
      console.log(`[${componentId}] useEffect SKIPPED at ${new Date(effectTime).toISOString()} - no matchId`);
      return;
    }

    console.log(`[${componentId}] useEffect TRIGGERED at ${new Date(effectTime).toISOString()}, matchId: ${matchId}, timeSinceMount: ${effectTime - mountTime.current}ms`);

    // Start or switch chat session
    const sessionStarted = activeChatSession.startSession(matchId);
    if (!sessionStarted) {
      console.log(`[${componentId}] Session already active for ${matchId}, skipping setup`);
      return;
    }

    // Clear any pending timeout from local ref
    if (loadMessagesTimeoutRef.current) {
      clearTimeout(loadMessagesTimeoutRef.current);
      loadMessagesTimeoutRef.current = null;
    }

    // Reset flags when matchId changes
    hasMarkedAsReadRef.current = false;
    isLoadingMessagesRef.current = false;
    isInitialLoad.current = true;
    lastLoadTimeRef.current = 0;

    // Load messages with a delay to prevent rapid-fire calls on mount
    // Use a longer delay to ensure only one instance loads
    const timeoutId = setTimeout(() => {
      const componentId = `ChatScreen-${componentInstanceId.current}`;
      const timeoutFireTime = Date.now();
      console.log(`[${componentId}] Initial load TIMEOUT FIRED at ${new Date(timeoutFireTime).toISOString()}, matchId: ${matchId}, timeSinceMount: ${timeoutFireTime - mountTime.current}ms`);
      console.log(`[${componentId}] Session state - isActive: ${activeChatSession.isActive}, matchId: ${activeChatSession.matchId}`);
      if (activeChatSession.canLoadMessages()) {
        console.log(`[${componentId}] Calling loadMessages from timeout`);
        loadMessages();
      } else {
        console.log(`[${componentId}] Initial load blocked by session for matchId: ${matchId}`);
      }
    }, 1000); // Increased delay to 1 second

    loadMessagesTimeoutRef.current = timeoutId;

    // Poll for new messages while chat is active
    // 30 seconds is a reasonable balance between responsiveness and API load
    // This works well for both development and production
    const pollInterval = 30000; // 30 seconds

    const interval = setInterval(() => {
      const componentId = `ChatScreen-${componentInstanceId.current}`;
      const intervalTime = Date.now();
      // Only poll if not currently loading and not in initial load
      if (!isLoadingMessagesRef.current && !isInitialLoad.current && activeChatSession.canLoadMessages()) {
        console.log(`[${componentId}] Polling INTERVAL TRIGGERED at ${new Date(intervalTime).toISOString()}, matchId: ${matchId}, timeSinceMount: ${intervalTime - mountTime.current}ms`);
        loadMessages();
      } else {
        console.log(`[${componentId}] Polling skipped - loading: ${isLoadingMessagesRef.current}, initialLoad: ${isInitialLoad.current}, canLoad: ${activeChatSession.canLoadMessages()}`);
      }
    }, pollInterval);
    
    // Mark as read when component unmounts (user leaves chat)
    return () => {
      const componentId = `ChatScreen-${componentInstanceId.current}`;
      const cleanupTime = Date.now();
      console.log(`[${componentId}] CLEANUP at ${new Date(cleanupTime).toISOString()}, matchId: ${matchId}, lifetime: ${cleanupTime - mountTime.current}ms`);
      // Clear local refs
      if (loadMessagesTimeoutRef.current) {
        clearTimeout(loadMessagesTimeoutRef.current);
        loadMessagesTimeoutRef.current = null;
      }
      // End chat session on unmount
      activeChatSession.endSession();
      // Mark messages as read when leaving the chat (only if not already marked)
      const currentToken = tokensRef.current;
      const currentMatchId = matchIdRef.current;
      if (currentToken && currentMatchId && !hasMarkedAsReadRef.current && activeChatSession.canMarkAsRead()) {
        activeChatSession.markAsReadDone();
        matchApiRef.current.markAsRead(currentMatchId, currentToken).catch((error) => {
          console.error(`[${componentId}] Failed to mark messages as read on unmount:`, error);
        });
      }
    };
  }, [matchId]); // Re-run when matchId changes to setup polling for new chat

  // Check if this match still exists (detect if blocked)
  useEffect(() => {
    if (!matchId || !matches) return;

    const matchExists = matches.some((m) => m.id === matchId);
    if (!matchExists && !isInitialLoad.current) {
      // Match was removed (likely blocked)
      setIsBlocked(true);
    }
  }, [matchId, matches]);

  // Redirect if blocked
  useEffect(() => {
    if (isBlocked) {
      Alert.alert(
        'Chat no disponible',
        'Este chat ya no está disponible.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(app)/matches'),
          },
        ],
        { cancelable: false }
      );
    }
  }, [isBlocked, router]);

  const handleSendMessage = useCallback(async () => {
    const messageContent = message.trim();
    if (!messageContent || !tokens?.accessToken || !matchId || isSending || isBlocked) {
      return;
    }

    // Store the message content to clear it later
    const messageToSend = messageContent;
    
    // Clear the input immediately when user clicks send (optimistic update)
    // This provides immediate feedback and ensures the text is cleared
    console.log('[ChatScreen] Clearing message input immediately');
    setMessage('');
    
    setSending(true);
    clearError();

    try {
      console.log('[ChatScreen] Sending message:', { matchId, isBot, messageLength: messageToSend.length });
      
      const result = await chatApi.sendMessage(
        matchId,
        { content: messageToSend },
        tokens.accessToken,
      );

      console.log('[ChatScreen] Send result:', { success: result.success, hasData: result.success && !!result.data });

      if (!result.success) {
        const messageText = result.error.message || 'Could not send your message.';
        setError(messageText);
        Alert.alert('Error', messageText);
        // Restore message on error so user can retry
        setMessage(messageToSend);
        return;
      }

      const validation = MessageSchema.safeParse(result.data.message);
      if (!validation.success) {
        console.warn('[ChatScreen] Validation failed:', validation.error);
        Alert.alert('Error', 'Received invalid message data.');
        console.warn('Invalid message payload received from server', validation.error);
        return;
      }

      console.log('[ChatScreen] Adding message to store');
      addMessage(matchId, validation.data);
      updateMatch(matchId, { lastMessage: validation.data, unreadCount: 0 });
      
      // Actualizar referencia y hacer scroll cuando se envía un mensaje
      lastMessageIdRef.current = validation.data.id;
      if (hasScrolledToBottom.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('[ChatScreen] Failed to send message', error);
      const fallbackMessage = 'Network error. Please try again.';
      setError(fallbackMessage);
      Alert.alert('Error', fallbackMessage);
    } finally {
      setSending(false);
    }
  }, [
    addMessage,
    chatApi,
    clearError,
    isBlocked,
    isBot,
    isSending,
    matchId,
    message,
    setError,
    setSending,
    tokens?.accessToken,
    updateMatch,
  ]);

  const handleBlockUser = useCallback(async () => {
    if (!matchId || !otherUserId || !tokens?.accessToken) {
      return;
    }

    setIsBlocking(true);
    setShowBlockModal(false);

    try {
      const result = await blockApi.blockUser(
        matchId,
        { blockedUserId: otherUserId },
        tokens.accessToken
      );

      if (!result.success) {
        Alert.alert('Error', result.error.message || 'Could not block user.');
        return;
      }

      // Navigate back to matches screen
      router.replace('/(app)/matches');
    } catch (error) {
      console.error('Failed to block user', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setIsBlocking(false);
    }
  }, [blockApi, matchId, otherUserId, router, tokens?.accessToken]);

  const handleAvatarPress = useCallback(() => {
    router.push({
      pathname: '/chat/avatar-view',
      params: {
        photoUrl: photoUrl ?? '',
        name: otherUserName ?? 'User',
      },
    });
  }, [photoUrl, otherUserName, router]);

  const handleAttachZip = useCallback(async () => {
    console.log('[ChatScreen] handleAttachZip called', { userId: user?.id, isUploadingZip, isBlocked });
    
    if (!user?.id || isUploadingZip || isBlocked) {
      console.log('[ChatScreen] Early return:', { hasUserId: !!user?.id, isUploadingZip, isBlocked });
      return;
    }

    clearError();

    try {
      console.log('[ChatScreen] Step 1: Picking ZIP file...');
      // Step 1: Pick ZIP file
      const pickResult = await pickZipFile();
      console.log('[ChatScreen] Pick result:', { success: pickResult.success, hasData: !!pickResult.success && !!pickResult.data });
      
      if (!pickResult.success) {
        console.error('[ChatScreen] Pick failed:', pickResult.error);
        setUploadErrorMessage(pickResult.error.message);
        setShowUploadErrorModal(true);
        setError(pickResult.error.message);
        return;
      }

      if (!pickResult.data) {
        // User cancelled
        console.log('[ChatScreen] User cancelled file pick');
        return;
      }

      // Now start uploading - set loading state
      setIsUploadingZip(true);
      console.log('[ChatScreen] Step 2: Uploading ZIP file...', { fileName: pickResult.data.name, fileSize: pickResult.data.size });
      // Step 2: Upload ZIP file
      const uploadResult = await uploadZipFile(pickResult.data);
      console.log('[ChatScreen] Upload result:', { success: uploadResult.success });
      
      setIsUploadingZip(false); // Hide loading
      
      if (!uploadResult.success) {
        console.error('[ChatScreen] Upload failed:', uploadResult.error);
        setUploadErrorMessage(uploadResult.error.message);
        setShowUploadErrorModal(true);
        setError(uploadResult.error.message);
        return;
      }

      // Step 3: Show success message
      console.log('[ChatScreen] Upload successful!');
      setShowUploadSuccessModal(true);
    } catch (error) {
      console.error('[ChatScreen] Error uploading ZIP:', error);
      const errorMessage = error instanceof Error ? error.message : 'No se pudo subir. Inténtalo de nuevo.';
      setIsUploadingZip(false);
      setUploadErrorMessage(errorMessage);
      setShowUploadErrorModal(true);
      setError(errorMessage);
    }
  }, [user?.id, isUploadingZip, isBlocked, clearError, setError]);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwn = item.senderId === user?.id;
    const messageDate = new Date(item.createdAt);
    
    // Verificar si necesitamos mostrar un separador de fecha
    const shouldShowDateSeparator = index === 0 || 
      !isSameDay(messageDate, new Date(matchMessages[index - 1].createdAt));

    return (
      <View>
        {shouldShowDateSeparator && (
          <View style={styles.dateSeparatorContainer}>
            <Text style={styles.dateSeparatorText}>
              {formatDateSeparator(messageDate)}
            </Text>
          </View>
        )}
        <View style={[styles.messageContainer, isOwn && styles.ownMessageContainer]}>
          <View style={[styles.messageBubble, isOwn && styles.ownMessageBubble]}>
            <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>{item.content}</Text>
            <Text style={[styles.messageTime, isOwn && styles.ownMessageTime]}>
              {new Date(item.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!matchId) {
    return <Redirect href="/(app)/matches" />;
  }

  if (isBlocked) {
    return <Redirect href="/(app)/matches" />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ marginLeft: 16, padding: 8 }}
            >
              <Ionicons name="arrow-back" size={24} color="#000000" />
            </TouchableOpacity>
          ),
          headerTitle: () => (
            <TouchableOpacity
              style={styles.headerTitleContainer}
              onPress={handleAvatarPress}
              activeOpacity={0.7}
            >
              <Image
                source={photoUrl ? { uri: photoUrl } : require('../../assets/placeholder.png')}
                style={styles.headerAvatar}
              />
              <Text style={styles.headerTitleText} numberOfLines={1}>
                {otherUserName ?? 'Chat'}
              </Text>
            </TouchableOpacity>
          ),
          headerRight: () =>
            !isBot ? (
              <TouchableOpacity
                onPress={() => setShowMenu(true)}
                style={styles.menuButton}
              >
                <Ionicons name="ellipsis-vertical" size={24} color="#333" />
              </TouchableOpacity>
            ) : null,
        }}
      />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.chatContent}>
            <FlatList
              ref={flatListRef}
              data={matchMessages}
              renderItem={({ item, index }) => renderMessage({ item, index })}
              keyExtractor={(item) => item.id}
              style={styles.messagesList}
              contentContainerStyle={
                matchMessages.length === 0 ? styles.emptyListContainer : styles.messagesContent
              }
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              maintainVisibleContentPosition={{
                minIndexForVisible: 0,
                autoscrollToTopThreshold: 10,
              }}
              onContentSizeChange={(contentWidth, contentHeight) => {
                // Scroll al final cuando el contenido cambie (solo en carga inicial)
                // Usar debounce para esperar a que el tamaño se estabilice (todos los mensajes renderizados)
                if (matchMessages.length > 0 && !hasScrolledToBottom.current && isInitialLoad.current) {
                  // Limpiar timeout anterior si existe
                  if (contentSizeChangeTimeoutRef.current) {
                    clearTimeout(contentSizeChangeTimeoutRef.current);
                  }
                  
                  // Esperar 500ms sin cambios en el tamaño antes de hacer scroll
                  // Esto asegura que todos los mensajes estén renderizados
                  contentSizeChangeTimeoutRef.current = setTimeout(() => {
                    requestAnimationFrame(() => {
                      requestAnimationFrame(() => {
                        if (flatListRef.current && !hasScrolledToBottom.current && matchMessages.length > 0) {
                          const lastIndex = matchMessages.length - 1;
                          // Intentar scrollToIndex primero (más preciso)
                          try {
                            flatListRef.current.scrollToIndex({ 
                              index: lastIndex, 
                              animated: false,
                              viewPosition: 1 // 1 = al final de la vista
                            });
                          } catch (e) {
                            // Si falla scrollToIndex, usar scrollToEnd
                            flatListRef.current.scrollToEnd({ animated: false });
                          }
                          
                          // Segundo intento después de un delay para asegurar que llegue al final
                          setTimeout(() => {
                            if (flatListRef.current && !hasScrolledToBottom.current) {
                              try {
                                flatListRef.current.scrollToIndex({ 
                                  index: lastIndex, 
                                  animated: false,
                                  viewPosition: 1
                                });
                              } catch (e) {
                                flatListRef.current.scrollToEnd({ animated: false });
                              }
                              // Tercer intento final para asegurar
                              setTimeout(() => {
                                if (flatListRef.current && !hasScrolledToBottom.current) {
                                  flatListRef.current.scrollToEnd({ animated: false });
                                  hasScrolledToBottom.current = true;
                                  lastMessageIdRef.current = matchMessages[lastIndex].id;
                                  isInitialLoad.current = false;
                                }
                              }, 200);
                            }
                          }, 300);
                        }
                      });
                    });
                  }, 500);
                }
              }}
              onScroll={(event) => {
                // Detectar si el usuario está cerca del final de la lista
                const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                const distanceFromEnd = contentSize.height - layoutMeasurement.height - contentOffset.y;
                isUserAtBottom.current = distanceFromEnd < 100; // 100px de margen
              }}
              scrollEventThrottle={16}
              ListHeaderComponent={
                hasMoreMessages && matchMessages.length > 0 ? (
                  <View style={styles.loadOlderContainer}>
                    <TouchableOpacity
                      style={styles.loadOlderButton}
                      onPress={loadOlderMessages}
                      disabled={isLoadingOlder}
                    >
                      {isLoadingOlder ? (
                        <ActivityIndicator size="small" color="#e91e63" />
                      ) : (
                        <Text style={styles.loadOlderButtonText}>
                          Cargar mensajes anteriores
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyStateContainer}>
                  {isLoading ? (
                    <>
                      <ActivityIndicator size="small" color="#e91e63" />
                      <Text style={styles.emptyStateText}>Loading messages...</Text>
                    </>
                  ) : (
                    <Text style={styles.emptyStateText}>Start the conversation!</Text>
                  )}
                </View>
              }
            />
          </View>

          <View style={[
            styles.inputContainer,
            Platform.OS === 'android' && { marginBottom: keyboardHeight > 0 ? keyboardHeight : 0 }
          ]}>
            {isBot && (
              <TouchableOpacity
                style={styles.attachButton}
                onPress={handleAttachZip}
                disabled={isUploadingZip || isBlocked}
              >
                {isUploadingZip ? (
                  <ActivityIndicator size="small" color="#666" />
                ) : (
                  <Ionicons name="attach" size={24} color="#666" />
                )}
              </TouchableOpacity>
            )}
            <TextInput
              style={[styles.textInput, isBlocked && styles.textInputDisabled]}
              value={message}
              onChangeText={setMessage}
              placeholder={isBlocked ? 'Chat no disponible' : 'Type a message...'}
              multiline
              maxLength={1000}
              editable={!isBlocked}
              onSubmitEditing={() => {
                // Only send if message is not empty and not sending
                if (message.trim() && !isSending && !isBlocked) {
                  handleSendMessage();
                }
              }}
              blurOnSubmit={false}
              returnKeyType="send"
              onKeyPress={(e) => {
                // Handle Enter key press to send message
                // Note: shiftKey is not available in React Native's TextInputKeyPressEventData
                if (e.nativeEvent.key === 'Enter') {
                  if (message.trim() && !isSending && !isBlocked) {
                    e.preventDefault?.();
                    handleSendMessage();
                  }
                }
              }}
              onFocus={() => {
                // Scroll to bottom when input is focused (solo si ya se hizo scroll inicial)
                if (hasScrolledToBottom.current) {
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }, 300);
                }
              }}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!message.trim() || isSending || isBlocked) && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!message.trim() || isSending || isBlocked}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Context Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                setShowBlockModal(true);
              }}
            >
              <Ionicons name="ban" size={20} color="#e91e63" />
              <Text style={styles.menuItemText}>Bloquear usuario</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Block Confirmation Modal */}
      <Modal
        visible={showBlockModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBlockModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Bloquear usuario</Text>
            <Text style={styles.modalText}>
              ¿Estás seguro de que quieres bloquear a {otherUserName}?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowBlockModal(false)}
                disabled={isBlocking}
              >
                <Text style={styles.modalButtonTextCancel}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleBlockUser}
                disabled={isBlocking}
              >
                {isBlocking ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonTextConfirm}>Sí</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upload Success Modal */}
      <Modal
        visible={showUploadSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUploadSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Ionicons name="checkmark-circle" size={64} color="#4caf50" style={styles.successIcon} />
            <Text style={styles.modalTitle}>¡Archivo subido!</Text>
            <Text style={styles.modalText}>
              Tu archivo se ha subido correctamente.
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonConfirm]}
              onPress={() => setShowUploadSuccessModal(false)}
            >
              <Text style={styles.modalButtonTextConfirm}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Upload Error Modal */}
      <Modal
        visible={showUploadErrorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUploadErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Ionicons name="close-circle" size={64} color="#f44336" style={styles.successIcon} />
            <Text style={styles.modalTitle}>Error al subir archivo</Text>
            <View style={styles.modalTextContainer}>
              {uploadErrorMessage ? (
                uploadErrorMessage.includes('Máximo permitido') ? (
                  <>
                    <Text style={styles.modalText}>Máximo permitido: 500 KB.</Text>
                    <Text style={styles.modalText}>No subas contenido multimedia</Text>
                  </>
                ) : (
                  <Text style={styles.modalText}>
                    {uploadErrorMessage}
                  </Text>
                )
              ) : (
                <Text style={styles.modalText}>
                  No se pudo subir el archivo. Inténtalo de nuevo.
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonConfirm]}
              onPress={() => setShowUploadErrorModal(false)}
            >
              <Text style={styles.modalButtonTextConfirm}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  chatContent: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingVertical: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  messageContainer: {
    marginVertical: 4,
    alignItems: 'flex-start',
  },
  ownMessageContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '80%',
  },
  ownMessageBubble: {
    backgroundColor: '#e91e63',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  ownMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    color: '#666',
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    minHeight: 60,
  },
  attachButton: {
    marginRight: 8,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
  },
  textInputDisabled: {
    backgroundColor: '#f0f0f0',
    color: '#999',
  },
  sendButton: {
    backgroundColor: '#e91e63',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  menuButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 16,
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#e91e63',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalTextContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalButtonCancel: {
    backgroundColor: '#f0f0f0',
  },
  modalButtonConfirm: {
    backgroundColor: '#e91e63',
  },
  modalButtonTextCancel: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dateSeparatorContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorText: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#e91e63',
    backgroundColor: '#f0f0f0',
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    maxWidth: 180,
  },
  successIcon: {
    marginBottom: 16,
    alignSelf: 'center',
  },
  loadOlderContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  loadOlderButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e91e63',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadOlderButtonText: {
    color: '#e91e63',
    fontSize: 14,
    fontWeight: '600',
  },
});
