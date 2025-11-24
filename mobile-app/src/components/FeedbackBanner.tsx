import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface FeedbackBannerProps {
  type: 'success' | 'error';
  message: string;
  onClose?: () => void;
}

export const FeedbackBanner: React.FC<FeedbackBannerProps> = ({
  type,
  message,
  onClose,
}) => {
  return (
    <View
      style={[
        styles.container,
        type === 'success' ? styles.success : styles.error,
      ]}
    >
      <Text style={styles.message}>{message}</Text>
      {onClose && (
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    marginVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  success: {
    backgroundColor: '#D4EDDA',
    borderColor: '#C3E6CB',
    borderWidth: 1,
  },
  error: {
    backgroundColor: '#F8D7DA',
    borderColor: '#F5C6CB',
    borderWidth: 1,
  },
  message: {
    color: '#155724',
    fontSize: 14,
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#721C24',
  },
});
