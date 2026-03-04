import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';

type RegistrationSource = 'discover' | 'chats' | 'profile';

interface RegistrationModalProps {
  visible: boolean;
  onClose: () => void;
  onRegister: () => void;
  source: RegistrationSource;
  onSignIn?: () => void;
}

export const RegistrationModal: React.FC<RegistrationModalProps> = ({
  visible,
  onClose,
  onRegister,
  source,
  onSignIn,
}) => {
  const { t } = useTranslation('common');
  const content = {
    title: t('common.createAccountTitle'),
    body:
      source === 'chats'
        ? t('common.createAccountBodyChats')
        : source === 'profile'
          ? t('common.createAccountBodyProfile')
          : t('common.createAccountBodyDiscover'),
    primaryButton: t('common.createFreeAccount'),
    secondaryButton: t('common.notNow'),
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.text}>{content.body}</Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.primaryButton} onPress={onRegister}>
              <Text style={styles.primaryButtonText}>
                {content.primaryButton}
              </Text>
            </TouchableOpacity>

            {onSignIn && (
              <TouchableOpacity style={styles.signInButton} onPress={onSignIn}>
                <Text style={styles.signInButtonText}>{t('auth.login')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>
                {content.secondaryButton}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 16,
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#F45C5C',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signInButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F45C5C',
  },
  signInButtonText: {
    color: '#F45C5C',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    padding: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#7F8C8D',
    fontSize: 14,
  },
});
