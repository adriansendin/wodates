import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import AppNavigator from './src/app/navigation/AppNavigator';

export default function App() {
  // Debug info for web
  if (Platform.OS === 'web') {
    console.log('🚀 WODATES App starting on web platform');
    console.log('📱 API URL:', process.env.EXPO_PUBLIC_API_URL);
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
