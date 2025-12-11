import { Stack } from 'expo-router';

export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#ffffff',
        },
        headerTintColor: '#000000',
        headerTitleStyle: {
          fontWeight: 'bold',
          color: '#000000',
        },
        headerShown: true,
        contentStyle: {
          backgroundColor: '#f8f9fa',
        },
      }}
    />
  );
}
