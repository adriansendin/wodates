import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';

type Props = {
  onPress: () => void;
  disabled?: boolean;
  size?: number;
};

export function PhotoAddButton({ onPress, disabled = false, size }: Props) {
  const containerStyle = size
    ? [
        styles.container,
        { width: size, height: size },
        disabled && styles.disabled,
      ]
    : [styles.container, disabled && styles.disabled];

  const handlePress = () => {
    console.log('[PhotoAddButton] Button pressed, disabled:', disabled);
    if (!disabled && onPress) {
      onPress();
    } else {
      console.log(
        '[PhotoAddButton] Button is disabled or onPress is not defined'
      );
    }
  };

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Plus size={size ? size * 0.2 : 32} color="#e91e63" strokeWidth={2} />
        {!size && <Text style={styles.text}>Añadir foto</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    aspectRatio: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
});
