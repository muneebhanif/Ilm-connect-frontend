import { StyleSheet, View, ScrollView, TouchableOpacity, Platform, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { LinearGradient } from 'expo-linear-gradient';
import { LingoBadge, LingoButton, LingoCard, LingoEmptyState, LingoScreenHeader, LingoStatPill } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RateTeacherModal } from '@/components/rate-teacher-modal';

interface ClassSession {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  status: string;
  live_status?: string;
  teacher_name?: string;
  subject?: string;
  students: { name: string };
  courses: {
    title: string;
    teacher_id: string;
    teachers: {
      profiles: { full_name: string };
    };
  };
}

export default function ClassesScreen() {
  const router = useRouter();
  const { user, signOut, refreshSession } = useAuth();
  const { topPadding, bottomPadding } = useSafePadding();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allClasses, setAllClasses] = useState<ClassSession[]>([]);
  const [upcomingClasses, setUpcomingClasses] = useState<ClassSession[]>([]);
  const [pastClasses, setPastClasses] = useState<ClassSession[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const authFailedRef = useRef(false);
  const [serverNowBaseMs, setServerNowBaseMs] = useState<number | null>(null);
  const [serverPerfBaseMs, setServerPerfBaseMs] = useState<number | null>(null);
  const [renderTick, setRenderTick] = useState(0);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedClassForRating, setSelectedClassForRating] = useState<{
    sessionId: string;
    teacherId: string;
    teacherName: string;
  } | null>(null);

  // Keep time-based UI (Upcoming/History) dynamic even on web where focus events
  // can be unreliable depending on navigation/container.
  useEffect(() => {
    const tickId = setInterval(() => {
      // Trigger re-render; actual "now" is computed from server_now + monotonic elapsed.
      setRenderTick((t) => (t + 1) % 1_000_000);
    }, 30000);
    return () => clearInterval(tickId);
  }, []);

  useEffect(() => {
    // Initial load (mount)
    loadClasses('initial');
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Reload on focus and keep it fresh while the user stays on this screen
      if (authFailedRef.current) return;
      loadClasses('background');
      const intervalId = setInterval(() => {
        if (!authFailedRef.current) loadClasses('background');
      }, 20000);

      return () => {
        clearInterval(intervalId);
      };
    }, [user?.id])
  );

  useEffect(() => {
    const graceMs = 30 * 60 * 1000;
    const perfNow = (globalThis as any)?.performance?.now?.();
    const hasServerClock = typeof serverNowBaseMs === 'number' && typeof serverPerfBaseMs === 'number' && typeof perfNow === 'number';
    const nowMs = hasServerClock
      ? (serverNowBaseMs as number) + (perfNow as number) - (serverPerfBaseMs as number)
      : Date.now();

    const upcoming = allClasses
      .filter((c) => {
        const status = String(c.status || '').toLowerCase();
        const liveStatus = String(c.live_status || '').toLowerCase();
        if (liveStatus === 'live') return true;
        if (status === 'completed' || status === 'cancelled') return false;
        const startMs = new Date(c.scheduled_date).getTime();
        if (!Number.isFinite(startMs)) return false;
        return nowMs <= startMs + graceMs;
      })
      .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

    const past = allClasses
      .filter((c) => {
        const status = String(c.status || '').toLowerCase();
        const liveStatus = String(c.live_status || '').toLowerCase();
        if (liveStatus === 'live') return false;
        if (status === 'completed' || status === 'cancelled') return true;
        const startMs = new Date(c.scheduled_date).getTime();
        if (!Number.isFinite(startMs)) return true;
        return nowMs > startMs + graceMs;
      })
      .sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime());

    setUpcomingClasses(upcoming);
    setPastClasses(past);
  }, [allClasses, serverNowBaseMs, serverPerfBaseMs, renderTick]);

  const loadClasses = async (
    mode: 'initial' | 'refresh' | 'background' = 'background',
    allowRefresh: boolean = true
  ) => {
    try {
      if (authFailedRef.current) return;
      if (!user?.id) return;

      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);

      const accessToken = await AsyncStorage.getItem('access_token');
      if (!accessToken) {
        authFailedRef.current = true;
        await signOut();
        return;
      }

      const response = await fetch(api.parentClasses(user.id), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          if (allowRefresh) {
            try {
              await refreshSession();
              return loadClasses(mode, false);
            } catch {
              // fall through
            }
          }
          authFailedRef.current = true;
          await signOut();
          return;
        }
        throw new Error(data?.error || `Failed to load classes (${response.status})`);
      }

      const allClasses = data.classes || [];
      setAllClasses(allClasses);
      const serverNowIso = typeof data.server_now === 'string' ? data.server_now : '';
      const parsed = serverNowIso ? new Date(serverNowIso).getTime() : NaN;
      if (Number.isFinite(parsed)) {
        const perfNow = (globalThis as any)?.performance?.now?.();
        setServerNowBaseMs(parsed);
        setServerPerfBaseMs(typeof perfNow === 'number' ? perfNow : null);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      if (mode === 'initial') setLoading(false);
      if (mode === 'refresh') setRefreshing(false);
    }
  };

  const getUserTimezone = () => {
    const offsetMinutes = new Date().getTimezoneOffset();
    const offsetHours = -offsetMinutes / 60;
    const tzMap: Record<number, string> = {
      5: 'Asia/Karachi',
      5.5: 'Asia/Kolkata',
      0: 'UTC',
      1: 'Europe/London',
      '-5': 'America/New_York',
      '-8': 'America/Los_Angeles',
    };
    return tzMap[offsetHours] || Intl.DateTimeFormat().resolvedOptions().timeZone;
  };

  const formatDate = (dateStr: string) => {
    const utcDate = new Date(dateStr);
    return utcDate.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const utcDate = new Date(dateStr);
    return utcDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true,
    });
  };

  const isClassJoinable = (classItem: ClassSession) => {
    const liveStatus = String(classItem.live_status || '').toLowerCase();
    if (liveStatus === 'live') return true;

    const status = String(classItem.status || '').toLowerCase();
    if (status === 'completed' || status === 'cancelled' || liveStatus === 'ended') {
      return false;
    }

    const now = Date.now();
    const classStart = new Date(classItem.scheduled_date).getTime();
    const duration = classItem.duration_minutes || 60;
    const classEnd = classStart + duration * 60 * 1000;
    const earliestJoin = classStart - 10 * 60 * 1000;
    const latestJoin = classEnd + 30 * 60 * 1000;

    return now >= earliestJoin && now <= latestJoin;
  };

  const handleRateTeacher = (classItem: ClassSession) => {
    setSelectedClassForRating({
      sessionId: classItem.id,
      teacherId: classItem.courses?.teacher_id || '',
      teacherName: classItem.courses?.teachers?.profiles?.full_name || 'Teacher',
    });
    setRatingModalVisible(true);
  };

  const handleRatingSuccess = () => {
    loadClasses('background');
  };

  const renderClassCard = (classItem: ClassSession, isPast: boolean = false) => {
    const joinable = !isPast && isClassJoinable(classItem);
    const now = new Date();
    const classDateTime = new Date(classItem.scheduled_date);
    const diffMinutes = Math.floor((classDateTime.getTime() - now.getTime()) / (1000 * 60));
    let joinWarning = '';
    const status = String(classItem.status || '').toLowerCase();
    const isScheduled = status === 'upcoming' || status === 'confirmed';
    const isCompleted = status === 'completed';
    const isCancelled = status === 'cancelled';

    if (!isPast && !joinable && isScheduled) {
      if (diffMinutes > 0) {
        joinWarning = `Scheduled. You can join once the teacher starts.`;
      } else if (diffMinutes < -60) {
        joinWarning = `Class has ended.`;
      } else {
        joinWarning = `Waiting for teacher to start.`;
      }
    } else if (!isPast && !isScheduled) {
      joinWarning = `Class is not scheduled yet.`;
    }

    const statusLabel = isScheduled ? 'scheduled' : (isCompleted ? 'completed' : (isCancelled ? 'cancelled' : status));

    return (
      <LingoCard key={classItem.id} style={[styles.classCard, isPast && styles.classCardPast]}>
        <View style={styles.cardHeader}>
          <View style={styles.teacherInfo}>
             <View style={[styles.avatar, isPast && styles.avatarPast]}>
                <ThemedText style={styles.avatarText}>
                  {classItem.courses?.teachers?.profiles?.full_name?.charAt(0) || 'T'}
                </ThemedText>
             </View>
             <View>
                <ThemedText style={[styles.teacherName, isPast && styles.textPast]}>
                  {classItem.courses?.teachers?.profiles?.full_name || 'Teacher'}
                </ThemedText>
                <ThemedText style={[styles.subjectName, isPast && styles.textPast]}>
                  {classItem.courses?.title || 'Private Tutoring'}
                </ThemedText>
             </View>
          </View>
          <View style={[
            styles.statusBadge, 
            isScheduled ? styles.statusConfirmed :
            isCompleted ? styles.statusCompleted :
            styles.statusPending
          ]}>
            <ThemedText style={[
               styles.statusText,
               isScheduled ? styles.textConfirmed :
               isCompleted ? styles.textCompleted :
               styles.textPending
            ]}>
              {statusLabel}
            </ThemedText>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailsRow}>
           <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={16} color={isPast ? LingoTheme.colors.textTertiary : LingoTheme.colors.teal} />
              <ThemedText style={[styles.detailText, isPast && styles.textPast]}>
                {formatDate(classItem.scheduled_date)}
              </ThemedText>
           </View>
           <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={16} color={isPast ? LingoTheme.colors.textTertiary : LingoTheme.colors.teal} />
              <ThemedText style={[styles.detailText, isPast && styles.textPast]}>
                {formatTime(classItem.scheduled_date)}
              </ThemedText>
           </View>
           <View style={styles.detailItem}>
              <Ionicons name="hourglass-outline" size={16} color={isPast ? LingoTheme.colors.textTertiary : LingoTheme.colors.teal} />
              <ThemedText style={[styles.detailText, isPast && styles.textPast]}>
                {classItem.duration_minutes} min
              </ThemedText>
           </View>
        </View>

        {!isPast && (
          <>
            <TouchableOpacity 
              style={[styles.joinButton, !joinable && styles.joinButtonDisabled]}
              disabled
              activeOpacity={0.8}
              onPress={() => Alert.alert('Student account required', 'Only teachers and students can join live classes.')}
            >
              <LinearGradient
                colors={['#E5E7EB', '#E5E7EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.joinButtonGradient}
              >
                <ThemedText style={[styles.joinButtonText, styles.joinButtonTextDisabled]}>
                  Join via Student Account
                </ThemedText>
              </LinearGradient>
            </TouchableOpacity>
            <ThemedText style={{ color: LingoTheme.colors.warning, marginTop: 6, textAlign: 'center', fontSize: 13 }}>
              Live class access is available for teacher and student accounts only.
            </ThemedText>
          </>
        )}

        {isPast && isCompleted && (
          <TouchableOpacity 
            style={styles.rateButton}
            activeOpacity={0.8}
            onPress={() => handleRateTeacher(classItem)}
          >
            <Ionicons name="star-outline" size={18} color={LingoTheme.colors.teal} />
            <ThemedText style={styles.rateButtonText}>Rate This Class</ThemedText>
          </TouchableOpacity>
        )}
      </LingoCard>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={LingoTheme.colors.primary} />
      </View>
    );
  }

  const displayClasses = activeTab === 'upcoming' ? upcomingClasses : pastClasses;
  const completedCount = pastClasses.filter(item => String(item.status || '').toLowerCase() === 'completed').length;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPadding }]}> 
        <LingoScreenHeader
          title="My classes"
          subtitle="Keep track of booked lessons, class history, and rating follow-ups from one place."
          badge="Parent dashboard"
          icon="school-outline"
        >
          <View style={styles.headerStatsRow}>
            <LingoStatPill icon="📅" value={String(upcomingClasses.length)} label="Upcoming" tone="primary" />
            <LingoStatPill icon="✅" value={String(completedCount)} label="Completed" tone="teal" />
          </View>
          <View style={styles.headerBadgeRow}>
            <LingoBadge label={`${allClasses.length} total classes`} icon="albums-outline" tone="gold" />
            <LingoBadge label={activeTab === 'upcoming' ? 'Upcoming focus' : 'History focus'} icon="sparkles" tone="purple" />
          </View>
        </LingoScreenHeader>
      </View>

      {/* Tab Switcher - Lingo Style */}
      <View style={styles.tabContainerWrap}>
        <LingoCard style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'upcoming' && styles.tabActive]}
            onPress={() => setActiveTab('upcoming')}
            activeOpacity={0.8}
          >
            <ThemedText style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
              Upcoming
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'past' && styles.tabActive]}
            onPress={() => setActiveTab('past')}
            activeOpacity={0.8}
          >
            <ThemedText style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
              History
            </ThemedText>
          </TouchableOpacity>
        </LingoCard>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadClasses('refresh')}
            tintColor={LingoTheme.colors.primary}
          />
        }
      >
        {displayClasses.length === 0 ? (
          <LingoCard style={styles.emptyCard}>
            <LingoEmptyState
              icon={activeTab === 'upcoming' ? 'calendar-clear-outline' : 'time-outline'}
              title={activeTab === 'upcoming' ? 'No upcoming classes' : 'No class history yet'}
              subtitle={activeTab === 'upcoming' ? 'Booked lessons will appear here as soon as they are confirmed.' : 'Completed classes and ratings will show up here after lessons finish.'}
              tone={activeTab === 'upcoming' ? 'primary' : 'teal'}
            />
            {activeTab === 'upcoming' && (
              <LingoButton 
                label="Book a teacher"
                icon="search-outline"
                onPress={() => router.push('/(parent)/browse-teachers')}
                style={styles.bookBtn}
              />
            )}
          </LingoCard>
        ) : (
          displayClasses.map(item => renderClassCard(item, activeTab === 'past'))
        )}
      </ScrollView>

      {/* Rating Modal */}
      {selectedClassForRating && (
        <RateTeacherModal
          visible={ratingModalVisible}
          onClose={() => {
            setRatingModalVisible(false);
            setSelectedClassForRating(null);
          }}
          onSuccess={handleRatingSuccess}
          teacherId={selectedClassForRating.teacherId}
          teacherName={selectedClassForRating.teacherName}
          sessionId={selectedClassForRating.sessionId}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LingoTheme.colors.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Header */
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerStatsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },

  /* Tab Switcher - Lingo Style */
  tabContainerWrap: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 4,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: LingoTheme.radius.md,
    backgroundColor: LingoTheme.colors.surfaceAlt,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
  },
  tabActive: {
    backgroundColor: LingoTheme.colors.primary,
    borderColor: LingoTheme.colors.primaryDark,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '800',
    color: LingoTheme.colors.muted,
  },
  tabTextActive: {
    color: LingoTheme.colors.textInverse,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 16,
  },

  /* Class Card - Lingo Style */
  classCard: {
    padding: 20,
  },
  classCardPast: {
    opacity: 0.85,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  teacherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: LingoTheme.radius.pill,
    backgroundColor: LingoTheme.colors.teal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPast: {
    backgroundColor: LingoTheme.colors.textTertiary,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: LingoTheme.colors.textInverse,
  },
  teacherName: {
    fontSize: 16,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
  },
  subjectName: {
    fontSize: 13,
    color: LingoTheme.colors.muted,
  },
  textPast: {
    color: LingoTheme.colors.textTertiary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: LingoTheme.radius.pill,
  },
  statusConfirmed: {
    backgroundColor: LingoTheme.colors.softPrimary,
  },
  statusCompleted: {
    backgroundColor: LingoTheme.colors.borderLight,
  },
  statusPending: {
    backgroundColor: LingoTheme.colors.softGold,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  textConfirmed: { color: LingoTheme.colors.primary },
  textCompleted: { color: LingoTheme.colors.textSecondary },
  textPending: { color: LingoTheme.colors.gold },

  divider: {
    height: 1,
    backgroundColor: LingoTheme.colors.border,
    marginBottom: 16,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    fontWeight: '600',
    color: LingoTheme.colors.text,
  },

  /* Join Button - Lingo Style */
  joinButton: {
    borderRadius: LingoTheme.radius.md,
    overflow: 'hidden',
  },
  joinButtonDisabled: {
    opacity: 0.8,
  },
  joinButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  joinButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: LingoTheme.colors.textInverse,
  },
  joinButtonTextDisabled: {
    color: LingoTheme.colors.textTertiary,
  },

  /* Rate Button - Lingo Style */
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: LingoTheme.radius.md,
    borderWidth: 2,
    borderColor: LingoTheme.colors.teal,
    backgroundColor: LingoTheme.colors.softTeal,
    gap: 8,
  },
  rateButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: LingoTheme.colors.teal,
  },

  emptyCard: {
    marginTop: 8,
  },
  bookBtn: {
    marginTop: 24,
  },
});