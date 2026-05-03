import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { SkeletonScreen } from '@/components/ui/skeleton';

import { ThemedText } from '@/components/themed-text';
import {
  LingoCard,
  LingoEmptyState,
} from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/config';

interface Notification {
  id: string;
  type:
    | 'class_reminder'
    | 'class_completed'
    | 'message'
    | 'booking_confirmed'
    | 'review_request'
    | 'system';
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
    () =>
      notifications.filter((notification) => notification.type === 'class_reminder')
        .length,
    [notifications]
  );

  const loadNotifications = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const accessToken = await AsyncStorage.getItem('access_token');
      if (!accessToken) return;

      const generatedNotifications: Notification[] = [];

      // Get upcoming classes
      const classesRes = await fetch(api.parentClasses(user.id), {
        headers: { Authorization: `Bearer ${accessToken}` },
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
              message: `${
                cls.students?.name || 'Your child'
              } has a class with ${
                cls.courses?.teachers?.profiles?.full_name || 'their teacher'
              } ${
                hoursUntil < 1
                  ? 'in less than an hour'
                  : `in ${Math.round(hoursUntil)} hours`
              }`,
              data: { classId: cls.id },
              read: false,
              created_at: new Date().toISOString(),
            });
          }

          // Class completed recently (within 24 hours)
          if (cls.status === 'completed') {
            const completedDate = new Date(cls.scheduled_date);
            const hoursSince =
              (now.getTime() - completedDate.getTime()) / (1000 * 60 * 60);
            if (hoursSince >= 0 && hoursSince <= 24) {
              generatedNotifications.push({
                id: `class-completed-${cls.id}`,
                type: 'class_completed',
                title: 'Class Completed',
                message: `${
                  cls.students?.name || 'Your child'
                } completed their class. Rate the session!`,
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
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const msgData = await msgRes.json();
        if (msgData.unreadCount > 0) {
          generatedNotifications.push({
            id: 'unread-messages',
            type: 'message',
            title: 'New Messages',
            message: `You have ${msgData.unreadCount} unread message${
              msgData.unreadCount > 1 ? 's' : ''
            }`,
            read: false,
            created_at: new Date().toISOString(),
          });
        }
      } catch (e) {
        // Ignore message errors
      }

      // Sort by date
      generatedNotifications.sort(
        (a, b) =>
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
        return {
          name: 'alarm-outline' as const,
          tone: 'gold' as const,
          chip: 'Reminder',
        };
      case 'class_completed':
        return {
          name: 'checkmark-circle-outline' as const,
          tone: 'primary' as const,
          chip: 'Completed',
        };
      case 'message':
        return {
          name: 'chatbubble-outline' as const,
          tone: 'teal' as const,
          chip: 'Message',
        };
      case 'booking_confirmed':
        return {
          name: 'calendar-outline' as const,
          tone: 'purple' as const,
          chip: 'Booking',
        };
      case 'review_request':
        return {
          name: 'star-outline' as const,
          tone: 'gold' as const,
          chip: 'Feedback',
        };
      default:
        return {
          name: 'notifications-outline' as const,
          tone: 'teal' as const,
          chip: 'Update',
        };
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
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <SkeletonScreen />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: topPadding,
              paddingBottom: bottomPadding + (Platform.OS === 'ios' ? 120 : 100),
            },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={LingoTheme.colors.primary}
            />
          }
        >
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
              <Ionicons name="chevron-back" size={26} color="#111827" />
            </TouchableOpacity>
            <ThemedText style={styles.topBarTitle}>Notifications</ThemedText>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <View style={[styles.statIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="notifications" size={22} color="#3B82F6" />
              </View>
              <ThemedText style={[styles.pillValue, { color: '#3B82F6' }]}>{notifications.length}</ThemedText>
              <ThemedText style={styles.pillLabel}>Alerts</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statChip}>
              <View style={[styles.statIconBox, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="mail-unread" size={22} color="#F97316" />
              </View>
              <ThemedText style={[styles.pillValue, { color: '#F97316' }]}>{unreadCount}</ThemedText>
              <ThemedText style={styles.pillLabel}>Unread</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statChip}>
              <View style={[styles.statIconBox, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="calendar" size={22} color="#22C55E" />
              </View>
              <ThemedText style={[styles.pillValue, { color: '#22C55E' }]}>{reminderCount}</ThemedText>
              <ThemedText style={styles.pillLabel}>Reminders</ThemedText>
            </View>
          </View>

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
                  activeOpacity={0.85} // Lingo tactile feel
                  onPress={() => handleNotificationPress(notification)}
                >
                  <LingoCard
                    style={[
                      styles.notificationCard,
                      !notification.read && styles.notificationCardUnread,
                    ]}
                  >
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
                        <Ionicons
                          name={meta.name}
                          size={22}
                          color={LingoTheme.colors.ink}
                        />
                      </View>

                      <View style={styles.notificationContent}>
                        <View style={styles.titleRow}>
                          <ThemedText style={styles.notificationTitle}>
                            {notification.title}
                          </ThemedText>
                          {!notification.read ? (
                            <View style={styles.unreadDot} />
                          ) : null}
                        </View>
                        <ThemedText style={styles.notificationMessage}>
                          {notification.message}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.footerRow}>
                      <View style={styles.metaBadge}>
                        <ThemedText style={styles.metaBadgeText}>
                          {meta.chip}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.timeText}>
                        {formatTime(notification.created_at)}
                      </ThemedText>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  backButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 2, borderColor: '#E5E5E5', borderBottomWidth: 4,
    justifyContent: 'center', alignItems: 'center',
  },
  topBarCenter: { flex: 1, alignItems: 'center' },
  topBarTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: '#111827' },
  topBarSub: { fontSize: 13, color: '#9CA3AF', fontWeight: '400', marginTop: 2 },
  topBarSpacer: { width: 44 },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 20,
  },
  metricPill: {
    flex: 1, alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, borderWidth: 2, borderColor: '#E5E5E5', borderBottomWidth: 4,
    paddingVertical: 12, paddingHorizontal: 8,
  },
  pillIcon: { fontSize: 20, marginBottom: 4 },
  pillValue: { fontSize: 18, fontWeight: '800', color: '#3C3C3C' },
  pillLabel: { fontSize: 11, fontWeight: '700', color: '#AFAFAF', textTransform: 'uppercase' },
  touchCard: {
    marginBottom: LingoTheme.spacing[3], // 12
  },
  notificationCard: {
    padding: LingoTheme.spacing[4], // 16
  },
  notificationCardUnread: {
    backgroundColor: LingoTheme.colors.softPrimary, // 'ECFCD8'
    borderColor: LingoTheme.colors.primaryLight, // 'ECFCD8' (same as softPrimary, but used as border)
  },
  notificationTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LingoTheme.spacing[3], // 12
  },
  iconBubble: {
    width: 52,
    height: 52,
    borderRadius: LingoTheme.radius.md, // 18
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  // Bubble background tints use soft* tokens; border colors are slightly darker
  // but kept as raw hex since no exact Lingo token exists for these accent borders.
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
    gap: LingoTheme.spacing[2], // 8
    marginBottom: LingoTheme.spacing[1] * 1.5, // 6 – slight deviation, acceptable
  },
  notificationTitle: {
    flex: 1,
    fontSize: LingoTheme.typography.sizes.base, // 16
    lineHeight: 21,
    fontWeight: LingoTheme.typography.weights.extrabold, // '800'
    color: LingoTheme.colors.ink,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: LingoTheme.colors.primary,
  },
  notificationMessage: {
    fontSize: LingoTheme.typography.sizes.sm, // 14
    lineHeight: 21,
    color: LingoTheme.colors.muted,
  },
  footerRow: {
    marginTop: LingoTheme.spacing[4], // 16
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: LingoTheme.spacing[3], // 12
  },
  metaBadge: {
    borderRadius: LingoTheme.radius.pill,
    paddingHorizontal: LingoTheme.spacing[3], // 12
    paddingVertical: LingoTheme.spacing[2], // 8
    backgroundColor: LingoTheme.colors.surface,
    borderWidth: 1.5,
    borderColor: LingoTheme.colors.border,
  },
  metaBadgeText: {
    fontSize: LingoTheme.typography.sizes.xs, // 12
    fontWeight: LingoTheme.typography.weights.extrabold,
    color: LingoTheme.colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: LingoTheme.typography.sizes.xs, // 12
    fontWeight: LingoTheme.typography.weights.bold, // '700'
    color: LingoTheme.colors.muted,
  },
});