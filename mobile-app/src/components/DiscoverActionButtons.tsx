import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { X, MessageCircle } from 'lucide-react-native';

interface DiscoverActionButtonsProps {
  disabled: boolean;
  onReject: () => void;
  onAccept: () => void;
  resetKey?: string;
}

const DiscoverActionButtons: React.FC<DiscoverActionButtonsProps> = ({
  disabled,
  onReject,
  onAccept,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.rejectButton]}
          onPress={onReject}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="No es para mí"
          accessibilityHint="Descarta este perfil sugerido"
        >
          <X size={24} color="#ef4444" />
        </TouchableOpacity>

        <View style={styles.spacer} />

        <TouchableOpacity
          style={[styles.button, styles.acceptButton]}
          onPress={onAccept}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Quiero conocerle"
          accessibilityHint="Muestra interés en esta persona"
        >
          <MessageCircle size={24} color="#10b981" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    borderColor: '#ef4444',
  },
  acceptButton: {
    borderColor: '#10b981',
  },
  spacer: {
    width: 16,
  },
});

export default DiscoverActionButtons;