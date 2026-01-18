import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';

export default function PreviewTabsLayout() {
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
        headerRight: () => (
          <View style={{ marginRight: 16, backgroundColor: '#FFE5B4', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#8B4513' }}>
              PREVIEW MODE
            </Text>
          </View>
        ),
        headerBackVisible: false,
        tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            feed: focused ? 'heart' : 'heart-outline',
            matches: focused ? 'people' : 'people-outline',
            profile: focused ? 'lock-closed' : 'lock-closed',
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
          title: 'Chats',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
    </Tabs>
  );
}
