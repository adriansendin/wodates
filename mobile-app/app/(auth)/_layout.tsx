import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '../../src/domain/stores/authStore';

export default function AuthLayout() {
  const { user } = useAuthStore();

  if (user) {
    return <Redirect href="/(app)/feed" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: '#f8f9fa',
        },
      }}
    />
  );
}
