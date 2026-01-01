import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface MatchNotificationBannerProps {
  visible: boolean;
  otherUserName: string;
  onDismiss: () => void;
  onPress: () => void;
}

export const MatchNotificationBanner: React.FC<MatchNotificationBannerProps> = ({
  visible,
  otherUserName,
  onDismiss,
  onPress,
}) => {
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.touchable}
        onPress={onPress}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={['#e91e63', '#f06292']}
          style={styles.gradient}
        >
          <View style={styles.content}>
            <Text style={styles.emoji}>💕</Text>
            <View style={styles.textContainer}>
              <Text style={styles.title}>¡Conexión confirmada!</Text>
              <Text style={styles.message}>
                Tienes un nuevo chat exclusivo con {otherUserName}. Tu feed se
                ha pausado para que os conozcáis.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
            >
              <Text style={styles.dismissText}>✕</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  touchable: {
    width: '100%',
  },
  gradient: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  emoji: {
    fontSize: 32,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.95,
    lineHeight: 18,
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  dismissText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

