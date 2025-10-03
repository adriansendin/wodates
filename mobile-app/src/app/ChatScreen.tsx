import React, { useEffect, useState } from 'react';
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
import { useChatStore } from '../domain/stores/chatStore';
import { useAuthStore } from '../domain/stores/authStore';
import { ChatApi } from '../data/api/chatApi';
import { ApiClient } from '../data/api/apiClient';
import { Message } from '../domain/entities/Message';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface ChatScreenProps {
  route: {
    params: {
      matchId: string;
      otherUser: {
        id: string;
        name: string;
        photoUrl?: string;
      };
    };
  };
  navigation: any;
}

export default function ChatScreen({ route, navigation }: ChatScreenProps) {
  const { matchId, otherUser } = route.params;
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const { messages, addMessage, setMessages, setSending, setError } = useChatStore();
  const { tokens, user } = useAuthStore();
  
  const apiClient = new ApiClient(API_URL);
  const chatApi = new ChatApi(apiClient);

  const matchMessages = messages[matchId] || [];

  useEffect(() => {
    navigation.setOptions({
      title: otherUser.name,
    });
    
    loadMessages();
    
    // Set up polling for new messages (every 5 seconds)
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [matchId]);

  const loadMessages = async () => {
    if (!tokens?.accessToken) return;

    try {
      const result = await chatApi.getMessages(matchId, 50, undefined, tokens.accessToken);
      if (result.success) {
        setMessages(matchId, result.data.messages);
      }
    } catch (error) {
      // Silently fail for polling
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !tokens?.accessToken || isSending) return;

    const messageContent = message.trim();
    setMessage('');
    setIsSending(true);
    setSending(true);

    try {
      const result = await chatApi.sendMessage(matchId, { content: messageContent }, tokens.accessToken);
      if (result.success) {
        addMessage(matchId, result.data.message);
      } else {
        Alert.alert('Error', result.error.message);
        setMessage(messageContent); // Restore message on error
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
      setMessage(messageContent); // Restore message on error
    } finally {
      setIsSending(false);
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.senderId === user?.id;
    
    return (
      <View style={[styles.messageContainer, isOwn && styles.ownMessageContainer]}>
        <View style={[styles.messageBubble, isOwn && styles.ownMessageBubble]}>
          <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTime, isOwn && styles.ownMessageTime]}>
            {new Date(item.createdAt).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
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
