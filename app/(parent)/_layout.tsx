import { Tabs } from 'expo-router';
import { Platform, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/config';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LingoTheme } from '@/constants/theme';

export default function ParentLayout() {
  const [unreadCount, setUnreadCount] = useState(0);
  const insets = useSafeAreaInsets();
  
  // Adjust bottom padding based on safe area (iOS home indicator)
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom;
  const tabBarBaseHeight = Platform.OS === 'web' ? 65 : 62;

  const fetchUnreadCount = async () => {
    try {
      const response = await authFetch(api.messages.unreadCount());
      const data = await response.json();
      if (data.unreadCount !== undefined) {
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); 
    return () => clearInterval(interval);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
    }, [])
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: LingoTheme.colors.primary,
        tabBarInactiveTintColor: LingoTheme.colors.textTertiary || '#afafaf',
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: -2,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          // Removed margin and radius since we aren't using a background pill anymore
        },
        tabBarStyle: {
          backgroundColor: LingoTheme.colors.surface,
          // Lingo/Duolingo style: Full width, no rounded corners, solid top border
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
        name="browse-teachers"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              size={28}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="classes"
        options={{
          title: 'Schedule',
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
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons
                name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
                size={28}
                color={color}
              />
              {unreadCount > 0 && (
                <View style={layoutStyles.badge}>
                  <Text style={layoutStyles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
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

      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="browse-courses" options={{ href: null }} />
    </Tabs>
  );
}

const layoutStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -6,
    top: -4,
    backgroundColor: LingoTheme.colors.danger,
    borderRadius: 12, // More rounded, pill-like
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: LingoTheme.colors.surface, // Keeps the cutout effect against the icon
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800', // Pushed to 800 for Lingo brand typography weight
  },
});