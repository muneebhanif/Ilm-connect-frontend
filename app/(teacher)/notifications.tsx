import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { LingoCard, LingoEmptyState, LingoScreenHeader, LingoStatPill } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/config';

type TeacherNotificationType = 'student_enrolled' | 'upcoming_class' | 'system';

interface TeacherNotification {
  id: string;
  type: TeacherNotificationType;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  data?: {
    studentId?: string;
    sessionId?: string;
    courseId?: string;
  };
}

export default function TeacherNotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { topPadding, bottomPadding } = useSafePadding();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<TeacherNotification[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [user?.id])
  );

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  const recentCount = useMemo(() => {
    const now = Date.now();
    return notifications.filter((notification) => {
      const createdAt = new Date(notification.created_at).getTime();
      return Number.isFinite(createdAt) && now - createdAt <= 24 * 60 * 60 * 1000;
    }).length;
  }, [notifications]);

  const loadNotifications = async () => {
    if (!user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(api.teacherNotifications(user.id));
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load notifications');
      }

      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
    } catch (error) {
      console.error('Error loading teacher notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const getNotificationMeta = (type: TeacherNotificationType) => {
    switch (type) {
      case 'student_enrolled':
        return { name: 'person-add-outline' as const, tone: 'primary' as const, chip: 'New student' };
      case 'upcoming_class':
        return { name: 'time-outline' as const, tone: 'purple' as const, chip: 'Class reminder' };
      default:
        return { name: 'notifications-outline' as const, tone: 'teal' as const, chip: 'System update' };
    }
  };

  const handleNotificationPress = (notification: TeacherNotification) => {
    if (notification.type === 'student_enrolled') {
      router.push('/(teacher)/students');
      return;
    }

    if (notification.type === 'upcoming_class') {
      router.push('/(teacher)/schedule');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    if (!Number.isFinite(date.getTime())) return 'Just now';

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
            badge="Teacher inbox"
            icon="notifications"
            title="Notifications that matter"
            subtitle="Stay ahead of new enrollments, reminders, and updates without digging through tabs."
            onBack={() => router.back()}
          >
            <View style={styles.statsRow}>
              <LingoStatPill icon="🔔" value={String(notifications.length)} label="Updates" tone="primary" />
              <LingoStatPill icon="✨" value={String(unreadCount)} label="Unread" tone="purple" />
              <LingoStatPill icon="🕒" value={String(recentCount)} label="Today" tone="teal" />
            </View>
          </LingoScreenHeader>

          {notifications.length === 0 ? (
            <LingoCard>
              <LingoEmptyState
                icon="notifications-off-outline"
                title="No teacher alerts yet"
                subtitle="New student enrollments and upcoming class reminders will appear here as soon as they happen."
                tone="teal"
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
                          meta.tone === 'purple' && styles.iconBubblePurple,
                          meta.tone === 'teal' && styles.iconBubbleTeal,
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
  iconBubblePurple: {
    backgroundColor: LingoTheme.colors.softPurple,
    borderColor: '#D7B7FF',
  },
  iconBubbleTeal: {
    backgroundColor: LingoTheme.colors.softTeal,
    borderColor: '#90E2D8',
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
