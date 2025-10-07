import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { Stack, useLocalSearchParams, Redirect } from 'expo-router';

// Simplified types for MVP
interface Message {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

// Simplified stores for MVP
const useAuthStore = () => {
  // Mock implementation for MVP
  return {
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' } as User,
    tokens: { accessToken: 'mock-token' }
  };
};

const useChatStore = () => {
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  
  return {
    messages,
    addMessage: (matchId: string, message: Message) => {
      setMessages(prev => ({
        ...prev,
        [matchId]: [...(prev[matchId] || []), message]
      }));
    },
    setMessages: (matchId: string, newMessages: Message[]) => {
      setMessages(prev => ({
        ...prev,
        [matchId]: newMessages
      }));
    },
    setSending: (sending: boolean) => {
      // Mock implementation
    }
  };
};

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
  const { messages, addMessage, setMessages, setSending } = useChatStore();

  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const matchMessages = matchId ? messages[matchId] || [] : [];

  const loadMessages = useCallback(async () => {
    if (!tokens?.accessToken || !matchId) return;

    try {
      // Mock implementation for MVP
      const mockMessages: Message[] = [
        {
          id: '1',
          matchId: matchId,
          senderId: 'other-user',
          content: 'Hello! How are you?',
          createdAt: new Date().toISOString()
        }
      ];
      setMessages(matchId, mockMessages);
    } catch {
      // Ignore polling errors to avoid noisy alerts
    }
  }, [matchId, setMessages, tokens?.accessToken]);

  useEffect(() => {
    if (!matchId) return;

    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [loadMessages, matchId]);

  const handleSendMessage = useCallback(async () => {
    if (!message.trim() || !tokens?.accessToken || !matchId || isSending) return;

    const messageContent = message.trim();
    setMessage('');
    setIsSending(true);
    setSending(true);

    try {
      // Mock implementation for MVP
      const newMessage: Message = {
        id: Date.now().toString(),
        matchId,
        senderId: user?.id || 'current-user',
        content: messageContent,
        createdAt: new Date().toISOString()
      };
      
      addMessage(matchId, newMessage);
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
      setMessage(messageContent);
    } finally {
      setIsSending(false);
      setSending(false);
    }
  }, [addMessage, isSending, matchId, message, setSending, tokens?.accessToken, user?.id]);

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
          data={matchMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          inverted
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
