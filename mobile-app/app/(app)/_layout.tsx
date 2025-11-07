import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/domain/stores/authStore';
import { useMatchesStore } from '../../src/domain/stores/matchesStore';
import { View, Text } from 'react-native';

function MatchesHeaderRight() {
  const activeChatsCount = useMatchesStore((state) => state.activeChatsCount);
  
  return (
    <View style={{ marginRight: 16 }}>
      <Text style={{ fontSize: 14, color: '#666' }}>
        {activeChatsCount}/3 chats
      </Text>
    </View>
  );
}

export default function AppTabsLayout() {
  const { user } = useAuthStore();

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={({ route }) => ({
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
        headerRight: route.name === 'matches' ? () => <MatchesHeaderRight /> : undefined,
        headerBackVisible: false,
        tabBarIcon: ({ focused, color, size }) => {
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
          title: 'Discover',
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matches',
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
