import { StyleSheet, View, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/lib/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Fonts } from '@/constants/theme';

interface Notification {
  id: string;
  type: 'class_reminder' | 'class_completed' | 'message' | 'booking_confirmed' | 'review_request' | 'system';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  created_at: string;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [user?.id])
  );

  const loadNotifications = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const accessToken = await AsyncStorage.getItem('access_token');
      if (!accessToken) return;

      // For now, generate notifications from existing data
      // In a real app, you'd have a notifications table
      const generatedNotifications: Notification[] = [];

      // Get upcoming classes
      const classesRes = await fetch(api.parentClasses(user.id), {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const classesData = await classesRes.json();
      
      if (classesData.classes) {
        const now = new Date();
        classesData.classes.forEach((cls: any) => {
          const classDate = new Date(cls.scheduled_date);
          const timeDiff = classDate.getTime() - now.getTime();
          const hoursUntil = timeDiff / (1000 * 60 * 60);

          // Class in next 24 hours
          if (hoursUntil > 0 && hoursUntil <= 24 && cls.status !== 'cancelled') {
            generatedNotifications.push({
              id: `class-reminder-${cls.id}`,
              type: 'class_reminder',
              title: 'Upcoming Class Reminder',
              message: `${cls.students?.name || 'Your child'} has a class with ${cls.courses?.teachers?.profiles?.full_name || 'their teacher'} ${hoursUntil < 1 ? 'in less than an hour' : `in ${Math.round(hoursUntil)} hours`}`,
              data: { classId: cls.id },
              read: false,
              created_at: new Date().toISOString(),
            });
          }

          // Class completed recently (within 24 hours)
          if (cls.status === 'completed') {
            const completedDate = new Date(cls.scheduled_date);
            const hoursSince = (now.getTime() - completedDate.getTime()) / (1000 * 60 * 60);
            if (hoursSince >= 0 && hoursSince <= 24) {
              generatedNotifications.push({
                id: `class-completed-${cls.id}`,
                type: 'class_completed',
                title: 'Class Completed',
                message: `${cls.students?.name || 'Your child'} completed their class. Rate the session!`,
                data: { classId: cls.id, teacherId: cls.courses?.teachers?.id },
                read: false,
                created_at: completedDate.toISOString(),
              });
            }
          }
        });
      }

      // Get recent messages (unread count)
      try {
        const msgRes = await fetch(api.messages.unreadCount(), {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const msgData = await msgRes.json();
        if (msgData.unreadCount > 0) {
          generatedNotifications.push({
            id: 'unread-messages',
            type: 'message',
            title: 'New Messages',
            message: `You have ${msgData.unreadCount} unread message${msgData.unreadCount > 1 ? 's' : ''}`,
            read: false,
            created_at: new Date().toISOString(),
          });
        }
      } catch (e) {
        // Ignore message errors
      }

      // Sort by date
      generatedNotifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(generatedNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'class_reminder':
        return { name: 'alarm-outline', color: '#4ECDC4', bg: '#E0F2F1' };
      case 'class_completed':
        return { name: 'checkmark-circle-outline', color: '#10B981', bg: '#D1FAE5' };
      case 'message':
        return { name: 'chatbubble-outline', color: '#3B82F6', bg: '#DBEAFE' };
      case 'booking_confirmed':
        return { name: 'calendar-outline', color: '#8B5CF6', bg: '#EDE9FE' };
      case 'review_request':
        return { name: 'star-outline', color: '#F59E0B', bg: '#FEF3C7' };
      default:
        return { name: 'notifications-outline', color: '#6B7280', bg: '#F3F4F6' };
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    switch (notification.type) {
      case 'class_reminder':
      case 'class_completed':
        // Could navigate to class details
        break;
      case 'message':
        router.push('/(parent)/messages');
        break;
      default:
        break;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Notifications</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color="#D1D5DB" />
            <ThemedText style={styles.emptyTitle}>No Notifications</ThemedText>
            <ThemedText style={styles.emptyText}>
              You're all caught up! We'll notify you when something important happens.
            </ThemedText>
          </View>
        ) : (
          <>
            {notifications.map((notification) => {
              const iconData = getNotificationIcon(notification.type);
              return (
                <TouchableOpacity 
                  key={notification.id}
                  style={[styles.notificationCard, !notification.read && styles.unreadCard]}
                  onPress={() => handleNotificationPress(notification)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconContainer, { backgroundColor: iconData.bg }]}>
                    <Ionicons name={iconData.name as any} size={24} color={iconData.color} />
                  </View>
                  <View style={styles.contentContainer}>
                    <View style={styles.titleRow}>
                      <ThemedText style={styles.notificationTitle}>
                        {notification.title}
                      </ThemedText>
                      <ThemedText style={styles.timeText}>
                        {formatTime(notification.created_at)}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.notificationMessage} numberOfLines={2}>
                      {notification.message}
                    </ThemedText>
                  </View>
                  {!notification.read && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              );
            })}
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.rounded,
    fontWeight: '700',
    color: '#1F2937',
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  unreadCard: {
    backgroundColor: '#F0FDFA',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  contentContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ECDC4',
    marginLeft: 8,
    marginTop: 4,
  },
});
