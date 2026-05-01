import { StyleSheet, View, ScrollView, TouchableOpacity, Platform, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { LingoEmptyState } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RateTeacherModal } from '@/components/rate-teacher-modal';
import { SkeletonScreen } from '@/components/ui/skeleton';

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
  const { topPadding } = useSafePadding();
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

  useEffect(() => {
    const tickId = setInterval(() => {
      setRenderTick((t) => (t + 1) % 1_000_000);
    }, 30000);
    return () => clearInterval(tickId);
  }, []);

  useEffect(() => {
    loadClasses('initial');
  }, []);

  useFocusEffect(
    useCallback(() => {
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
            } catch { }
          }
          authFailedRef.current = true;
          await signOut();
          return;
        }
        throw new Error(data?.error || `Failed to load classes (${response.status})`);
      }

      const fetchedClasses = data.classes || [];
      setAllClasses(fetchedClasses);
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
    const status = String(classItem.status || '').toLowerCase();
    const isScheduled = status === 'upcoming' || status === 'confirmed';
    const isCompleted = status === 'completed';
    const isCancelled = status === 'cancelled';

    const statusLabel = isScheduled ? 'Scheduled' : (isCompleted ? 'Completed' : (isCancelled ? 'Cancelled' : status));

    return (
      <View key={classItem.id} style={[styles.tactileCard, isPast && styles.classCardPast]}>
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
              <Ionicons name="calendar" size={18} color={isPast ? '#AFAFAF' : '#58cc02'} />
              <ThemedText style={[styles.detailText, isPast && styles.textPast]}>
                {formatDate(classItem.scheduled_date)}
              </ThemedText>
           </View>
           <View style={styles.detailItem}>
              <Ionicons name="time" size={18} color={isPast ? '#AFAFAF' : '#58cc02'} />
              <ThemedText style={[styles.detailText, isPast && styles.textPast]}>
                {formatTime(classItem.scheduled_date)}
              </ThemedText>
           </View>
           <View style={styles.detailItem}>
              <Ionicons name="hourglass" size={18} color={isPast ? '#AFAFAF' : '#58cc02'} />
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
              <ThemedText style={[styles.joinButtonText, styles.joinButtonTextDisabled]}>
                Join via Student Account
              </ThemedText>
            </TouchableOpacity>
            <ThemedText style={{ color: '#FFC800', marginTop: 10, textAlign: 'center', fontSize: 13, fontWeight: '700' }}>
              Live class access requires a student account.
            </ThemedText>
          </>
        )}

        {isPast && isCompleted && (
          <TouchableOpacity 
            style={styles.rateButton}
            activeOpacity={0.8}
            onPress={() => handleRateTeacher(classItem)}
          >
            <Ionicons name="star" size={20} color="#3B82F6" />
            <ThemedText style={styles.rateButtonText}>Rate This Class</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return <SkeletonScreen />;
  }

  const displayClasses = activeTab === 'upcoming' ? upcomingClasses : pastClasses;
  const completedCount = pastClasses.filter(item => String(item.status || '').toLowerCase() === 'completed').length;

  return (
    <View style={styles.container}>
      {/* ── Top Bar ── */}
      <View style={[styles.header, { paddingTop: topPadding + 10 }]}>
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <View style={styles.topBarIconBg}>
              <Ionicons name="calendar" size={28} color="#58cc02" />
            </View>
            <View>
              <ThemedText style={styles.topBarTitle}>My Classes</ThemedText>
              <ThemedText style={styles.topBarSub}>Track lessons &amp; history</ThemedText>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.horizontalStatsRow}>
          <View style={styles.metricPill}>
            <Ionicons name="calendar" size={22} color="#58cc02" />
            <View style={styles.metricTextWrap}>
              <ThemedText style={styles.metricValue}>{upcomingClasses.length}</ThemedText>
              <ThemedText style={styles.metricLabel}>UPCOMING</ThemedText>
            </View>
          </View>
          <View style={styles.metricPill}>
            <Ionicons name="checkmark-circle" size={22} color="#3B82F6" />
            <View style={styles.metricTextWrap}>
              <ThemedText style={styles.metricValue}>{completedCount}</ThemedText>
              <ThemedText style={styles.metricLabel}>COMPLETED</ThemedText>
            </View>
          </View>
          <View style={styles.metricPill}>
            <Ionicons name="time" size={22} color="#AFAFAF" />
            <View style={styles.metricTextWrap}>
              <ThemedText style={styles.metricValue}>{allClasses.length}</ThemedText>
              <ThemedText style={styles.metricLabel}>TOTAL</ThemedText>
            </View>
          </View>
        </View>
      </View>

      {/* Tab Switcher - Tactile Lingo Style */}
      <View style={styles.tabContainerWrap}>
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'upcoming' && styles.tabActive]}
            onPress={() => setActiveTab('upcoming')}
            activeOpacity={1}
          >
            <ThemedText style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
              Upcoming
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'past' && styles.tabActive]}
            onPress={() => setActiveTab('past')}
            activeOpacity={1}
          >
            <ThemedText style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
              History
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadClasses('refresh')}
            tintColor={LingoTheme.colors.primary}
          />
        }
      >
        {displayClasses.length === 0 ? (
          <View style={[styles.tactileCard, styles.emptyCard]}>
            <LingoEmptyState
              icon={activeTab === 'upcoming' ? 'calendar-clear' : 'time'}
              title={activeTab === 'upcoming' ? 'No upcoming classes' : 'No class history yet'}
              subtitle={activeTab === 'upcoming' ? 'Booked lessons will appear here as soon as they are confirmed.' : 'Completed classes and ratings will show up here after lessons finish.'}
              tone={activeTab === 'upcoming' ? 'primary' : 'teal'}
            />
            {activeTab === 'upcoming' && (
              <TouchableOpacity 
                style={styles.bookBtn}
                onPress={() => router.push('/(parent)/browse-teachers')}
                activeOpacity={0.8}
              >
                <Ionicons name="search" size={20} color="#FFFFFF" />
                <ThemedText style={styles.bookBtnText}>Book a teacher</ThemedText>
              </TouchableOpacity>
            )}
          </View>
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
    backgroundColor: '#F7F7F7', // Lingo brand background
  },

  /* Header */
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topBarIconBg: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#ECFCD8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#BBF7D0',
  },
  topBarTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#3C3C3C',
  },
  topBarSub: {
    fontSize: 13,
    color: '#AFAFAF',
    fontWeight: '600',
    marginTop: 1,
  },
  horizontalStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  metricPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    gap: 6,
  },
  metricTextWrap: {},
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#3C3C3C',
    lineHeight: 18,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#AFAFAF',
    textTransform: 'uppercase',
  },

  /* Tab Switcher - Tactile Image Match */
  tabContainerWrap: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4, // 3D tactile border
    padding: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    paddingVertical: 14,
  },
  tabActive: {
    backgroundColor: '#1E293B', // Ink color
  },
  tabText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#777777',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },

  /* Scroll Content */
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 140 : 120, // Massive padding for bottom nav
    gap: 16,
  },

  /* Base Tactile Card */
  tactileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    padding: 20,
  },
  classCardPast: {
    backgroundColor: '#FAFAFA', // Slightly dimmer background for history
  },

  /* Card Inner Elements */
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
    flex: 1, // allows badge to naturally push right
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16, // Squircle look
    backgroundColor: '#58cc02',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  avatarPast: {
    backgroundColor: '#E5E5E5',
    borderColor: 'transparent',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  teacherName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#3C3C3C',
    marginBottom: 2,
  },
  subjectName: {
    fontSize: 14,
    color: '#777777',
    fontWeight: '600',
  },
  textPast: {
    color: '#AFAFAF',
  },

  /* Status Badges */
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusConfirmed: {
    backgroundColor: '#E5F6FF', // Soft blue
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  statusCompleted: {
    backgroundColor: '#F7F7F7',
  },
  statusPending: {
    backgroundColor: '#FFF8E5',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  textConfirmed: { color: '#3B82F6' },
  textCompleted: { color: '#AFAFAF' },
  textPending: { color: '#D4AF37' },

  divider: {
    height: 2,
    backgroundColor: '#E5E5E5',
    marginBottom: 16,
    borderRadius: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    backgroundColor: '#F7F7F7',
    padding: 12,
    borderRadius: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3C3C3C',
  },

  /* Join Button - Flat grey tactile look for disabled state */
  joinButton: {
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonDisabled: {
    backgroundColor: '#F3F4F6', // Lighter grey
  },
  joinButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#AFAFAF',
  },
  joinButtonTextDisabled: {
    color: '#AFAFAF',
  },

  /* Rate Button - Tactile Soft Blue */
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    backgroundColor: '#E5F6FF',
    gap: 8,
  },
  rateButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#3B82F6',
  },

  /* Empty State Specifics */
  emptyCard: {
    marginTop: 8,
    alignItems: 'center',
    padding: 32,
  },
  bookBtn: {
    flexDirection: 'row',
    backgroundColor: '#58cc02',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
});