import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useAuthStore } from '../../src/domain/stores/authStore';
import { useChatStore } from '../../src/domain/stores/chatStore';
import { Message, MessageSchema } from '../../src/domain/entities/Message';
import { useMatchesStore } from '../../src/domain/stores/matchesStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

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
  const params = useLocalSearchParams<{
    matchId?: string | string[];
    name?: string | string[];
    photoUrl?: string | string[];
    otherUserId?: string | string[];
  }>();

  const matchId = useMemo(() => {
    if (!params.matchId) return undefined;
    return Array.isArray(params.matchId) ? params.matchId[0] : params.matchId;
  }, [params.matchId]);

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

  const router = useRouter();
  const { tokens, user } = useAuthStore();
  const {
    messages,
    setMessages,
    addMessage,
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
  const flatListRef = useRef<FlatList<Message>>(null);

  const apiClient = useMemo(() => new ApiClient(API_URL), []);
  const chatApi = useMemo(() => new ChatApi(apiClient), [apiClient]);
  const blockApi = useMemo(() => new BlockApi(apiClient), [apiClient]);
  const isInitialLoad = useRef(true);

  const matchMessages = useMemo(
    () => (matchId ? messages[matchId] || [] : []),
    [matchId, messages],
  );

  useEffect(() => {
    isInitialLoad.current = true;
  }, [matchId]);

  // Scroll to end when messages change
  useEffect(() => {
    if (matchMessages.length > 0) {
      // Use setTimeout to ensure the layout has been updated
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [matchMessages.length]);

  // Handle keyboard show/hide events
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        // Scroll to bottom when keyboard appears
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
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

  const loadMessages = useCallback(async () => {
    if (!tokens?.accessToken || !matchId) {
      return;
    }

    if (isInitialLoad.current) {
      setLoading(true);
    }

    try {
      clearError();
      const result = await chatApi.getMessages(matchId, 50, undefined, tokens.accessToken);
      if (!result.success) {
        const messageText = result.error.message || 'Could not load messages.';
        setError(messageText);
        if (isInitialLoad.current) {
          Alert.alert('Error', messageText);
        }
        return;
      }

      const validation = MessageSchema.array().safeParse(result.data.messages);
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
      setMessages(matchId, orderedMessages);

      if (orderedMessages.length > 0) {
        const latestMessage = orderedMessages[orderedMessages.length - 1];
        updateMatch(matchId, { lastMessage: latestMessage, unreadCount: 0 });
      } else {
        updateMatch(matchId, { lastMessage: undefined, unreadCount: 0 });
      }
    } catch (error) {
      console.error('Failed to load chat messages', error);
      setError('Network error. Please try again.');
      if (isInitialLoad.current) {
        Alert.alert('Error', 'Network error. Please try again.');
      }
    } finally {
      if (isInitialLoad.current) {
        setLoading(false);
        isInitialLoad.current = false;
      }
    }
  }, [chatApi, clearError, matchId, setError, setLoading, setMessages, tokens?.accessToken, updateMatch]);

  useEffect(() => {
    if (!matchId) {
      return;
    }

    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [loadMessages, matchId]);

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

    setSending(true);
    clearError();

    try {
      const result = await chatApi.sendMessage(
        matchId,
        { content: messageContent },
        tokens.accessToken,
      );

      if (!result.success) {
        const messageText = result.error.message || 'Could not send your message.';
        setError(messageText);
        Alert.alert('Error', messageText);
        return;
      }

      const validation = MessageSchema.safeParse(result.data.message);
      if (!validation.success) {
        Alert.alert('Error', 'Received invalid message data.');
        console.warn('Invalid message payload received from server', validation.error);
        return;
      }

      addMessage(matchId, validation.data);
      updateMatch(matchId, { lastMessage: validation.data, unreadCount: 0 });
      setMessage('');
    } catch (error) {
      console.error('Failed to send message', error);
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
              onContentSizeChange={() => {
                // Auto-scroll to bottom when content size changes
                if (matchMessages.length > 0) {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }
              }}
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
            <TextInput
              style={[styles.textInput, isBlocked && styles.textInputDisabled]}
              value={message}
              onChangeText={setMessage}
              placeholder={isBlocked ? 'Chat no disponible' : 'Type a message...'}
              multiline
              maxLength={1000}
              editable={!isBlocked}
              onFocus={() => {
                // Scroll to bottom when input is focused
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }, 300);
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
  modalText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
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
});
