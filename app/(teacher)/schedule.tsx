import { StyleSheet, View, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { LinearGradient } from 'expo-linear-gradient';
import { Fonts } from '@/constants/theme';
import { DateTime } from 'luxon'; 
import { SkeletonScreen } from '@/components/ui/skeleton';

interface ClassSession {
  id: string;
  session_date: string; // timestamp with time zone
  duration_minutes: number;
  status: 'upcoming' | 'completed' | 'cancelled';
  live_status: 'scheduled' | 'live' | 'ended';
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
  const [loading, setLoading] = useState(true);
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

  const loadSchedule = async () => {
    try {
      if (!user?.id) return;

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
    }
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

    return (
      <View key={classItem.id} style={styles.timelineRow}>
        <View style={styles.timeColumn}>
          <ThemedText style={[styles.timeText, (isCompleted || isCancelled) && styles.textInactive]}>
            {formatTime(classItem.session_date)}
          </ThemedText>
          <ThemedText style={styles.dateTextSmall}>{formatDate(classItem.session_date)}</ThemedText>
          <View style={[styles.timelineLine, (isCompleted || isCancelled) && styles.lineInactive]} />
        </View>

        <TouchableOpacity 
          style={[styles.classCard, (isCompleted || isCancelled) && styles.cardInactive]}
          activeOpacity={0.9}
          disabled={isCompleted || isCancelled}
        >
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
                         {isJoinable ? 'Start Class' : 'Wait'}
                      </ThemedText>
                      {isJoinable && <Ionicons name="videocam" size={14} color="#FFF" />}
                   </LinearGradient>
                 </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const displayClasses = activeTab === 'today' ? todayClasses : upcomingClasses;

  if (loading) {
    return <SkeletonScreen />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
           <ThemedText style={styles.headerTitle}>My Schedule</ThemedText>
           <View style={styles.dateBadge}>
              <Ionicons name="calendar" size={14} color="#FF6B6B" />
              <ThemedText style={styles.dateText}>
                  {(serverNowIso
                   ? DateTime.fromISO(serverNowIso, { zone: 'utc' }).setZone(teacherTz)
                   : DateTime.now().setZone(teacherTz)
                  ).toFormat('ccc, LLL dd')}
              </ThemedText>
           </View>
        </View>

        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'today' && styles.activeTab]}
            onPress={() => setActiveTab('today')}
          >
            <ThemedText style={[styles.tabText, activeTab === 'today' && styles.activeTabText]}>
              Today
            </ThemedText>
            {activeTab === 'today' && <View style={styles.activeDot} />}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
            onPress={() => setActiveTab('upcoming')}
          >
            <ThemedText style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
              Upcoming
            </ThemedText>
            {activeTab === 'upcoming' && <View style={styles.activeDot} />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {displayClasses.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBg}>
               <Ionicons name="calendar-clear-outline" size={40} color="#9CA3AF" />
            </View>
            <ThemedText style={styles.emptyTitle}>
              {activeTab === 'today' ? 'No classes today' : 'No upcoming classes'}
            </ThemedText>
            <ThemedText style={styles.emptyText}>
              {activeTab === 'today' 
                ? 'All clear for the day!'
                : 'Your future schedule will appear here.'
              }
            </ThemedText>
          </View>
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
    backgroundColor: '#F9FAFB',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  /* Header */
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: Fonts.rounded,
    fontWeight: '700',
    color: '#111827',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    color: '#FF6B6B',
    fontWeight: '600',
  },

  /* Tabs */
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tab: {
    marginRight: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  activeTab: {},
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  activeTabText: {
    color: '#FF6B6B',
  },
  activeDot: {
    position: 'absolute',
    bottom: 0,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FF6B6B',
  },

  /* Scroll Area */
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },

  /* Timeline Row */
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timeColumn: {
    width: 60,
    alignItems: 'center',
    paddingTop: 4,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
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
    backgroundColor: '#E5E7EB',
    borderRadius: 1,
  },
  lineInactive: {
    backgroundColor: '#F3F4F6',
  },

  /* Class Card */
  classCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginLeft: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardInactive: {
    backgroundColor: '#F9FAFB',
    shadowOpacity: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  textInactive: {
    color: '#9CA3AF',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeLive: { backgroundColor: '#ECFDF5' },
  badgeScheduled: { backgroundColor: '#FFFBEB' },
  badgeCompleted: { backgroundColor: '#F3F4F6' },
  badgeCancelled: { backgroundColor: '#FEF2F2' },
  
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  textLive: { color: '#059669' },
  textScheduled: { color: '#D97706' },
  textCompleted: { color: '#6B7280' },
  textCancelled: { color: '#DC2626' },
  
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
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
    fontWeight: '500',
  },

  /* Footer Actions */
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
    paddingTop: 12,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  durationText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  actionButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  actionButtonDisabled: {
    // handled in opacity
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
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

  /* Empty State */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});