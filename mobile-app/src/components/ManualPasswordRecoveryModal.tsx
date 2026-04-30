import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';

/** Support inbox for manual account recovery (MVP — no automated reset). */
export const MANUAL_ACCOUNT_RECOVERY_EMAIL = 'wodates.app@gmail.com';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export const ManualPasswordRecoveryModal: React.FC<Props> = ({
  visible,
  onClose,
}) => {
  const { t } = useTranslation('common');
  const [showCopiedFeedback, setShowCopiedFeedback] = useState(false);
  const copyFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimer.current) {
        clearTimeout(copyFeedbackTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      setShowCopiedFeedback(false);
      if (copyFeedbackTimer.current) {
        clearTimeout(copyFeedbackTimer.current);
        copyFeedbackTimer.current = null;
      }
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, onClose]);

  const handleCopyEmail = async () => {
    try {
      await Clipboard.setStringAsync(MANUAL_ACCOUNT_RECOVERY_EMAIL);
      if (copyFeedbackTimer.current) {
        clearTimeout(copyFeedbackTimer.current);
      }
      setShowCopiedFeedback(true);
      copyFeedbackTimer.current = setTimeout(() => {
        setShowCopiedFeedback(false);
        copyFeedbackTimer.current = null;
      }, 2500);
    } catch {
      /* Clipboard failure is silent; user can still read the email. */
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('auth.manualRecoveryBackdropA11y')}
        />
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.headerSpacer} />
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t('auth.manualRecoveryCloseIconA11y')}
            >
              <Ionicons name="close" size={26} color="#6B6B6B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Text accessibilityRole="header" style={styles.title}>
              {t('auth.forgotPasswordQuestion')}
            </Text>

            <Text style={styles.body}>{t('auth.manualRecoveryIntro')}</Text>

            <Text style={styles.body}>
              <Text>{t('auth.manualRecoveryBeforeEmail')}</Text>
              <Text style={styles.emailText}>
                {MANUAL_ACCOUNT_RECOVERY_EMAIL}
              </Text>
              <Text>{t('auth.manualRecoveryAfterEmail')}</Text>
            </Text>

            <Text style={styles.body}>
              <Text style={styles.bodyStrong}>
                {t('auth.manualRecoveryResponseLabel')}
              </Text>
              <Text> </Text>
              <Text>{t('auth.manualRecoveryResponseHours')}</Text>
            </Text>

            <Text style={styles.body}>
              <Text style={styles.bodyStrong}>
                {t('auth.manualRecoveryNoteLabel')}
              </Text>
              <Text> </Text>
              <Text>{t('auth.manualRecoveryNoteBody')}</Text>
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('auth.manualRecoveryUnderstood')}
            >
              <Text style={styles.primaryButtonText}>
                {t('auth.manualRecoveryUnderstood')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryTap}
              onPress={handleCopyEmail}
              accessibilityRole="button"
              accessibilityLabel={t('auth.manualRecoveryCopyEmail')}
            >
              <Text style={styles.secondaryTapText}>
                {t('auth.manualRecoveryCopyEmail')}
              </Text>
            </TouchableOpacity>

            {showCopiedFeedback ? (
              <Text style={styles.copiedHint} accessibilityLiveRegion="polite">
                {t('auth.manualRecoveryEmailCopied')}
              </Text>
            ) : null}
          </ScrollView>
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    paddingBottom: 8,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 8,
    paddingTop: 8,
    minHeight: 44,
  },
  headerSpacer: {
    flex: 1,
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C3E50',
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 26,
  },
  body: {
    fontSize: 15,
    color: '#6B6B6B',
    lineHeight: 22,
    textAlign: 'left',
  },
  bodyStrong: {
    fontWeight: '700',
    color: '#333333',
  },
  emailText: {
    fontWeight: '700',
    color: '#F45C5C',
    fontSize: 15,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#F45C5C',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryTap: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryTapText: {
    color: '#333333',
    fontSize: 15,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  copiedHint: {
    fontSize: 13,
    color: '#4CAF50',
    textAlign: 'center',
    marginTop: -4,
  },
});
