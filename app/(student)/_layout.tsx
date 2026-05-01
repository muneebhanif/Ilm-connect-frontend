import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LingoTheme } from '@/constants/theme';

export default function StudentLayout() {
  const insets = useSafeAreaInsets();
  
  // Adjust bottom padding based on safe area (iOS home indicator)
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom;
  const tabBarBaseHeight = Platform.OS === 'web' ? 65 : 62;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: LingoTheme.colors.primary,
        tabBarInactiveTintColor: '#AFAFAF', // Standard Lingo inactive icon grey
        tabBarShowLabel: false,
        tabBarIconStyle: {
          marginBottom: 0,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          // Removed margin and radius since it's no longer a pill shape
        },
        tabBarStyle: {
          backgroundColor: LingoTheme.colors.surface,
          // Lingo/Duolingo style: Full width, edge-to-edge, solid top border
          borderTopWidth: 2,
          borderTopColor: '#E5E5E5', 
          borderLeftWidth: 0,
          borderRightWidth: 0,
          borderBottomWidth: 0,
          height: tabBarBaseHeight + bottomInset,
          paddingTop: 10,
          paddingBottom: bottomInset > 0 ? bottomInset : 10,
          // Explicitly removing shadows for the flat, tactile look
          elevation: 0, 
          shadowOpacity: 0,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={28} // Slightly larger for that playful feel
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="classes"
        options={{
          title: 'Classes',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              size={28}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="recordings"
        options={{
          title: 'Recordings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'play-circle' : 'play-circle-outline'}
              size={28}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={28}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}