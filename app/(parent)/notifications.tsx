import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/themed-text';
import { LingoCard, LingoEmptyState, LingoScreenHeader, LingoStatPill } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/config';

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
  const { topPadding, bottomPadding } = useSafePadding();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [user?.id])
  );

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  const reminderCount = useMemo(
    () => notifications.filter((notification) => notification.type === 'class_reminder').length,
    [notifications]
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

  const getNotificationMeta = (type: Notification['type']) => {
    switch (type) {
      case 'class_reminder':
        return { name: 'alarm-outline' as const, tone: 'gold' as const, chip: 'Reminder' };
      case 'class_completed':
        return { name: 'checkmark-circle-outline' as const, tone: 'primary' as const, chip: 'Completed' };
      case 'message':
        return { name: 'chatbubble-outline' as const, tone: 'teal' as const, chip: 'Message' };
      case 'booking_confirmed':
        return { name: 'calendar-outline' as const, tone: 'purple' as const, chip: 'Booking' };
      case 'review_request':
        return { name: 'star-outline' as const, tone: 'gold' as const, chip: 'Feedback' };
      default:
        return { name: 'notifications-outline' as const, tone: 'teal' as const, chip: 'Update' };
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

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={LingoTheme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingTop: topPadding, paddingBottom: bottomPadding + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LingoTheme.colors.primary} />}
        >
          <LingoScreenHeader
            badge="Parent hub"
            icon="notifications"
            title="Family updates in one place"
            subtitle="Keep class reminders, teacher messages, and completed-session nudges easy to scan."
            onBack={() => router.back()}
          >
            <View style={styles.statsRow}>
              <LingoStatPill icon="🔔" value={String(notifications.length)} label="Alerts" tone="primary" />
              <LingoStatPill icon="💬" value={String(unreadCount)} label="Unread" tone="teal" />
              <LingoStatPill icon="📅" value={String(reminderCount)} label="Reminders" tone="gold" />
            </View>
          </LingoScreenHeader>

          {notifications.length === 0 ? (
            <LingoCard>
              <LingoEmptyState
                icon="notifications-off-outline"
                title="You’re all caught up"
                subtitle="Important class reminders and teacher messages will show up here as soon as they arrive."
                tone="primary"
              />
            </LingoCard>
          ) : (
            notifications.map((notification) => {
              const meta = getNotificationMeta(notification.type);

              return (
                <TouchableOpacity
                  key={notification.id}
                  style={styles.touchCard}
                  activeOpacity={0.88}
                  onPress={() => handleNotificationPress(notification)}
                >
                  <LingoCard style={[styles.notificationCard, !notification.read && styles.notificationCardUnread]}>
                    <View style={styles.notificationTopRow}>
                      <View
                        style={[
                          styles.iconBubble,
                          meta.tone === 'primary' && styles.iconBubblePrimary,
                          meta.tone === 'teal' && styles.iconBubbleTeal,
                          meta.tone === 'gold' && styles.iconBubbleGold,
                          meta.tone === 'purple' && styles.iconBubblePurple,
                        ]}
                      >
                        <Ionicons name={meta.name} size={22} color={LingoTheme.colors.ink} />
                      </View>

                      <View style={styles.notificationContent}>
                        <View style={styles.titleRow}>
                          <ThemedText style={styles.notificationTitle}>{notification.title}</ThemedText>
                          {!notification.read ? <View style={styles.unreadDot} /> : null}
                        </View>
                        <ThemedText style={styles.notificationMessage}>{notification.message}</ThemedText>
                      </View>
                    </View>

                    <View style={styles.footerRow}>
                      <View style={styles.metaBadge}>
                        <ThemedText style={styles.metaBadgeText}>{meta.chip}</ThemedText>
                      </View>
                      <ThemedText style={styles.timeText}>{formatTime(notification.created_at)}</ThemedText>
                    </View>
                  </LingoCard>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LingoTheme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LingoTheme.colors.background,
  },
  content: {
    paddingHorizontal: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  touchCard: {
    marginBottom: 14,
  },
  notificationCard: {
    padding: 18,
  },
  notificationCardUnread: {
    backgroundColor: '#FCFFFC',
    borderColor: '#CFEAA9',
  },
  notificationTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  iconBubble: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  iconBubblePrimary: {
    backgroundColor: LingoTheme.colors.softPrimary,
    borderColor: '#B7E889',
  },
  iconBubbleTeal: {
    backgroundColor: LingoTheme.colors.softTeal,
    borderColor: '#90E2D8',
  },
  iconBubbleGold: {
    backgroundColor: LingoTheme.colors.softGold,
    borderColor: '#F4D778',
  },
  iconBubblePurple: {
    backgroundColor: LingoTheme.colors.softPurple,
    borderColor: '#D7B7FF',
  },
  notificationContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: LingoTheme.colors.primary,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: LingoTheme.colors.muted,
  },
  footerRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: LingoTheme.colors.border,
  },
  metaBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
    color: LingoTheme.colors.muted,
  },
});
