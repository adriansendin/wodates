import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';

type Props = {
  visible: boolean;
  isMain: boolean;
  onClose: () => void;
  onSetMain: () => void;
  onDelete: () => void;
};

export function PhotoMenuModal({
  visible,
  isMain,
  onClose,
  onSetMain,
  onDelete,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Opciones de foto</Text>
          <Text style={styles.message}>¿Qué quieres hacer con esta foto?</Text>

          <View style={styles.options}>
            {!isMain && (
              <TouchableOpacity
                style={styles.option}
                onPress={() => {
                  onSetMain();
                  onClose();
                }}
              >
                <Text style={styles.optionText}>Establecer como principal</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.option, styles.deleteOption]}
              onPress={() => {
                onDelete();
                onClose();
              }}
            >
              <Text style={[styles.optionText, styles.deleteOptionText]}>
                Eliminar foto
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#222',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  options: {
    gap: 12,
    marginBottom: 12,
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  deleteOption: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e91e63',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  deleteOptionText: {
    color: '#e91e63',
  },
  cancelButton: {
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
});






