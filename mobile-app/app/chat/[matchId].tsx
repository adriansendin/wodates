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
} from 'react-native';
import { Stack, useLocalSearchParams, Redirect } from 'expo-router';
import { ApiClient } from '../../src/data/api/apiClient';
import { ChatApi } from '../../src/data/api/chatApi';
import { useAuthStore } from '../../src/domain/stores/authStore';
import { useChatStore } from '../../src/domain/stores/chatStore';
import { Message, MessageSchema } from '../../src/domain/entities/Message';
import { useMatchesStore } from '../../src/domain/stores/matchesStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default function ChatScreen() {
  const params = useLocalSearchParams<{
    matchId?: string | string[];
    name?: string | string[];
    photoUrl?: string | string[];
  }>();

  const matchId = useMemo(() => {
    if (!params.matchId) return undefined;
    return Array.isArray(params.matchId) ? params.matchId[0] : params.matchId;
  }, [params.matchId]);

  const otherUserName = useMemo(() => {
    if (!params.name) return undefined;
    return Array.isArray(params.name) ? params.name[0] : params.name;
  }, [params.name]);

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
  const updateMatch = useMatchesStore((state) => state.updateMatch);

  const [message, setMessage] = useState('');
  const flatListRef = useRef<FlatList<Message>>(null);

  const apiClient = useMemo(() => new ApiClient(API_URL), []);
  const chatApi = useMemo(() => new ChatApi(apiClient), [apiClient]);
  const isInitialLoad = useRef(true);

  const matchMessages = useMemo(
    () => (matchId ? messages[matchId] || [] : []),
    [matchId, messages],
  );

  useEffect(() => {
    isInitialLoad.current = true;
  }, [matchId]);

  useEffect(() => {
    if (matchMessages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [matchMessages.length]);

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

  const handleSendMessage = useCallback(async () => {
    const messageContent = message.trim();
    if (!messageContent || !tokens?.accessToken || !matchId || isSending) {
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
    isSending,
    matchId,
    message,
    setError,
    setSending,
    tokens?.accessToken,
    updateMatch,
  ]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.senderId === user?.id;

    return (
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
    );
  };

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!matchId) {
    return <Redirect href="/(app)/matches" />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: otherUserName ?? 'Chat',
          headerShown: true,
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          ref={flatListRef}
          data={matchMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={
            matchMessages.length === 0 ? styles.emptyListContainer : styles.messagesContent
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

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={message}
            onChangeText={setMessage}
            placeholder="Type a message..."
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!message.trim() || isSending) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!message.trim() || isSending}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingVertical: 16,
    paddingBottom: 24,
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
    fontSize: 12,
    color: '#666',
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
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
});
