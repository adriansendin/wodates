import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ApiClient } from '../../../src/data/api/apiClient';
import { DeepOnboardingApi } from '../../../src/data/api/deepOnboardingApi';
import { useAuthStore } from '../../../src/domain/stores/authStore';
import { useDeepOnboardingStore } from '../../../src/domain/stores/deepOnboardingStore';
import { getApiUrl } from '../../../src/utils/apiConfig';

async function syncQuestionnaireFromServer(): Promise<void> {
  const token = useAuthStore.getState().tokens?.accessToken;
  if (!token) {
    return;
  }

  const {
    bootstrap,
    hydrateFromServerAnswers,
    syncClientSessionIdFromServer,
  } = useDeepOnboardingStore.getState();

  await bootstrap();

  const api = new DeepOnboardingApi(new ApiClient(getApiUrl()));
  const result = await api.getMySession(token);
  if (!result.success || !result.data) {
    return;
  }

  await syncClientSessionIdFromServer(result.data.clientSessionId);
  hydrateFromServerAnswers(result.data.answers);
}

export default function QuestionnaireStackLayout() {
  const syncedForTokenRef = useRef<string | null>(null);
  const token = useAuthStore((s) => s.tokens?.accessToken ?? null);
  const { t } = useTranslation('common');

  useEffect(() => {
    if (!token) {
      syncedForTokenRef.current = null;
      return;
    }
    if (syncedForTokenRef.current === token) {
      return;
    }
    syncedForTokenRef.current = token;
    void syncQuestionnaireFromServer();
  }, [token]);

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#ffffff',
        },
        headerTintColor: '#000000',
        headerTitleStyle: {
          fontWeight: 'bold',
          color: '#000000',
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t('tabs.questionnaire'),
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="[block]"
        options={{
          title: '',
          headerShown: true,
          headerTitle: '',
          headerLargeTitle: false,
        }}
      />
    </Stack>
  );
}
