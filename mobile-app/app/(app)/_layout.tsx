import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/domain/stores/authStore';
import { usePreviewStore } from '../../src/domain/stores/previewStore';
import { View, Text } from 'react-native';

export default function AppTabsLayout() {
  const { user } = useAuthStore();
  const { isPreviewMode } = usePreviewStore();

  if (isPreviewMode) {
    return <Redirect href="/(preview)/feed" />;
  }

  if (!user) {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      screenOptions={({ route }: { route: { name: string } }) => ({
        tabBarActiveTintColor: '#e91e63',
        tabBarInactiveTintColor: 'gray',
        headerShown: true,
        headerStyle: {
          backgroundColor: '#ffffff',
        },
        headerTintColor: '#000000',
        headerTitleStyle: {
          fontWeight: 'bold',
          color: '#000000',
        },
        headerTitle: '',
        headerLeft: () => (
          <View style={{ marginLeft: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#e91e63' }}>
              Wodates
            </Text>
          </View>
        ),
        headerRight: undefined,
        headerBackVisible: false,
        tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            feed: focused ? 'heart' : 'heart-outline',
            matches: focused ? 'people' : 'people-outline',
            profile: focused ? 'person' : 'person-outline',
          };

          return <Ionicons name={icons[route.name] ?? 'ellipse'} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Descubrir',
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Chat',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
        }}
      />
    </Tabs>
  );
}
