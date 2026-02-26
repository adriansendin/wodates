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
  ActivityIndicator,
  Modal,
  Keyboard,
  Image,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, Redirect, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiClient } from '../../src/data/api/apiClient';
import { ChatApi } from '../../src/data/api/chatApi';
import { BlockApi } from '../../src/data/api/blockApi';
import { MatchApi } from '../../src/data/api/matchApi';
import { ProfileApi } from '../../src/data/api/profileApi';
import { useAuthStore } from '../../src/domain/stores/authStore';
import { useChatStore } from '../../src/domain/stores/chatStore';
import { Message, MessageSchema } from '../../src/domain/entities/Message';
import { useMatchesStore } from '../../src/domain/stores/matchesStore';
import { z } from 'zod';

// Adjuntar archivos (Doc Love) — comentado
// import { pickZipFile, uploadZipFile } from '../../src/data/api/zipUploadService';

// More lenient message schema for displaying messages - allows longer content
// The backend may return messages that exceed the normal 1000 char limit
const DisplayMessageSchema = MessageSchema.extend({
  content: z.string().min(1), // Remove max(1000) restriction for display purposes
});

import { getApiUrl } from '../../src/utils/apiConfig';
import { notifySystem, notifyActionable } from '../../src/utils/notificationService';
import { Alert } from 'react-native';

const API_URL = getApiUrl();

// Debug logging helper (only in development)
const debugLog = (...args: unknown[]): void => { if (__DEV__) console.log(...args); };

// Two-part Spanish opener templates for blank human-human chats
const OPENER_TEMPLATES = [
  // Warm / open (no question)
  "Nice to meet you here 🙂 No rush — happy to start easy and see how it feels.",
  "Good to see you here. I’m more into calm, genuine chats than forced small talk.",
  "A pleasure to meet you 🙂 I’m {name}. Just saying hi properly — happy to keep this simple.",
  "Glad we matched. If now’s hectic, no worries — when you get a moment, I’d love to hear what kind of chat you enjoy.",
  "Hello 🙂 I like that we’re focusing on one conversation at a time — no pressure, just happy to say hi.",
  "Hey! It’s been a good day — hope yours is going well too.",

  // Options (choice, not a question-heavy “interview”)
  "Pleasure meeting you. Want to start with something light, or something a bit more real?",
  "Hi there 🙂 We can go slow and casual, or be a bit more direct — whatever feels best.",
  "Good evening. Pick a lane: plans / work / interests / life — I’ll follow.",
  "Nice to meet you 🙂 Would you rather do one question each, or just chat naturally?",
  "Glad we crossed paths. We can keep it short-and-sweet, or do proper messages — whatever feels easiest.",
  "Hello! We can keep it short-and-sweet, or do proper messages — your call.",
  "Hey 🙂 Either we start super light, or we skip to something meaningful — both work for me.",

  // Questions (gentle, not “a saco”)
  "I’m {name} 🙂 What kind of pace feels comfortable for you when getting to know someone?",
  "Not going to do the empty “how are you?” — what’s been the best part of your week so far?",
  "Hi! What’s a topic you actually enjoy talking about, even with someone new?",
  "Good to see you here 🙂 What’s a small thing that’s made you smile recently?",
  "Honestly curious — what’s a green flag you appreciate early on?",
  "No pressure at all: are you more of a quick replier, or more ‘when I can’?",
  "Nice to meet you 🙂 If we start with one thing, what would you like to know about me first?"
];


// Simple global flag to prevent any duplicate API calls during the entire chat session
const activeChatSession = {
  matchId: null as string | null,
  isActive: false,
  lastMessageLoad: 0,
  lastImmediateLoad: 0, // Track immediate loads separately
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
    this.lastImmediateLoad = 0;
    this.markedAsRead = false;
    console.log(`[ChatSession] STARTED NEW SESSION for ${matchId} at ${new Date(now).toISOString()}`);
    return true;
  },

  /**
   * Check if regular polling is allowed (2s minimum between regular polls)
   */
  canLoadMessages(): boolean {
    const now = Date.now();
    console.log(`[ChatSession] canLoadMessages called at ${new Date(now).toISOString()}, isActive: ${this.isActive}, matchId: ${this.matchId}`);

    if (!this.isActive) {
      console.log(`[ChatSession] BLOCKED - session not active`);
      return false;
    }

    const timeSinceLastLoad = now - this.lastMessageLoad;
    if (timeSinceLastLoad < 2000) { // 2 seconds minimum between regular loads
      console.log(`[ChatSession] BLOCKED - only ${timeSinceLastLoad}ms since last load (need 2000ms)`);
      return false;
    }

    console.log(`[ChatSession] ALLOWED - time since last load: ${timeSinceLastLoad}ms`);
    return true;
  },

  /**
   * Check if immediate poll is allowed (300ms minimum between immediate polls)
   * This allows faster polling for immediate triggers (send, focus, foreground)
   */
  canLoadMessagesImmediate(): boolean {
    const now = Date.now();
    if (!this.isActive) {
      return false;
    }

    const timeSinceLastImmediate = now - this.lastImmediateLoad;
    if (timeSinceLastImmediate < 300) { // 300ms minimum between immediate loads
      return false;
    }

    // Also respect regular polling minimum (unless it's been 2s since last regular load)
    const timeSinceLastLoad = now - this.lastMessageLoad;
    if (timeSinceLastLoad < 300) { // Still need 300ms minimum
      return false;
    }

    return true;
  },

  markMessageLoad(): void {
    const now = Date.now();
    this.lastMessageLoad = now;
    console.log(`[ChatSession] Marked message load at ${new Date(now).toISOString()}`);
  },

  markImmediateLoad(): void {
    const now = Date.now();
    this.lastImmediateLoad = now;
    this.lastMessageLoad = now; // Also update regular load time
    console.log(`[ChatSession] Marked immediate load at ${new Date(now).toISOString()}`);
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
    this.lastImmediateLoad = 0;
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
    return 'Today';
  }
  
  if (messageDate.getTime() === yesterdayDate.getTime()) {
    return 'Yesterday';
  }  
  
  // Para fechas anteriores: "Mie, 20 Ago"
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  
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
    fromDiscover?: string | string[];
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

  const fromDiscover = useMemo(() => {
    if (!params.fromDiscover) return false;
    const value = Array.isArray(params.fromDiscover) ? params.fromDiscover[0] : params.fromDiscover;
    return value === 'true';
  }, [params.fromDiscover]);

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
  const [showAboutDocLoveModal, setShowAboutDocLoveModal] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  // Adjuntar archivos (Doc Love) — comentado
  // const [isUploadingZip, setIsUploadingZip] = useState(false);
  // const [showUploadSuccessModal, setShowUploadSuccessModal] = useState(false);
  // const [showUploadErrorModal, setShowUploadErrorModal] = useState(false);
  // const [uploadErrorMessage, setUploadErrorMessage] = useState<string>('');
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [pastedTextToSplit, setPastedTextToSplit] = useState<string | null>(null);
  const oldestMessageCursorRef = useRef<string | null>(null);
  const flatListRef = useRef<FlatList<Message>>(null);
  const userClearedInputRef = useRef(false); // Track if user intentionally cleared input
  const hasSentMessageInSessionRef = useRef(false); // Track if user has sent a message in this chat session
  const [affinitySentence, setAffinitySentence] = useState<string | null>(null);
  const [hasSentMessage, setHasSentMessage] = useState<boolean>(false);
  const [showAffinityModal, setShowAffinityModal] = useState(false);
  const [isBuildingProfile, setIsBuildingProfile] = useState(false);
  const [showBuildProfileButton, setShowBuildProfileButton] = useState(false);

  // Blank chat opener state
  const [openerTemplateIndex, setOpenerTemplateIndex] = useState<number>(() => {
    // Deterministic initial template selection based on matchId + userId hash
    // This ensures each user in the match gets a different template
    if (!matchId || !user?.id) return 0;
    // Combine matchId and userId for unique template per user per match
    const combinedId = `${matchId}-${user.id}`;
    let hash = 0;
    for (let i = 0; i < combinedId.length; i++) {
      hash += combinedId.charCodeAt(i);
    }
    return hash % OPENER_TEMPLATES.length;
  });

  const apiClient = useMemo(() => new ApiClient(API_URL), []);
  const chatApi = useMemo(() => new ChatApi(apiClient), [apiClient]);
  const blockApi = useMemo(() => new BlockApi(apiClient), [apiClient]);
  const matchApi = useMemo(() => new MatchApi(apiClient), [apiClient]);
  const profileApi = useMemo(() => new ProfileApi(apiClient), [apiClient]);
  const isInitialLoad = useRef(true);
  const hasInitialLoadCompleted = useRef(false); // Track if initial message load has completed (independent of scroll)
  const hasScrolledToBottom = useRef(false);
  const lastMessageIdRef = useRef<string | null>(null);
  const isUserAtBottom = useRef(true);
  const contentSizeChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasMarkedAsReadRef = useRef(false);
  const isLoadingMessagesRef = useRef(false);
  const lastLoadTimeRef = useRef<number>(0);
  const loadMessagesTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const matchHeartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const markAsReadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMarkAsReadTimeRef = useRef<number>(0);
  
  // Latency instrumentation: track message send time and receive time
  const messageSendTimesRef = useRef<Map<string, number>>(new Map()); // messageId -> sendTimestamp
  const lastReceivedMessageTimeRef = useRef<number>(0);

  // Shared helper to extract status code from error (handles both DomainError and axios errors)
  const getStatusCode = useCallback((error: unknown): number | null => {
    // Check if it's a DomainError with statusCode property
    if (error && typeof error === 'object' && 'statusCode' in error && typeof error.statusCode === 'number') {
      return error.statusCode;
    }
    // Check if it's an axios error with response.status
    if (error && typeof error === 'object' && 'response' in error) {
      const response = (error as { response?: { status?: number } }).response;
      if (response && typeof response.status === 'number') {
        return response.status;
      }
    }
    return null;
  }, []);

  const matchMessages = useMemo(
    () => (matchId ? messages[matchId] || [] : []),
    [matchId, messages],
  );

  useEffect(() => {
    isInitialLoad.current = true;
    hasInitialLoadCompleted.current = false; // Reset when matchId changes
    hasScrolledToBottom.current = false;
    lastMessageIdRef.current = null;
    isUserAtBottom.current = true;
    oldestMessageCursorRef.current = null;
    hasMarkedAsReadRef.current = false;
    isLoadingMessagesRef.current = false;
    lastMarkAsReadTimeRef.current = 0; // Reset mark-as-read timer for new chat
    setHasMoreMessages(true);
    setIsLoadingOlder(false);
    userClearedInputRef.current = false; // Reset clear flag for new chat
    hasSentMessageInSessionRef.current = false; // Reset sent message flag for new chat
    setAffinitySentence(null); // Reset affinity sentence for new chat
    setHasSentMessage(false); // Reset has sent message for new chat
    setShowBuildProfileButton(false); // Reset until we fetch from backend
  }, [matchId]);

  // Fetch affinity sentence and has-sent-message on mount and when matchId changes
  useEffect(() => {
    if (!matchId || !tokens?.accessToken || isBot) {
      return;
    }

    const fetchAffinityAndHasSent = async () => {
      try {
        // Fetch both in parallel
        const [affinityResult, hasSentResult] = await Promise.all([
          chatApi.getAffinitySentence(matchId, tokens.accessToken),
          chatApi.hasSentMessage(matchId, tokens.accessToken),
        ]);

        if (affinityResult.success) {
          setAffinitySentence(affinityResult.data.sentence);
        } else {
          // Use fallback if fetch fails
          setAffinitySentence('Initial affinity is low—conversation will sharpen recommendations.');
        }

        if (hasSentResult.success) {
          setHasSentMessage(hasSentResult.data.hasSent);
        }
      } catch (error) {
        console.error('Failed to fetch affinity sentence or has-sent-message:', error);
        // Use fallback on error
        setAffinitySentence('Initial affinity is low—conversation will sharpen recommendations.');
      }
    };

    fetchAffinityAndHasSent();
  }, [matchId, tokens?.accessToken, isBot]);

  // Fetch "Build my profile" button visibility for Doc Love chat (persisted in backend)
  useEffect(() => {
    if (!matchId || !tokens?.accessToken || !isBot) return;
    const fetchBuildProfileCta = async () => {
      const result = await chatApi.getBuildProfileCta(matchId, tokens.accessToken);
      if (result.success) {
        setShowBuildProfileButton(result.data.showButton);
      }
    };
    fetchBuildProfileCta();
  }, [matchId, tokens?.accessToken, isBot, chatApi]);

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
  const userRef = useRef(user);

  // Update refs when values change
  useEffect(() => {
    chatApiRef.current = chatApi;
    matchApiRef.current = matchApi;
    tokensRef.current = tokens?.accessToken;
    matchIdRef.current = matchId;
    userRef.current = user;
  }, [chatApi, matchApi, tokens?.accessToken, matchId, user]);

  const loadMessages = useCallback(async () => {
    const currentMatchId = matchIdRef.current;
    const currentToken = tokensRef.current;
    const componentId = `ChatScreen-${componentInstanceId.current}`;
    const callTime = Date.now();

    debugLog(`[${componentId}] loadMessages CALLED at ${new Date(callTime).toISOString()}, matchId: ${currentMatchId}, timeSinceMount: ${callTime - mountTime.current}ms`);

    if (!currentToken || !currentMatchId) {
      console.log(`[${componentId}] loadMessages SKIPPED - missing token or matchId`);
      return;
    }

    // Global protection: prevent multiple instances from loading the same matchId
    if (!activeChatSession.canLoadMessages()) {
      debugLog(`[ChatScreen] loadMessages blocked by session protection`);
      return;
    }

    // Prevent concurrent calls (local protection)
    if (isLoadingMessagesRef.current) {
      debugLog('[ChatScreen] Already loading (local ref), skipping');
      return;
    }

    // Mark as loading globally and locally
    activeChatSession.markMessageLoad();
    isLoadingMessagesRef.current = true;
    debugLog(`[ChatScreen] Starting to load messages for matchId: ${currentMatchId}`);

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
            // API errors loading messages are system errors
            notifySystem('Something went wrong', 'Try again', result.error, loadMessages);
          }
        }
        return;
      }

      const validation = DisplayMessageSchema.array().safeParse(result.data.messages);
      if (!validation.success) {
        setError('Invalid messages received from server.');
        console.warn('Invalid messages payload', validation.error);
        if (isInitialLoad.current) {
          // Validation errors from server are system errors (server bug)
          notifySystem('Something went wrong', 'Try again', validation.error, loadMessages);
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
          // Latency instrumentation: measure time from send to receive
          const receiveTime = Date.now();
          const currentUser = userRef.current;
          newMessages.forEach((msg) => {
            // Check if this message was sent by the other user (not us)
            if (msg.senderId !== currentUser?.id) {
              const sendTime = messageSendTimesRef.current.get(msg.id);
              if (sendTime) {
                const latency = receiveTime - sendTime;
                debugLog(`[ChatLatency] Message ${msg.id} latency: ${latency}ms (sent at ${new Date(sendTime).toISOString()}, received at ${new Date(receiveTime).toISOString()})`);
                messageSendTimesRef.current.delete(msg.id); // Clean up
              } else {
                // Message sent by other user, but we don't have send time (normal case)
                // This means it was sent before we started tracking or from another device
                debugLog(`[ChatLatency] Received message ${msg.id} from other user (no send time tracked)`);
              }
            }
          });
          
          // Track receive time for latency analysis
          lastReceivedMessageTimeRef.current = receiveTime;
          
          // Añadir solo los mensajes nuevos al final, preservando todos los anteriores
          addMessages(currentMatchId, newMessages);
        }
        // Si no hay mensajes nuevos, no hacer nada para preservar los mensajes anteriores cargados
      }

      if (orderedMessages.length > 0) {
        const latestMessage = orderedMessages[orderedMessages.length - 1];
        const oldestMessage = orderedMessages[0];
        updateMatch(currentMatchId, { lastMessage: latestMessage });
        
        // Actualizar referencias
        lastMessageIdRef.current = latestMessage.id;
        if (isInitialLoad.current) {
          oldestMessageCursorRef.current = oldestMessage.id;
        }
        
        // Usar hasMore del backend en lugar de calcularlo
        // Actualizar hasMoreMessages durante la carga inicial
        // También actualizar cuando no hay cursor (chat nuevo sin mensajes anteriores cargados)
        // o cuando el mensaje más antiguo es el primero (no hay mensajes anteriores)
        if (isInitialLoad.current) {
          // Usar pagination.hasMore del backend si está disponible, sino calcularlo
          const hasMore = result.data.pagination?.hasMore ?? (result.data.messages.length === 25);
          setHasMoreMessages(hasMore);
        } else if (!oldestMessageCursorRef.current) {
          // Si no hay cursor, significa que no hemos cargado mensajes anteriores
          // Usar pagination.hasMore del backend para determinar si hay más mensajes anteriores
          const hasMore = result.data.pagination?.hasMore ?? false;
          setHasMoreMessages(hasMore);
        }
        // Durante el polling con mensajes anteriores ya cargados, no actualizar para preservar el estado
        
        // Auto-scroll solo si llegó un mensaje nuevo Y el usuario está abajo
        if (hasNewMessage && isUserAtBottom.current && hasScrolledToBottom.current) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      } else {
        updateMatch(currentMatchId, { lastMessage: undefined });
        // Si no hay mensajes, no hay más mensajes anteriores
        if (isInitialLoad.current || !oldestMessageCursorRef.current) {
          setHasMoreMessages(false);
        }
      }

      // Mark messages as read:
      // 1. When opening the chat (initial load)
      // 2. When new messages arrive while user is viewing the chat
      // Note: Periodic marking is handled by a separate interval
      const shouldMarkAsRead = 
        (isInitialLoad.current || hasNewMessage) && 
        currentToken && 
        activeChatSession.canMarkAsRead();
      
      if (shouldMarkAsRead) {
        activeChatSession.markAsReadDone();
        hasMarkedAsReadRef.current = true;
        lastMarkAsReadTimeRef.current = Date.now();
        // Mark as read with current timestamp to ensure server has the exact read time
        const readAt = new Date();
        matchApiRef.current.markAsRead(currentMatchId, currentToken, readAt).catch((error) => {
          console.error('[ChatScreen] Failed to mark messages as read:', error);
          // Reset flag on error so we can retry
          activeChatSession.markedAsRead = false;
          hasMarkedAsReadRef.current = false;
        });
      }
    } catch (error) {
      console.error('Failed to load chat messages', error);
      setError('Network error. Please try again.');
      if (isInitialLoad.current) {
        // Network errors are system errors with retry
        notifySystem('Something went wrong', 'Try again', error, loadMessages);
      }
    } finally {
      isLoadingMessagesRef.current = false;
      // Mark load as complete (no specific endLoad needed with new system)
      if (isInitialLoad.current) {
        setLoading(false);
        // Mark initial load as complete after messages have been loaded
        // This ensures the opener template logic works even if scroll doesn't complete
        hasInitialLoadCompleted.current = true;
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

  // Lightweight match-alive heartbeat: checks if match still exists (detects if blocked/closed)
  const checkMatchAlive = useCallback(async () => {
    const currentMatchId = matchIdRef.current;
    const currentToken = tokensRef.current;

    if (!currentToken || !currentMatchId || isBlocked) {
      return;
    }

    try {
      // Lightweight check: getMessages with limit=1 to verify match exists
      // This will return 404/403 if match is closed/blocked
      const result = await chatApiRef.current.getMessages(currentMatchId, 1, undefined, currentToken);
      
      if (!result.success) {
        // Match not found (404) or forbidden (403) means match is closed/blocked
        const statusCode = result.error.statusCode;
        const isMatchClosed = statusCode === 404 || statusCode === 403;
        if (isMatchClosed && !isBlocked) {
          debugLog(`[ChatScreen] Match ${currentMatchId} is closed/blocked (statusCode: ${statusCode}) - setting isBlocked`);
          setIsBlocked(true);
        }
      }
      // If success, match is still alive - no action needed
    } catch (error) {
      // Check if error indicates match closure (403/404), otherwise ignore transient network errors
      const statusCode = getStatusCode(error);
      if (statusCode === 403 || statusCode === 404) {
        if (!isBlocked) {
          debugLog(`[ChatScreen] Match ${currentMatchId} is closed/blocked (caught error, statusCode: ${statusCode}) - setting isBlocked`);
          setIsBlocked(true);
        }
      } else {
        // Network errors (no status code) are ignored - don't mark as blocked on transient failures
        debugLog(`[ChatScreen] Match heartbeat check failed (ignored, no statusCode):`, error);
      }
    }
  }, [isBlocked, getStatusCode]);

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
    // 5 seconds provides good balance between responsiveness and API load
    // Reduced from 30s to improve message delivery latency
    const pollInterval = 5000; // 5 seconds

    const interval = setInterval(() => {
      const componentId = `ChatScreen-${componentInstanceId.current}`;
      const intervalTime = Date.now();
      // Only poll if not currently loading and not in initial load
      if (!isLoadingMessagesRef.current && !isInitialLoad.current && activeChatSession.canLoadMessages()) {
        debugLog(`[${componentId}] Polling INTERVAL TRIGGERED at ${new Date(intervalTime).toISOString()}, matchId: ${matchId}, timeSinceMount: ${intervalTime - mountTime.current}ms`);
        loadMessages();
      } else {
        debugLog(`[${componentId}] Polling skipped - loading: ${isLoadingMessagesRef.current}, initialLoad: ${isInitialLoad.current}, canLoad: ${activeChatSession.canLoadMessages()}`);
      }
    }, pollInterval);
    
    // Periodically mark messages as read while user is viewing the chat
    // This ensures that messages are marked as read even if user doesn't interact
    // Mark every 10 seconds while chat is active
    const markAsReadInterval = setInterval(() => {
      const currentToken = tokensRef.current;
      const currentMatchId = matchIdRef.current;
      const now = Date.now();
      
      // Only mark if:
      // 1. Chat is active and not in initial load
      // 2. At least 5 seconds have passed since last mark (to avoid too frequent calls)
      // 3. User is viewing the chat (session is active)
      // Note: We don't check canMarkAsRead() here because we want to mark periodically
      // even if we've already marked before (to update the timestamp)
      if (
        currentToken && 
        currentMatchId && 
        !isInitialLoad.current && 
        activeChatSession.isActive &&
        activeChatSession.matchId === currentMatchId &&
        (now - lastMarkAsReadTimeRef.current) >= 5000
      ) {
        debugLog(`[ChatScreen] Periodically marking messages as read for matchId: ${currentMatchId}`);
        lastMarkAsReadTimeRef.current = now;
        const readAt = new Date();
        matchApiRef.current.markAsRead(currentMatchId, currentToken, readAt).catch((error) => {
          console.error('[ChatScreen] Failed to periodically mark messages as read:', error);
        });
      }
    }, 10000); // Check every 10 seconds
    
    markAsReadIntervalRef.current = markAsReadInterval;
    
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
      // Clear intervals
      if (matchHeartbeatIntervalRef.current) {
        clearInterval(matchHeartbeatIntervalRef.current);
        matchHeartbeatIntervalRef.current = null;
      }
      if (interval) {
        clearInterval(interval);
      }
      if (markAsReadIntervalRef.current) {
        clearInterval(markAsReadIntervalRef.current);
        markAsReadIntervalRef.current = null;
      }
      // End chat session on unmount
      activeChatSession.endSession();
      // Clear mark-as-read interval
      if (markAsReadIntervalRef.current) {
        clearInterval(markAsReadIntervalRef.current);
        markAsReadIntervalRef.current = null;
      }
      
      // Always mark messages as read when leaving the chat (to ensure last viewed messages are marked)
      const currentToken = tokensRef.current;
      const currentMatchId = matchIdRef.current;
      if (currentToken && currentMatchId) {
        // Reset the flag to allow marking as read
        activeChatSession.markedAsRead = false;
        // Mark as read with current timestamp
        const readAt = new Date();
        matchApiRef.current.markAsRead(currentMatchId, currentToken, readAt).catch((error) => {
          console.error(`[${componentId}] Failed to mark messages as read on unmount:`, error);
        });
      }
    };
  }, [matchId]); // Re-run when matchId changes to setup polling for new chat

  // Poll immediately when chat screen comes into focus (user navigates back to chat)
  useFocusEffect(
    useCallback(() => {
      if (!matchId || isInitialLoad.current) {
        return; // Skip if no matchId or still in initial load
      }

      // Small delay to ensure component is ready
      const timeoutId = setTimeout(() => {
        if (activeChatSession.canLoadMessagesImmediate()) {
          debugLog('[ChatScreen] Screen focused - triggering immediate poll');
          activeChatSession.markImmediateLoad();
          loadMessages();
        }
      }, 200);

      return () => {
        clearTimeout(timeoutId);
      };
    }, [matchId, loadMessages])
  );

  // Poll when app comes to foreground (user switches back to app)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && matchId && !isInitialLoad.current) {
        // App came to foreground - poll for new messages
        if (activeChatSession.canLoadMessagesImmediate()) {
          debugLog('[ChatScreen] App came to foreground - triggering immediate poll');
          activeChatSession.markImmediateLoad();
          loadMessages();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [matchId, loadMessages]);

  // Match-alive heartbeat: check if match still exists every 15 seconds while screen is focused
  // This detects if the other user closed/blocked the chat
  useFocusEffect(
    useCallback(() => {
      if (!matchId || isInitialLoad.current || isBlocked) {
        return;
      }

      // Start heartbeat interval
      const heartbeatInterval = setInterval(() => {
        if (!isBlocked && !isInitialLoad.current) {
          debugLog(`[ChatScreen] Match heartbeat check triggered for matchId: ${matchId}`);
          checkMatchAlive();
        }
      }, 15000); // 15 seconds

      matchHeartbeatIntervalRef.current = heartbeatInterval;

      // Cleanup on unfocus/unmount
      return () => {
        if (matchHeartbeatIntervalRef.current) {
          clearInterval(matchHeartbeatIntervalRef.current);
          matchHeartbeatIntervalRef.current = null;
        }
      };
    }, [matchId, checkMatchAlive, isBlocked])
  );

  // Check if this match still exists (detect if blocked)
  useEffect(() => {
    if (!matchId || !matches) return;

    const matchExists = matches.some((m) => m.id === matchId);
    if (!matchExists && !isInitialLoad.current) {
      // Match was removed (likely blocked)
      setIsBlocked(true);
    }
  }, [matchId, matches]);

  // Handle blank chat opener initialization
  // Only show opener if chat is completely empty (no messages from anyone)
  // This ensures the template only appears for truly new chats, not chats with existing messages
  // We need to check that initial load has completed AND messages have been loaded
  // Use persistent hasSentMessage check instead of session-only ref
  const shouldShowOpener = 
    !isLoading && 
    hasInitialLoadCompleted.current &&  // Ensure initial load has completed (independent of scroll)
    matchMessages.length === 0 && 
    !isBot && 
    !hasSentMessage && // Use persistent check instead of hasSentMessageInSessionRef
    !hasSentMessageInSessionRef.current; // Also check session ref for immediate feedback
    
  useEffect(() => {
    // Check if current message is one of the templates
    const isTemplateMessage = OPENER_TEMPLATES.includes(message);
    
    if (shouldShowOpener && message === '' && !userClearedInputRef.current) {
      // Only set initial template when chat is blank, input is empty, user hasn't cleared it, and hasn't sent a message yet
      setMessage(OPENER_TEMPLATES[openerTemplateIndex]);
    } else if (!shouldShowOpener && isTemplateMessage && !userClearedInputRef.current) {
      // Clear template if chat is no longer blank (messages were loaded) or if loading is still in progress
      setMessage('');
    }
  }, [shouldShowOpener, message, openerTemplateIndex, isLoading]);

  // Redirect if blocked
  useEffect(() => {
    if (isBlocked) {
      // Chat blocked is an informational state - use Alert for navigation action
      // This is not an error, it's a state change notification
      Alert.alert(
        'Chat unavailable',
        'This chat is no longer available.',
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

  // Constants for message limits
  const MESSAGE_MAX_LENGTH = 500;
  const SHOW_COUNTER_THRESHOLD = Math.floor(MESSAGE_MAX_LENGTH * 0.7); // 70% = 350
  const WARNING_THRESHOLD = Math.floor(MESSAGE_MAX_LENGTH * 0.9); // 90% = 450

  // Calculate remaining characters
  const remainingChars = MESSAGE_MAX_LENGTH - message.length;
  const shouldShowCounter = message.length >= SHOW_COUNTER_THRESHOLD;
  const isWarning = message.length >= WARNING_THRESHOLD;
  const isAtLimit = message.length >= MESSAGE_MAX_LENGTH;

  // Handle text input change with paste detection
  const handleTextChange = useCallback((text: string) => {
    // If text exceeds limit, truncate it
    if (text.length > MESSAGE_MAX_LENGTH) {
      const truncated = text.substring(0, MESSAGE_MAX_LENGTH);
      setMessage(truncated);
      // Store the excess text for potential split
      const excess = text.substring(MESSAGE_MAX_LENGTH);
      if (excess.trim().length > 0) {
        setPastedTextToSplit(excess);
      } else {
        setPastedTextToSplit(null);
      }
    } else {
      setMessage(text);
      // Clear pasted text if user modifies the text (typing or deleting)
      // Only clear if the current text is different from what would be the first part
      if (pastedTextToSplit) {
        // If user has modified the text significantly, clear the split option
        setPastedTextToSplit(null);
      }
    }
  }, [MESSAGE_MAX_LENGTH, pastedTextToSplit]);

  // Internal send message function
  const handleSendMessageInternal = useCallback(async (messageContent: string) => {
    if (!messageContent || !tokens?.accessToken || !matchId || isSending || isBlocked) {
      return;
    }

    // Clear the input immediately when user clicks send (optimistic update)
    console.log('[ChatScreen] Clearing message input immediately');
    setMessage('');
    setPastedTextToSplit(null);
    
    setSending(true);
    clearError();

    try {
      console.log('[ChatScreen] Sending message:', { matchId, isBot, messageLength: messageContent.length });
      
      const result = await chatApi.sendMessage(
        matchId,
        { content: messageContent },
        tokens.accessToken,
      );

      console.log('[ChatScreen] Send result:', { success: result.success, hasData: result.success && !!result.data });

      if (!result.success) {
        // Check if match/chat is closed (403/404)
        const statusCode = result.error.statusCode;
        const isMatchClosed = statusCode === 404 || statusCode === 403;
        
        if (isMatchClosed) {
          // Match/chat is closed - stop send flow and trigger chat unavailable UX
          debugLog(`[ChatScreen] Match ${matchIdRef.current} is closed/blocked during send (statusCode: ${statusCode}) - setting isBlocked`);
          setIsBlocked(true);
          // Don't restore message - chat is closed
          return;
        }
        
        // Other errors - show error and restore message
        const messageText = result.error.message || 'Could not send your message.';
        setError(messageText);
        // API errors sending message are system errors
        notifySystem('Something went wrong', 'Try again', result.error);
        // Restore message on error so user can retry
        setMessage(messageContent);
        return;
      }

      const validation = MessageSchema.safeParse(result.data.message);
      if (!validation.success) {
        console.warn('[ChatScreen] Validation failed:', validation.error);
        // Validation errors from server are system errors (server bug)
        notifySystem('Something went wrong', 'Try again', validation.error);
        console.warn('Invalid message payload received from server', validation.error);
        return;
      }

      console.log('[ChatScreen] Adding message to store');
      
      // Latency instrumentation: track send time for this message
      const sendTime = Date.now();
      messageSendTimesRef.current.set(validation.data.id, sendTime);
      debugLog(`[ChatLatency] Tracked send time for message ${validation.data.id} at ${new Date(sendTime).toISOString()}`);
      
      addMessage(matchId, validation.data);
      updateMatch(matchId, { lastMessage: validation.data });

      // Mark that user has sent a message in this session
      hasSentMessageInSessionRef.current = true;
      // Also update persistent state
      setHasSentMessage(true);

      // Actualizar referencia y hacer scroll cuando se envía un mensaje
      lastMessageIdRef.current = validation.data.id;
      if (hasScrolledToBottom.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }

      // Trigger immediate poll to check for responses (improves latency)
      // This helps the other user see the message faster if they're also in the chat
      if (!isInitialLoad.current && activeChatSession.canLoadMessagesImmediate()) {
        // First poll after 300ms - fast enough to catch immediate responses
        setTimeout(() => {
          if (activeChatSession.canLoadMessagesImmediate()) {
            debugLog('[ChatScreen] Triggering immediate poll after sending message (300ms)');
            activeChatSession.markImmediateLoad();
            loadMessages();
          }
        }, 300);
        
        // Follow-up poll after 1 second to catch any delayed responses
        setTimeout(() => {
          if (activeChatSession.canLoadMessagesImmediate()) {
            debugLog('[ChatScreen] Triggering follow-up poll after sending message (1s)');
            activeChatSession.markImmediateLoad();
            loadMessages();
          }
        }, 1000);
      }
    } catch (error) {
      const statusCode = getStatusCode(error);
      const isMatchClosed = statusCode === 403 || statusCode === 404;
      
      if (isMatchClosed) {
        // Match/chat is closed - stop send flow and trigger chat unavailable UX
        debugLog(`[ChatScreen] Match ${matchIdRef.current} is closed/blocked during send (caught error, statusCode: ${statusCode}) - setting isBlocked`);
        setIsBlocked(true);
        // Don't restore message - chat is closed
        return;
      }
      
      // Network/other errors - show error
      console.error('[ChatScreen] Failed to send message', error);
      const fallbackMessage = 'Network error. Please try again.';
      setError(fallbackMessage);
      Alert.alert('Error', fallbackMessage);
      // Restore message on network error so user can retry
      setMessage(messageContent);
    } finally {
      setSending(false);
    }
  }, [
    addMessage,
    chatApi,
    clearError,
    getStatusCode,
    isBlocked,
    isBot,
    isSending,
    matchId,
    setError,
    setSending,
    tokens?.accessToken,
    updateMatch,
  ]);

  // Handle split message action
  const handleSplitMessage = useCallback(() => {
    if (!pastedTextToSplit) return;
    
    // Send first part (current message)
    const firstPart = message.trim();
    if (firstPart && tokens?.accessToken && matchId && !isSending && !isBlocked) {
      // Send first part
      handleSendMessageInternal(firstPart);
      
      // Set second part in input
      setMessage(pastedTextToSplit.substring(0, MESSAGE_MAX_LENGTH));
      setPastedTextToSplit(null);
    }
  }, [pastedTextToSplit, message, tokens?.accessToken, matchId, isSending, isBlocked, MESSAGE_MAX_LENGTH, handleSendMessageInternal]);

  // Public send message function
  const handleSendMessage = useCallback(async () => {
    const messageContent = message.trim();
    await handleSendMessageInternal(messageContent);
  }, [message, handleSendMessageInternal]);

  // Blank chat opener functions
  const handleChangeOpener = useCallback(() => {
    userClearedInputRef.current = false; // Reset clear flag when changing template
    setOpenerTemplateIndex((prev) => (prev + 1) % OPENER_TEMPLATES.length);
    setMessage(OPENER_TEMPLATES[(openerTemplateIndex + 1) % OPENER_TEMPLATES.length]);
  }, [openerTemplateIndex]);

  const handleClearOpener = useCallback(() => {
    userClearedInputRef.current = true; // Mark that user intentionally cleared
    setMessage('');
  }, []);

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
        // API errors blocking user are system errors
        notifySystem('Something went wrong', 'Try again', result.error, handleBlockUser);
        return;
      }

      // Navigate back to matches screen
      router.replace('/(app)/matches');
    } catch (error) {
      console.error('Failed to block user', error);
      // Network errors are system errors with retry
      notifySystem('Something went wrong', 'Try again', error, handleBlockUser);
    } finally {
      setIsBlocking(false);
    }
  }, [blockApi, matchId, otherUserId, router, tokens?.accessToken]);

  const handleAvatarPress = useCallback(() => {
    // If it's Doc Love (bot), only show the photo
    if (isBot) {
      router.push({
        pathname: '/chat/avatar-view',
        params: {
          photoUrl: photoUrl ?? '',
          isBot: 'true',
        },
      });
      return;
    }

    // Get match to access otherUser bio and show_bio_in_feed
    const currentMatch = matchId ? matches.find(m => m.id === matchId) : null;
    const otherUserBio = currentMatch?.otherUser?.bio;
    const otherUserShowBioInFeed = currentMatch?.otherUser?.show_bio_in_feed;
    const otherUserBirthDate = currentMatch?.otherUser?.birthDate;
    const otherUserGender = (currentMatch?.otherUser as any)?.gender;

    router.push({
      pathname: '/chat/avatar-view',
      params: {
        photoUrl: photoUrl ?? '',
        name: otherUserName ?? 'User',
        otherUserId: otherUserId ?? '',
        otherUserBio: otherUserBio ?? '',
        otherUserShowBioInFeed: otherUserShowBioInFeed !== undefined && otherUserShowBioInFeed !== null 
          ? String(otherUserShowBioInFeed) 
          : '',
        matchId: matchId ?? '',
        birthDate: otherUserBirthDate ?? '',
        gender: otherUserGender ?? '',
      },
    });
  }, [photoUrl, otherUserName, otherUserId, matchId, matches, router, isBot]);

  // Adjuntar archivos (Doc Love) — comentado
  // const handleAttachZip = useCallback(async () => {
  //   console.log('[ChatScreen] handleAttachZip called', { userId: user?.id, isUploadingZip, isBlocked });
  //
  //   if (!user?.id || isUploadingZip || isBlocked) {
  //     console.log('[ChatScreen] Early return:', { hasUserId: !!user?.id, isUploadingZip, isBlocked });
  //     return;
  //   }
  //
  //   clearError();
  //
  //   try {
  //     console.log('[ChatScreen] Step 1: Picking ZIP file...');
  //     const pickResult = await pickZipFile();
  //     console.log('[ChatScreen] Pick result:', { success: pickResult.success, hasData: !!pickResult.success && !!pickResult.data });
  //
  //     if (!pickResult.success) {
  //       console.error('[ChatScreen] Pick failed:', pickResult.error);
  //       setUploadErrorMessage(pickResult.error.message);
  //       setShowUploadErrorModal(true);
  //       setError(pickResult.error.message);
  //       return;
  //     }
  //
  //     if (!pickResult.data) {
  //       console.log('[ChatScreen] User cancelled file pick');
  //       return;
  //     }
  //
  //     setIsUploadingZip(true);
  //     console.log('[ChatScreen] Step 2: Uploading ZIP file...', { fileName: pickResult.data.name, fileSize: pickResult.data.size });
  //     const uploadResult = await uploadZipFile(pickResult.data);
  //     console.log('[ChatScreen] Upload result:', { success: uploadResult.success });
  //
  //     setIsUploadingZip(false);
  //
  //     if (!uploadResult.success) {
  //       console.error('[ChatScreen] Upload failed:', uploadResult.error);
  //       setUploadErrorMessage(uploadResult.error.message);
  //       setShowUploadErrorModal(true);
  //       setError(uploadResult.error.message);
  //       return;
  //     }
  //
  //     console.log('[ChatScreen] Upload successful!');
  //     setShowUploadSuccessModal(true);
  //   } catch (error) {
  //     console.error('[ChatScreen] Error uploading ZIP:', error);
  //     const errorMessage = error instanceof Error ? error.message : 'Upload failed. Please try again.';
  //     setIsUploadingZip(false);
  //     setUploadErrorMessage(errorMessage);
  //     setShowUploadErrorModal(true);
  //     setError(errorMessage);
  //   }
  // }, [user?.id, isUploadingZip, isBlocked, clearError, setError]);

  const handleBuildProfile = useCallback(async () => {
    if (!tokens?.accessToken || isBuildingProfile) return;
    setIsBuildingProfile(true);
    try {
      if (matchId) {
        await chatApi.postBuildProfileTapped(matchId, tokens.accessToken);
        setShowBuildProfileButton(false);
      }
      const result = await profileApi.generateProfile(tokens.accessToken);
      if (result.success) {
        Alert.alert('Profile built', result.data.message);
      } else {
        const msg = result.error?.message ?? 'Could not build profile. Try again later.';
        Alert.alert('Error', msg);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not build profile. Try again later.';
      Alert.alert('Error', msg);
    } finally {
      setIsBuildingProfile(false);
    }
  }, [matchId, tokens?.accessToken, isBuildingProfile, profileApi, chatApi]);

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
              onPress={() => {
                if (fromDiscover) {
                  router.push('/(app)/matches');
                } else {
                  router.back();
                }
              }}
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
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setShowMenu(true)}
              style={styles.menuButton}
            >
              <Ionicons name="ellipsis-vertical" size={24} color="#333" />
            </TouchableOpacity>
          ),
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
                          Load earlier messages
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
              ListFooterComponent={
                isBot && showBuildProfileButton ? (
                  <View style={styles.buildProfileButtonWrap}>
                    <TouchableOpacity
                      style={styles.buildProfileButton}
                      onPress={handleBuildProfile}
                      disabled={isBuildingProfile || !tokens?.accessToken}
                      activeOpacity={0.8}
                    >
                      {isBuildingProfile ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.buildProfileButtonText}>Build my profile</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null
              }
            />
          </View>

          {/* Blank chat opener tip card */}
          {shouldShowOpener && (
            <View style={styles.openerTipContainer}>
              <Text style={styles.openerTipText}>
                {affinitySentence || 'Initial affinity is low—conversation will sharpen recommendations.'}
              </Text>
            </View>
          )}

          <View style={[
            styles.inputContainer,
            Platform.OS === 'android' && { marginBottom: keyboardHeight > 0 ? keyboardHeight : 0 }
          ]}>
            {/* Adjuntar archivos (Doc Love) — comentado
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
            */}
            <View style={styles.textInputWrapper}>
              <TextInput
                style={[
                  styles.textInput,
                  isBlocked && styles.textInputDisabled,
                  isAtLimit && styles.textInputAtLimit,
                  shouldShowCounter && styles.textInputWithCounter
                ]}
                value={message}
                onChangeText={handleTextChange}
                placeholder={isBlocked ? 'Chat unavailable' : 'Type a message...'}
                multiline
                maxLength={MESSAGE_MAX_LENGTH}
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
              {shouldShowCounter && (
                <View style={styles.counterContainer}>
                  <Text style={[
                    styles.counterText,
                    isWarning && styles.counterTextWarning,
                    isAtLimit && styles.counterTextAtLimit
                  ]}>
                    {remainingChars}
                  </Text>
                </View>
              )}
              {pastedTextToSplit && (
                <View style={styles.splitMessageContainer}>
                  <Text style={styles.splitMessageText}>
                    Text was too long and was truncated.
                  </Text>
                  <TouchableOpacity
                    style={styles.splitButton}
                    onPress={handleSplitMessage}
                  >
                    <Text style={styles.splitButtonText}>Split into 2 messages</Text>
                  </TouchableOpacity>
                </View>
              )}
              {!pastedTextToSplit && (isWarning || isAtLimit) && (
                <View style={styles.helpTextContainer}>
                  {isAtLimit ? (
                    <Text style={styles.helpText}>
                      Send or split into 2 messages.
                    </Text>
                  ) : (
                    <Text style={styles.helpText}>
                      Tip: split into 2 messages.
                    </Text>
                  )}
                </View>
              )}
              {/* Blank chat opener buttons */}
              {shouldShowOpener && (
                <View style={styles.openerButtonsContainer}>
                  <TouchableOpacity
                    style={styles.openerButton}
                    onPress={handleChangeOpener}
                  >
                    <Text style={styles.openerButtonText}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.openerButton, styles.openerButtonClear]}
                    onPress={handleClearOpener}
                  >
                    <Text style={styles.openerButtonTextClear}>Clear</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
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
            {isBot ? (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  setShowAboutDocLoveModal(true);
                }}
              >
                <Ionicons name="information-circle" size={20} color="#e91e63" />
                <Text style={styles.menuItemText}>About Doc Love</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowMenu(false);
                    handleAvatarPress();
                  }}
                >
                  <Ionicons 
                    name={Platform.OS === 'ios' ? 'person-circle' : 'person'} 
                    size={20} 
                    color="#666666" 
                    style={styles.menuItemIcon}
                  />
                  <Text style={styles.menuItemText}>View profile</Text>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowMenu(false);
                    setShowAffinityModal(true);
                  }}
                >
                  <Ionicons 
                    name={Platform.OS === 'ios' ? 'star' : 'stats-chart-outline'} 
                    size={20} 
                    color="#666666" 
                    style={styles.menuItemIcon}
                  />
                  <Text style={styles.menuItemText}>Affinity</Text>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowMenu(false);
                    setShowBlockModal(true);
                  }}
                >
                  <Ionicons 
                    name={Platform.OS === 'ios' ? 'close-circle' : 'ban'} 
                    size={20} 
                    color="#d32f2f" 
                    style={styles.menuItemIcon}
                  />
                  <Text style={styles.menuItemDestructiveText}>End conversation</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Affinity Modal */}
      <Modal
        visible={showAffinityModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAffinityModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAffinityModal(false)}
        >
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Affinity</Text>
            <Text style={styles.modalText}>
              {affinitySentence || 'Initial affinity is low—conversation will sharpen recommendations.'}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonConfirm]}
              onPress={() => setShowAffinityModal(false)}
            >
              <Text style={styles.modalButtonTextConfirm}>Close</Text>
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
            <Text style={styles.modalTitle}>End conversation?</Text>
            <Text style={styles.modalText}>
              Once closed, the chat ends for both of you and can’t be reopened.{'\n'}
              Discover will be available again after.{'\n'}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowBlockModal(false)}
                disabled={isBlocking}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleBlockUser}
                disabled={isBlocking}
              >
                {isBlocking ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonTextConfirm}>End conversation</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Adjuntar archivos (Doc Love) — Upload Success Modal comentado
      <Modal
        visible={showUploadSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUploadSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Ionicons name="checkmark-circle" size={64} color="#4caf50" style={styles.successIcon} />
            <Text style={styles.modalTitle}>File uploaded!</Text>
            <Text style={styles.modalText}>
              Your file was uploaded successfully.
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonConfirm]}
              onPress={() => setShowUploadSuccessModal(false)}
            >
              <Text style={styles.modalButtonTextConfirm}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showUploadErrorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUploadErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Ionicons name="close-circle" size={64} color="#f44336" style={styles.successIcon} />
            <Text style={styles.modalTitle}>Upload error</Text>
            <View style={styles.modalTextContainer}>
              {uploadErrorMessage ? (
                uploadErrorMessage.includes('Maximum allowed') ? (
                  <>
                    <Text style={styles.modalText}>Maximum size allowed: 500 KB.</Text>
                    <Text style={styles.modalText}>Do not upload multimedia content.</Text>
                  </>
                ) : (
                  <Text style={styles.modalText}>
                    {uploadErrorMessage}
                  </Text>
                )
              ) : (
                <Text style={styles.modalText}>
                  Couldn't upload the file. Please try again.
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonConfirm]}
              onPress={() => setShowUploadErrorModal(false)}
            >
              <Text style={styles.modalButtonTextConfirm}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      */}

      {/* About Doc Love Modal */}
      <Modal
        visible={showAboutDocLoveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAboutDocLoveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.aboutDocLoveTitle}>Info</Text>
            <View style={styles.modalTextContainer}>
              <Text style={styles.modalText}>
                Doc Love helps you discover better matches by asking thoughtful questions over time.
                {'\n\n'}
                If you don't feel like answering a question, you can simply skip it or ask for a different one. You can answer briefly or go into more detail — whatever feels natural.
                {'\n\n'}
                What you share with Doc Love (and your in-app chats) helps Wodates improve your future match recommendations.
                {'\n\n'}
                One key rule: you can only have one active human chat at a time — while you're matched, Discover pauses.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonConfirm]}
              onPress={() => setShowAboutDocLoveModal(false)}
            >
              <Text style={styles.modalButtonTextConfirm}>Got it</Text>
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
    overflow: 'visible',
  },
  // Adjuntar archivos (Doc Love) — comentado
  // attachButton: {
  //   marginRight: 8,
  //   padding: 8,
  //   justifyContent: 'center',
  //   alignItems: 'center',
  // },
  textInputWrapper: {
    flex: 1,
    marginRight: 12,
    position: 'relative',
    overflow: 'visible',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  textInputWithCounter: {
    paddingRight: 50, // Make room for counter when visible
  },
  textInputDisabled: {
    backgroundColor: '#f0f0f0',
    color: '#999',
  },
  textInputAtLimit: {
    borderColor: '#ff9800',
  },
  counterContainer: {
    position: 'absolute',
    top: 10,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    zIndex: 10,
    elevation: 5, // For Android
    shadowColor: '#000', // For iOS and web
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    pointerEvents: 'none', // Allow touches to pass through to input
  },
  counterText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  counterTextWarning: {
    color: '#ff9800',
  },
  counterTextAtLimit: {
    color: '#f44336',
  },
  helpTextContainer: {
    marginTop: 4,
    paddingHorizontal: 4,
  },
  helpText: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  splitMessageContainer: {
    marginTop: 4,
    paddingHorizontal: 4,
    paddingVertical: 6,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  splitMessageText: {
    fontSize: 12,
    color: '#856404',
    marginBottom: 4,
  },
  splitButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#ffc107',
    borderRadius: 6,
  },
  splitButtonText: {
    fontSize: 11,
    color: '#856404',
    fontWeight: '600',
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
  menuItemIcon: {
    marginRight: 0,
  },
  menuItemText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  menuItemDestructiveText: {
    fontSize: 16,
    color: '#d32f2f',
    fontWeight: '500',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    marginHorizontal: 0,
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
  buildProfileButtonWrap: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  buildProfileButton: {
    backgroundColor: '#F45C5C',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildProfileButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  aboutDocLoveTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e91e63',
    marginBottom: 20,
    textAlign: 'center',
  },
  // Blank chat opener styles
  openerTipContainer: {
    backgroundColor: '#e8f5e8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  openerTipText: {
    fontSize: 14,
    color: '#2e7d32',
    textAlign: 'center',
    fontWeight: '500',
  },
  openerButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  openerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e91e63',
    backgroundColor: '#fff',
  },
  openerButtonClear: {
    borderColor: '#666',
  },
  openerButtonText: {
    fontSize: 12,
    color: '#e91e63',
    fontWeight: '600',
  },
  openerButtonTextClear: {
    color: '#666',
  },
});
