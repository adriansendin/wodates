import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FALLBACK_PHOTO from '../../assets/placeholder.png';

interface MatchConfirmationModalProps {
  visible: boolean;
  otherUserName: string;
  otherUserPhotoUrl?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

export const MatchConfirmationModal: React.FC<MatchConfirmationModalProps> = ({
  visible,
  otherUserName,
  otherUserPhotoUrl,
  onConfirm,
  onCancel,
  isConfirming = false,
}) => {
  const photoSource = otherUserPhotoUrl
    ? { uri: otherUserPhotoUrl }
    : FALLBACK_PHOTO;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#e91e63', '#f06292', '#f8bbd0']}
            style={styles.gradient}
          >
            <View style={styles.content}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Connection confirmed</Text>
              </View>

              {/* User photo */}
              <View style={styles.photoContainer}>
                <Image source={photoSource} style={styles.photo} />
              </View>

              {/* User name */}
              <Text style={styles.userName}>{otherUserName}</Text>

              {/* Explanation text */}
              <View style={styles.explanationContainer}>
                <Text style={styles.explanationText}>
                  Do you want to start an exclusive conversation with{' '}
                  {otherUserName}?
                </Text>
                <Text style={styles.explanationSubtext}>
                  If you continue, Discover will pause so you can focus on this
                  exclusive conversation.
                </Text>
              </View>

              {/* Buttons */}
              <View style={styles.buttonsContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={onCancel}
                  disabled={isConfirming}
                >
                  <Text style={styles.cancelButtonText}>Not now</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.confirmButton]}
                  onPress={onConfirm}
                  disabled={isConfirming}
                >
                  {isConfirming ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.confirmButtonText}>
                      Enter exclusive chat
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  gradient: {
    padding: 24,
  },
  content: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e91e63',
    textAlign: 'center',
  },
  photoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 4,
    borderColor: '#e91e63',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  explanationContainer: {
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  explanationText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  explanationSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#e91e63',
    shadowColor: '#e91e63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
});
