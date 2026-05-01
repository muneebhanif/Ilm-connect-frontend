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
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom;
  const tabBarBaseHeight = Platform.OS === 'web' ? 60 : 56;

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

  // Fetch on mount and set up polling
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Also fetch when any tab gains focus
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
        tabBarInactiveTintColor: LingoTheme.colors.textTertiary,
        tabBarShowLabel: false,
        tabBarIconStyle: {
          marginBottom: 0,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          marginHorizontal: 4,
          marginVertical: 4,
          borderRadius: LingoTheme.radius.lg,
        },
        tabBarStyle: {
          backgroundColor: LingoTheme.colors.surface,
          borderTopWidth: 0,
          height: tabBarBaseHeight + Math.max(bottomInset, 16),
          paddingTop: 10,
          paddingBottom: Math.max(bottomInset, 16),
          marginHorizontal: 12,
          marginBottom: Platform.OS === 'web' ? 0 : 10,
          borderRadius: LingoTheme.radius.xl,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          ...LingoTheme.shadow.card,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        tabBarActiveBackgroundColor: LingoTheme.colors.softPrimary,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: '',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="browse-teachers"
        options={{
          title: '',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="classes"
        options={{
          title: '',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="messages"
        options={{
          title: '',
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons
                name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
                size={24}
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
          title: '',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={24}
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
    right: -8,
    top: -4,
    backgroundColor: LingoTheme.colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: LingoTheme.colors.surface,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});