import { Stack } from 'expo-router';

export default function RegisterLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: '#FAFAFA',
        },
        animation: 'slide_from_right',
      }}
    />
  );
}

