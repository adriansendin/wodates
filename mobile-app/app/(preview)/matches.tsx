import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { RegistrationModal } from '../../src/components/RegistrationModal';
import { usePreviewStore } from '../../src/domain/stores/previewStore';

interface Message {
  id: string;
  content: string;
  senderId: string;
  isBot: boolean;
  createdAt: string;
}

// Doc Love messages in order
const DOC_LOVE_MESSAGES = [
  "Welcome to Wodates — serious relationships only.",
  "I'm Doc Love. I help you discover better matches through conversations.",
  "One key rule: you can only chat with one person at a time — Discover pauses during a match.",
  "Ready? In one sentence, what are you looking for in a relationship?",
];

const USER_RESPONSE_MESSAGE = "Perfect — that's the kind of signal I use to improve your matches.";

// Typing delays for each message (in ms)
const TYPING_DELAYS = [300, 800, 900, 700];
const USER_RESPONSE_TYPING_DELAY = 900;

export default function PreviewMatchesScreen() {
  const router = useRouter();
  const { exitPreview } = usePreviewStore();
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [hasSentMessage, setHasSentMessage] = useState(false);
  const [userMessage, setUserMessage] = useState('');
  const [inputText, setInputText] = useState('');
  const [displayedMessages, setDisplayedMessages] = useState<Message[]>([]);
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [showRegistrationPrompt, setShowRegistrationPrompt] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);
  const appStateRef = useRef(AppState.currentState);

  // Clear all timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  // Handle app state changes to pause/resume message sequence
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - resume if needed
        setIsVisible(true);
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background - pause
        setIsVisible(false);
        // Clear pending timeouts
        timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
        timeoutRefs.current = [];
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Handle screen focus/blur
  useFocusEffect(
    React.useCallback(() => {
      setIsVisible(true);
      return () => {
        setIsVisible(false);
        // Clear pending timeouts when screen loses focus
        timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
        timeoutRefs.current = [];
      };
    }, [])
  );

  // Sequential message display with typing indicators
  useEffect(() => {
    if (!isVisible || currentMessageIndex >= DOC_LOVE_MESSAGES.length || hasSentMessage) {
      setShowTypingIndicator(false);
      return;
    }

    const delay = TYPING_DELAYS[currentMessageIndex];
    let timeoutId: NodeJS.Timeout;
    
    // Show typing indicator
    setShowTypingIndicator(true);
    
    // After delay, hide typing and show message
    timeoutId = setTimeout(() => {
      if (!isVisible || currentMessageIndex >= DOC_LOVE_MESSAGES.length || hasSentMessage) {
        setShowTypingIndicator(false);
        return;
      }
      
      setShowTypingIndicator(false);
      const newMessage: Message = {
        id: `doc-${currentMessageIndex + 1}`,
        content: DOC_LOVE_MESSAGES[currentMessageIndex],
        senderId: 'doc-love',
        isBot: true,
        createdAt: new Date().toISOString(),
      };
      setDisplayedMessages((prev) => [...prev, newMessage]);
      setCurrentMessageIndex((prev) => prev + 1);
      
      // Auto-scroll
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, delay);
    
    timeoutRefs.current.push(timeoutId);

    return () => {
      clearTimeout(timeoutId);
      const index = timeoutRefs.current.indexOf(timeoutId);
      if (index > -1) {
        timeoutRefs.current.splice(index, 1);
      }
    };
  }, [currentMessageIndex, isVisible, hasSentMessage]);

  const handleSendMessage = () => {
    if (hasSentMessage || !inputText.trim()) return;
    
    const trimmedMessage = inputText.trim();
    if (trimmedMessage.length > 120) return;
    
    setUserMessage(trimmedMessage);
    setHasSentMessage(true);
    setInputText('');
    
    // Clear any pending timeouts
    timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
    timeoutRefs.current = [];
    
    // Add user message to displayed messages first
    const userMessageObj: Message = {
      id: 'user-message',
      content: trimmedMessage,
      senderId: 'user',
      isBot: false,
      createdAt: new Date().toISOString(),
    };
    setDisplayedMessages((prev) => [...prev, userMessageObj]);
    
    // Show typing indicator for response
    setShowTypingIndicator(true);
    
    const responseTimeout = setTimeout(() => {
      setShowTypingIndicator(false);
      const responseMessage: Message = {
        id: 'doc-response',
        content: USER_RESPONSE_MESSAGE,
        senderId: 'doc-love',
        isBot: true,
        createdAt: new Date().toISOString(),
      };
      setDisplayedMessages((prev) => [...prev, responseMessage]);
      
      // Show registration prompt after Doc Love's response
      setShowRegistrationPrompt(true);
      
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, USER_RESPONSE_TYPING_DELAY);
    
    timeoutRefs.current.push(responseTimeout);
  };

  // Auto-scroll when messages change
  useEffect(() => {
    if (displayedMessages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [displayedMessages.length]);

  const handleRegister = () => {
    setShowRegistrationModal(false);
    exitPreview();
    router.push('/(auth)/register/step3');
  };

  const handleDirectRegister = () => {
    exitPreview();
    router.push('/(auth)/register/step3');
  };

  const renderMessage = (message: Message) => {
    const isBot = message.isBot;
    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isBot ? styles.botMessage : styles.userMessage,
        ]}
      >
        <Text style={[styles.messageText, isBot ? styles.botMessageText : styles.userMessageText]}>
          {message.content}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        >
          {displayedMessages.map(renderMessage)}
        </ScrollView>

        {/* Input area - blocked after sending message */}
        <View style={styles.inputContainer}>
          {showRegistrationPrompt ? (
            <>
              <Text style={styles.blockedText}>
              To keep chatting with Doc Love, create a free account.
              </Text>
              <TouchableOpacity
                style={styles.registerButton}
                onPress={handleDirectRegister}
              >
                <Text style={styles.registerButtonText}>
                Create free account
                </Text>
              </TouchableOpacity>
              <Text style={styles.microText}>
                Takes less than 1 minute.
              </Text>
            </>
          ) : (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Type one sentence…"
                placeholderTextColor="#999"
                value={inputText}
                onChangeText={(text) => {
                  if (text.length <= 120) {
                    setInputText(text);
                  }
                }}
                editable={!hasSentMessage}
                maxLength={120}
                multiline={false}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  !inputText.trim() && styles.sendButtonDisabled,
                ]}
                onPress={handleSendMessage}
                disabled={!inputText.trim() || hasSentMessage}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Registration Modal */}
        <RegistrationModal
          visible={showRegistrationModal}
          onClose={() => setShowRegistrationModal(false)}
          onRegister={handleRegister}
          source="chats"
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageContainer: {
    maxWidth: '80%',
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
  },
  botMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0e0e0',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#e91e63',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  botMessageText: {
    color: '#333',
  },
  userMessageText: {
    color: '#fff',
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  sendButton: {
    backgroundColor: '#F45C5C',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  blockedText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 12,
  },
  registerButton: {
    backgroundColor: '#F45C5C',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  microText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  typingContainer: {
    opacity: 0.7,
  },
  typingText: {
    fontStyle: 'italic',
  },
});
