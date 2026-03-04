import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';

interface AffinityModalProps {
  visible: boolean;
  affinitySentences: string[];
  onClose: () => void;
}

export const AffinityModal: React.FC<AffinityModalProps> = ({
  visible,
  affinitySentences,
  onClose,
}) => {
  const { t } = useTranslation('common');
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContainer}>
              <View style={styles.header}>
                <Text style={styles.title}>{t('feed.affinity')}</Text>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('accessibility.close')}
                >
                  <X size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
              >
                {affinitySentences.length > 0 ? (
                  <>
                    {affinitySentences.map((sentence, index) => (
                      <Text key={index} style={styles.affinityText}>
                        {sentence}
                      </Text>
                    ))}
                    <Text style={styles.basedOnLabel}>
                      {t('feed.basedOnConversations')}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.emptyText}>
                    {t('feed.noAffinityAvailable')}
                  </Text>
                )}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
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
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e91e63',
  },
  closeButton: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  affinityText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginBottom: 12,
  },
  basedOnLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
