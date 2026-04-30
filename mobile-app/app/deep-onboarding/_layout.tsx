import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { useDeepOnboardingStore } from '../../src/domain/stores/deepOnboardingStore';

export default function DeepOnboardingLayout() {
  const bootstrap = useDeepOnboardingStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: '#F45C5C',
        headerTitleStyle: { fontWeight: '600', fontSize: 16, color: '#1a1a1a' },
        headerShadowVisible: false,
      }}
    />
  );
}
