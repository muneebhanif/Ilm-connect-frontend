import { StyleSheet, View, ScrollView, TouchableOpacity, Platform, Alert, RefreshControl } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { LinearGradient } from 'expo-linear-gradient';
import { LingoBadge, LingoButton, LingoCard, LingoEmptyState } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';
import { DateTime } from 'luxon'; 
import { SkeletonScreen } from '@/components/ui/skeleton';

interface ClassSession {
  id: string;
  session_date: string; // timestamp with time zone
  duration_minutes: number;
  status: 'upcoming' | 'completed' | 'cancelled';
  live_status: 'scheduled' | 'live' | 'ended';
  delivery_mode?: 'live' | 'prerecorded';
  fulfilled_with_recording_id?: string | null;
  courses?: {
    title?: string;
  };
  // Fix: API shape safety - explicit null/undefined handling for various API shapes
  subject?: string;
  students?: { name: string } | { name: string }[] | null;
  student_name?: string; 
}

export default function ScheduleScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { topPadding, bottomPadding } = useSafePadding();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayClasses, setTodayClasses] = useState<ClassSession[]>([]);
  const [upcomingClasses, setUpcomingClasses] = useState<ClassSession[]>([]);
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming'>('today');

  const [teacherTz, setTeacherTz] = useState<string>(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [serverNowIso, setServerNowIso] = useState<string | null>(null);

  // Load teacher timezone from backend profile so schedule times are correct.
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const res = await fetch(api.teacherProfile(user.id));
        if (!res.ok) return;
        const data = await res.json();
        const t = data.profile || data.teacher || data;
        const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const backendTz = (t?.timezone && typeof t.timezone === 'string' && t.timezone.length > 0) ? t.timezone : '';
        const tz = backendTz || deviceTz;
        setTeacherTz(tz);

        // If teacher timezone is missing in DB, persist it so future bookings use correct TZ.
        if (!backendTz && deviceTz && deviceTz !== 'UTC') {
          fetch(api.teacherById(user.id), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timezone: deviceTz }),
          }).catch(() => {
            // ignore
          });
        }
      } catch {
        // ignore
      }
    })();
  }, [user?.id]);

  // Auth timing: load after auth initializes and timezone is known.
  useEffect(() => {
    if (user?.id) {
      loadSchedule();
    }
  }, [user?.id, teacherTz]);

  const loadSchedule = async (mode: 'initial' | 'refresh' = 'initial') => {
    try {
      if (!user?.id) return;

      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);

      const response = await fetch(api.teacherSchedule(user.id));
      
      // Fix: Silent failure risk. 
      // Explicitly check response status and throw to trigger catch block if failed.
      if (!response.ok) {
        throw new Error(`Failed to fetch schedule: ${response.status}`);
      }

      const data = await response.json();
      const allSessions: ClassSession[] = data.sessions || [];

      const serverNow = typeof data.server_now === 'string' ? data.server_now : '';
      if (serverNow) setServerNowIso(serverNow);
      const now = serverNow
        ? DateTime.fromISO(serverNow, { zone: 'utc' }).setZone(teacherTz)
        : DateTime.now().setZone(teacherTz);
      const startOfToday = now.startOf('day');
      const startOfTomorrow = startOfToday.plus({ days: 1 });

      // Debug logging
      console.log('Schedule Debug:', {
        serverNow,
        now: now.toISO(),
        startOfToday: startOfToday.toISO(),
        startOfTomorrow: startOfTomorrow.toISO(),
        teacherTz,
        totalSessions: allSessions.length,
        sessionDates: allSessions.map(s => ({
          id: s.id,
          session_date: s.session_date,
          parsed: DateTime.fromISO(s.session_date, { zone: 'utc' }).setZone(teacherTz).toISO()
        }))
      });

      // Fix: Timezone consistency bug. 
      // Used DateTime objects for sorting to ensure exact alignment with the filter logic.
      
      // Filter today's classes: must be today AND not already ended (with 30 min buffer)
      const today = allSessions.filter((s) => {
        const sessionStart = DateTime.fromISO(s.session_date, { zone: 'utc' }).setZone(teacherTz);
        const duration = typeof s.duration_minutes === 'number' && s.duration_minutes > 0 ? s.duration_minutes : 60;
        const sessionEnd = sessionStart.plus({ minutes: duration });
        // Keep class visible for 30 minutes after it ends
        const hideAfter = sessionEnd.plus({ minutes: 30 });
        
        // Class is "today" if it starts today
        const isToday = sessionStart >= startOfToday && sessionStart < startOfTomorrow;
        // Hide if we're past the buffer time (regardless of live_status - it's stale data)
        const shouldHide = now > hideAfter;
        const isCompleted = s.status === 'completed' || s.live_status === 'ended';
        
        return isToday && !shouldHide && !isCompleted;
      }).sort((a, b) => 
        DateTime.fromISO(a.session_date).toMillis() - DateTime.fromISO(b.session_date).toMillis()
      );

      const upcoming = allSessions.filter((s) => {
        const d = DateTime.fromISO(s.session_date, { zone: 'utc' }).setZone(teacherTz);
        return d >= startOfTomorrow && s.status !== 'cancelled' && s.status !== 'completed';
      }).sort((a, b) => 
        DateTime.fromISO(a.session_date).toMillis() - DateTime.fromISO(b.session_date).toMillis()
      );

      setTodayClasses(today);
      setUpcomingClasses(upcoming);
    } catch (error) {
      // Fix: Silent failure risk. Provide feedback on error.
      console.error('Error loading schedule:', error);
      Alert.alert('Error', 'Unable to load schedule. Please pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    loadSchedule('refresh');
  };

  const formatTime = (dateStr: string) => {
    // Fix: Static time bug. Returns formatted time specific to the passed date string.
    return DateTime.fromISO(dateStr, { zone: 'utc' }).setZone(teacherTz).toFormat('h:mm a');
  };

  const formatDate = (dateStr: string) => {
    return DateTime.fromISO(dateStr, { zone: 'utc' }).setZone(teacherTz).toFormat('ccc, LLL dd');
  };

  const getStudentName = (session: ClassSession) => {
    // Fix: API shape safety. 
    // Robustly checks array, object, or null to prevent crashes or "[object Object]".
    if (!session.students) {
      return session.student_name || 'Student';
    }
    if (Array.isArray(session.students)) {
      if (session.students.length === 0) return 'Student';
      return session.students.map(s => s?.name || 'Student').join(', ');
    }
    return (session.students as { name: string })?.name || 'Student';
  };

  const getClassSubject = (session: ClassSession) => {
    // Fix: "undefined" subject bug. 
    // Uses optional chaining and fallback to ensure a valid string is always returned.
    const raw = (session.courses as any)?.title ?? session.subject ?? '';
    const title = typeof raw === 'string' ? raw.trim() : '';
    if (!title) return 'Private Tutoring';
    if (title.toLowerCase().includes('undefined')) return 'Private Tutoring';
    return title;
  };

  const isClassJoinable = (classItem: ClassSession) => {
    // Teachers must be able to start scheduled sessions even if timezone data is missing
    // or the stored UTC timestamp doesn't match the teacher's local expectation.
    if (classItem.status === 'cancelled' || classItem.status === 'completed') return false;
    if (classItem.live_status === 'ended') return false;
    return true;
  };

  const getJoinWindowDebug = (classItem: ClassSession) => {
    const nowUtc = DateTime.utc();
    const startUtc = DateTime.fromISO(classItem.session_date, { zone: 'utc' });
    const duration = typeof classItem.duration_minutes === 'number' && classItem.duration_minutes > 0
      ? classItem.duration_minutes
      : 60;
    const endUtc = startUtc.plus({ minutes: duration });
    const earliestUtc = startUtc.minus({ minutes: 10 });
    const minutesUntilStart = Math.round(startUtc.diff(nowUtc, 'minutes').minutes);
    return {
      nowUtc: nowUtc.toISO(),
      startUtc: startUtc.toISO(),
      earliestUtc: earliestUtc.toISO(),
      endUtc: endUtc.toISO(),
      minutesUntilStart,
    };
  };

  const renderClassCard = (classItem: ClassSession) => {
    const isJoinable = isClassJoinable(classItem);
    const isCompleted = classItem.status === 'completed' || classItem.live_status === 'ended';
    const isCancelled = classItem.status === 'cancelled';
    const isPrerecorded = classItem.delivery_mode === 'prerecorded';

    return (
      <View key={classItem.id} style={styles.timelineRow}>
        <View style={styles.timeColumn}>
          <ThemedText style={[styles.timeText, (isCompleted || isCancelled) && styles.textInactive]}>
            {formatTime(classItem.session_date)}
          </ThemedText>
          <ThemedText style={styles.dateTextSmall}>{formatDate(classItem.session_date)}</ThemedText>
          <View style={[styles.timelineLine, (isCompleted || isCancelled) && styles.lineInactive]} />
        </View>

        <LingoCard style={[styles.classCard, (isCompleted || isCancelled) && styles.cardInactive]}>
          <View style={[styles.statusStrip, 
             isCancelled ? { backgroundColor: '#EF4444' } :
             isCompleted ? { backgroundColor: '#9CA3AF' } :
             isJoinable ? { backgroundColor: '#10B981' } : 
             { backgroundColor: '#F59E0B' }
          ]} />
          
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <ThemedText style={[styles.subjectText, (isCompleted || isCancelled) && styles.textInactive]}>
                {getClassSubject(classItem)}
              </ThemedText>
              
              <View style={[styles.statusBadge, 
                isCancelled ? styles.badgeCancelled :
                isCompleted ? styles.badgeCompleted :
                isJoinable ? styles.badgeLive : 
                styles.badgeScheduled
              ]}>
                <ThemedText style={[styles.statusText, 
                   isCancelled ? styles.textCancelled :
                   isCompleted ? styles.textCompleted :
                   isJoinable ? styles.textLive : 
                   styles.textScheduled
                ]}>
                  {isCancelled ? 'Cancelled' : 
                   isCompleted ? 'Completed' : 
                   isJoinable ? 'Live Now' : 'Scheduled'}
                </ThemedText>
              </View>
            </View>

            {isPrerecorded ? (
              <View style={styles.deliveryBadge}>
                <Ionicons name="videocam-outline" size={12} color="#0F766E" />
                <ThemedText style={styles.deliveryBadgeText}>Prerecorded delivery</ThemedText>
              </View>
            ) : null}

            <View style={styles.studentRow}>
               <View style={[styles.avatarPlaceholder, (isCompleted || isCancelled) && styles.avatarInactive]}>
                  <Ionicons name="person" size={12} color={(isCompleted || isCancelled) ? "#9CA3AF" : "#6B7280"} />
               </View>
               <ThemedText style={[styles.studentName, (isCompleted || isCancelled) && styles.textInactive]}>
                 {getStudentName(classItem)}
               </ThemedText>
            </View>

            {!isCancelled && !isCompleted && (
              <View style={styles.cardFooter}>
                 <View style={styles.durationBadge}>
                    <Ionicons name="time-outline" size={14} color="#6B7280" />
                    <ThemedText style={styles.durationText}>{classItem.duration_minutes || 60} min</ThemedText>
                 </View>

                 <View style={styles.actionRow}>
                   <TouchableOpacity
                     style={styles.secondaryActionButton}
                     onPress={() => {
                       router.push({
                         pathname: '/upload-recording' as any,
                         params: {
                           sessionId: classItem.id,
                           sessionTitle: getClassSubject(classItem),
                         },
                       });
                     }}
                   >
                     <Ionicons name="cloud-upload-outline" size={14} color="#0F766E" />
                     <ThemedText style={styles.secondaryActionText}>
                       {classItem.fulfilled_with_recording_id ? 'Replace' : 'Upload'}
                     </ThemedText>
                   </TouchableOpacity>

                   <TouchableOpacity 
                     style={[styles.actionButton, !isJoinable && styles.actionButtonDisabled]}
                     onPress={() => {
                       if (isJoinable) {
                          router.push({
                            pathname: '/class-room/[id]',
                            params: { id: classItem.id }
                          });
                       } else {
                            const dbg = getJoinWindowDebug(classItem);
                            console.log('[Schedule join window]', { sessionId: classItem.id, ...dbg });
                            Alert.alert(
                              'Not available yet',
                              `You can start 10 minutes before the class starts and until it ends.\n\nStarts in ~${dbg.minutesUntilStart} min.`
                            );
                       }
                     }}
                     disabled={!isJoinable}
                   >
                     <LinearGradient
                        colors={isJoinable ? ['#FF6B6B', '#EE5A24'] : ['#F3F4F6', '#F3F4F6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.actionGradient}
                     >
                        <ThemedText style={[styles.actionText, !isJoinable && styles.actionTextDisabled]}>
                           {isPrerecorded ? 'Live Instead' : isJoinable ? 'Start Class' : 'Wait'}
                        </ThemedText>
                        {isJoinable && <Ionicons name="videocam" size={14} color="#FFF" />}
                     </LinearGradient>
                   </TouchableOpacity>
                 </View>
              </View>
            )}
          </View>
        </LingoCard>
      </View>
    );
  };

  const displayClasses = activeTab === 'today' ? todayClasses : upcomingClasses;

  if (loading) {
    return <SkeletonScreen />;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPadding }]}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.iconCircle}>
            <Ionicons name="calendar-outline" size={22} color="#F59E0B" />
          </View>
          <View style={styles.topBarCenter}>
            <ThemedText style={styles.topBarTitle}>My Schedule</ThemedText>
            <ThemedText style={styles.topBarSub}>{(serverNowIso ? DateTime.fromISO(serverNowIso, { zone: 'utc' }).setZone(teacherTz) : DateTime.now().setZone(teacherTz)).toFormat('ccc, LLL dd')} · {teacherTz.replace(/_/g, ' ')}</ThemedText>
          </View>
          <View style={{ width: 44 }} />
        </View>
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.metricPill}>
            <ThemedText style={styles.pillIcon}>📅</ThemedText>
            <ThemedText style={styles.pillValue}>{todayClasses.length}</ThemedText>
            <ThemedText style={styles.pillLabel}>Today</ThemedText>
          </View>
          <View style={styles.metricPill}>
            <ThemedText style={styles.pillIcon}>⏭️</ThemedText>
            <ThemedText style={styles.pillValue}>{upcomingClasses.length}</ThemedText>
            <ThemedText style={styles.pillLabel}>Upcoming</ThemedText>
          </View>
        </View>

        <LingoCard style={styles.tabsShell}>
          <View style={styles.tabsContainer}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'today' && styles.activeTab]}
              onPress={() => setActiveTab('today')}
            >
              <ThemedText style={[styles.tabText, activeTab === 'today' && styles.activeTabText]}>
                Today
              </ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
              onPress={() => setActiveTab('upcoming')}
            >
              <ThemedText style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
                Upcoming
              </ThemedText>
            </TouchableOpacity>
          </View>
        </LingoCard>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + (Platform.OS === 'ios' ? 120 : 100) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LingoTheme.colors.primary} />}
      >
        {displayClasses.length === 0 ? (
          <LingoCard style={styles.emptyCard}>
            <LingoEmptyState
              icon="calendar-clear-outline"
              title={activeTab === 'today' ? 'No classes today' : 'No upcoming classes'}
              subtitle={activeTab === 'today' ? 'All clear for the day. New sessions will appear here when they are booked.' : 'Future lessons will appear here automatically once parents confirm them.'}
              tone={activeTab === 'today' ? 'teal' : 'primary'}
            />
          </LingoCard>
        ) : (
          displayClasses.map(renderClassCard)
        )}
      </ScrollView>
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
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFF7D6',
    borderWidth: 2, borderColor: '#F59E0B', borderBottomWidth: 4,
    justifyContent: 'center', alignItems: 'center',
  },
  topBarCenter: { flex: 1, alignItems: 'center' },
  topBarTitle: { fontSize: 20, fontWeight: '800', color: '#3C3C3C' },
  topBarSub: { fontSize: 12, color: '#AFAFAF', fontWeight: '600', marginTop: 2, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginBottom: 12 },
  metricPill: {
    flex: 1, alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, borderWidth: 2, borderColor: '#E5E5E5', borderBottomWidth: 4,
    paddingVertical: 12, paddingHorizontal: 4,
  },
  pillIcon: { fontSize: 18, marginBottom: 2 },
  pillValue: { fontSize: 18, fontWeight: '800', color: '#3C3C3C' },
  pillLabel: { fontSize: 11, fontWeight: '700', color: '#AFAFAF', textTransform: 'uppercase' },
  tabsShell: {
    padding: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: LingoTheme.colors.surfaceAlt,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
  },
  activeTab: {
    backgroundColor: LingoTheme.colors.primary,
    borderColor: LingoTheme.colors.primaryDark,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '800',
    color: LingoTheme.colors.muted,
  },
  activeTabText: {
    color: '#FFFFFF',
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 18,
  },

  timelineRow: {
    flexDirection: 'row',
  },
  timeColumn: {
    width: 60,
    alignItems: 'center',
    paddingTop: 4,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
    color: LingoTheme.colors.muted,
    marginBottom: 4,
  },
  dateTextSmall: {
    fontSize: 10,
    color: '#9CA3AF',
    marginBottom: 8,
    textAlign: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: LingoTheme.colors.border,
    borderRadius: 1,
  },
  lineInactive: {
    backgroundColor: LingoTheme.colors.surfaceAlt,
  },

  classCard: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    padding: 0,
  },
  cardInactive: {
    opacity: 0.82,
  },
  statusStrip: {
    width: 6,
    height: '100%',
  },
  cardContent: {
    flex: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  subjectText: {
    fontSize: 16,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    flex: 1,
    marginRight: 8,
  },
  textInactive: {
    color: '#9CA3AF',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeLive: { backgroundColor: '#ECFDF5' },
  badgeScheduled: { backgroundColor: '#FFFBEB' },
  badgeCompleted: { backgroundColor: '#F3F4F6' },
  badgeCancelled: { backgroundColor: '#FEF2F2' },
  
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  textLive: { color: '#059669' },
  textScheduled: { color: '#D97706' },
  textCompleted: { color: '#6B7280' },
  textCancelled: { color: '#DC2626' },
  
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: LingoTheme.colors.softTeal,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarInactive: {
    backgroundColor: '#E5E7EB',
  },
  studentName: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '600',
  },
  deliveryBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LingoTheme.colors.softTeal,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
  },
  deliveryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },

  /* Footer Actions */
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: LingoTheme.colors.border,
    paddingTop: 12,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LingoTheme.colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  durationText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: LingoTheme.colors.softTeal,
    borderWidth: 2,
    borderColor: '#99F6E4',
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F766E',
  },
  actionButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionButtonDisabled: {
    // handled in opacity
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  actionTextDisabled: {
    color: '#9CA3AF',
  },

  emptyCard: {
    marginTop: 12,
  },
});