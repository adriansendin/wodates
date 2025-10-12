import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

interface PlatformInfoProps {
  message?: string;
  style?: any;
}

/**
 * Componente que muestra información específica de plataforma
 * Útil para indicar cuando ciertas funcionalidades no están disponibles en web
 */
export const PlatformInfo: React.FC<PlatformInfoProps> = ({ 
  message = "Puedes seleccionar una foto desde tu computadora",
  style 
}) => {
  if (Platform.OS !== 'web') {
    return null; // No mostrar nada en móvil
  }

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.icon}>💡</Text>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b3d9ff',
    marginVertical: 8,
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: '#0066cc',
    fontWeight: '500',
  },
});
