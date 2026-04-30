import '../src/i18n/init';

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import i18n from '../src/i18n/i18n';
import { normalizeLanguage } from '../src/i18n/normalizeLanguage';
import { useAuthStore } from '../src/domain/stores/authStore';
import { ToastContainer } from '../src/components/Toast';

// In forced-language mode we keep the code that syncs from browser language,
// but prevent it from changing away from Spanish.
const FORCE_APP_LANGUAGE: 'es' | null = 'es';

function HeaderTitle() {
  const { t } = useTranslation('common');
  return (
    <View style={{ marginLeft: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#e91e63' }}>
        {t('app.title')}
      </Text>
    </View>
  );
}
import { registerServiceWorker } from '../src/utils/pwa';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';

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

// Sync i18n with browser language after mount (web only; init can run before navigator is ready)
function BrowserLanguageSync() {
  useEffect(() => {
    if (FORCE_APP_LANGUAGE) return;
    if (typeof navigator === 'undefined') return;
    const browserLang = navigator.languages?.[0] ?? navigator.language ?? '';
    const normalized = normalizeLanguage(browserLang);
    if (normalized !== i18n.language) {
      i18n.changeLanguage(normalized);
    }
  }, []);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts(Ionicons.font);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthInitializer />
      <PWAInitializer />
      <BrowserLanguageSync />
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
          headerShown:
            !route.name?.includes('chat') &&
            !route.name?.includes('(auth)') &&
            !route.name?.includes('(app)') &&
            !route.name?.includes('(preview)') &&
            !route.name?.includes('deep-onboarding'),
          headerLeft: () => <HeaderTitle />,
          headerBackVisible: false,
          contentStyle: {
            backgroundColor: '#f8f9fa',
          },
        })}
      />
      <ToastContainer />
    </SafeAreaProvider>
  );
}
