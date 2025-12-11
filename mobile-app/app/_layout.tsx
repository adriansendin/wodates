import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';

export default function RootLayout() {

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={({ route }) => ({
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#000000',
          headerTitleStyle: {
            fontWeight: 'bold',
            color: '#000000',
          },
          headerTitle: '',
          headerShown: !route.name?.includes('chat') && !route.name?.includes('(auth)') && !route.name?.includes('(app)'),
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
