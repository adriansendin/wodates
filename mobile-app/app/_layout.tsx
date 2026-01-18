import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View, Platform } from 'react-native';
import { useAuthStore } from '../src/domain/stores/authStore';
import { useEffect } from 'react';
import { registerServiceWorker } from '../src/utils/pwa';

// Component to initialize auth state
function AuthInitializer() {
  const { restoreAuth } = useAuthStore();

  useEffect(() => {
    console.log('[AuthInitializer] Initializing auth state...');
    restoreAuth();
  }, [restoreAuth]);

  return null; // This component doesn't render anything
}

// Component to initialize PWA (web only)
function PWAInitializer() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      registerServiceWorker();
    }
  }, []);

  return null;
}

export default function RootLayout() {

  return (
    <SafeAreaProvider>
      <AuthInitializer />
      <PWAInitializer />
      <StatusBar style="auto" />
      <Stack
        screenOptions={({ route }: { route: { name?: string | null } }) => ({
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#000000',
          headerTitleStyle: {
            fontWeight: 'bold',
            color: '#000000',
          },
          headerTitle: '',
          headerShown: !route.name?.includes('chat') && !route.name?.includes('(auth)') && !route.name?.includes('(app)') && !route.name?.includes('(preview)'),
          headerLeft: () => (
            <View style={{ marginLeft: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#e91e63' }}>
                Wodates
              </Text>
            </View>
          ),
          headerBackVisible: false,
          contentStyle: {
            backgroundColor: '#f8f9fa',
          },
        })}
      />
    </SafeAreaProvider>
  );
}
