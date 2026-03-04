import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

interface PlatformInfoProps {
  message?: string;
  style?: StyleProp<ViewStyle>;
}

export const PlatformInfo: React.FC<PlatformInfoProps> = ({
  message,
  style,
}) => {
  const { t } = useTranslation('common');
  const displayMessage = message ?? t('common.photoFromComputer');
  if (Platform.OS !== 'web') {
    return null; // No mostrar nada en móvil
  }

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.icon}>💡</Text>
      <Text style={styles.text}>{displayMessage}</Text>
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
