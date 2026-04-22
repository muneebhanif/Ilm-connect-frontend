import { useEffect, useMemo, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View, RefreshControl } from 'react-native';
import { StudentClassesSkeleton } from '@/components/ui/dashboard-skeletons';
import { ThemedText } from '@/components/themed-text';
import { LingoCard, LingoEmptyState, LingoScreenHeader, LingoStatPill } from '@/components/ui/lingo-mobile';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/config';
import { authFetch } from '@/lib/auth-fetch';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RateTeacherModal } from '@/components/rate-teacher-modal';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';
import { useFocusEffect } from '@react-navigation/native';

interface ClassSession {
  id: string;
  scheduled_date: string;
  duration_minutes: number;
  status: string;
  live_status?: string;
  courses: {
    title: string;
    teacher_id: string;
    teachers: { profiles: { full_name: string } };
  };
}

interface AttendanceSummary {
  totalClasses: number;
  attendedClasses: number;
  missedClasses: number;
  attendancePercentage: number;
}

export default function StudentClassesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { topPadding, bottomPadding } = useSafePadding();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSummary>({
    totalClasses: 0,
    attendedClasses: 0,
    missedClasses: 0,
    attendancePercentage: 0,
  });
  const [ratingOpen, setRatingOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassSession | null>(null);

  useEffect(() => {
    loadClasses();
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id && !loading) loadClasses('background');
    }, [user?.id])
  );

  const loadClasses = async (mode = 'initial') => {
    if (!user?.id) return;
    try {
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      const response = await authFetch(api.studentClasses(user.id));
      const data = await response.json();
      if (response.ok) {
        setClasses(data.classes || []);
        setAttendance(data.attendance || {
          totalClasses: 0,
          attendedClasses: 0,
          missedClasses: 0,
          attendancePercentage: 0,
        });
      }
    } catch (error) {
      console.error('Failed to load student classes', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const { upcoming, completed } = useMemo(() => {
    const now = Date.now();
    const upcomingClasses = classes.filter((c) => {
      const ms = new Date(c.scheduled_date).getTime();
      return Number.isFinite(ms) && ms >= now && String(c.status || '').toLowerCase() !== 'completed';
    });

    const doneClasses = classes.filter((c) => {
      const raw = String(c.status || '').toLowerCase();
      if (raw === 'completed') return true;
      const ms = new Date(c.scheduled_date).getTime();
      return Number.isFinite(ms) && ms < now;
    });

    return { upcoming: upcomingClasses, completed: doneClasses };
  }, [classes]);

  const renderClassCard = (item: ClassSession, isPast: boolean) => {
    const classDate = new Date(item.scheduled_date);
    const isLive = String(item.live_status || '').toLowerCase() === 'live';
    
    return (
      <View key={item.id} style={styles.classCard}>
        <View style={styles.classCardLeft}>
          <View style={[styles.dateBox, isLive && styles.dateBoxLive]}>
            <ThemedText style={[styles.dateDay, isLive && { color: '#FFF' }]}>
              {classDate.getDate()}
            </ThemedText>
            <ThemedText style={[styles.dateMonth, isLive && { color: 'rgba(255,255,255,0.8)' }]}>
              {classDate.toLocaleDateString('en-US', { month: 'short' })}
            </ThemedText>
            {isLive && (
              <View style={styles.liveDot} />
            )}
          </View>
        </View>

        <View style={styles.classCardMiddle}>
          <View style={styles.titleRow}>
            <ThemedText style={styles.classTitle} numberOfLines={1}>
              {item.courses?.title || 'Class Session'}
            </ThemedText>
            {isLive && (
              <View style={styles.liveBadge}>
                <ThemedText style={styles.liveText}>LIVE</ThemedText>
              </View>
            )}
          </View>
          <ThemedText style={styles.teacherName}>
            {item.courses?.teachers?.profiles?.full_name || 'Teacher'}
          </ThemedText>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={13} color="#6B7280" />
            <ThemedText style={styles.metaText}>
              {classDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </ThemedText>
            {item.duration_minutes && (
              <>
                <ThemedText style={styles.metaDot}>·</ThemedText>
                <ThemedText style={styles.metaText}>{item.duration_minutes} min</ThemedText>
              </>
            )}
          </View>
        </View>

        <View style={styles.classCardRight}>
          {!isPast ? (
            <TouchableOpacity
              style={[styles.joinBtn, isLive && styles.joinBtnLive]}
              onPress={() => router.push({ pathname: '/class-room/[id]' as any, params: { id: item.id } })}
              activeOpacity={0.8}
            >
              <Ionicons name="videocam" size={16} color="#FFF" />
              <ThemedText style={styles.joinBtnText}>
                {isLive ? 'Join' : 'Enter'}
              </ThemedText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.reviewBtn}
              onPress={() => {
                setSelectedClass(item);
                setRatingOpen(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="star-outline" size={16} color="#D97706" />
              <ThemedText style={styles.reviewBtnText}>Rate</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return <StudentClassesSkeleton />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding, paddingBottom: bottomPadding + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadClasses('refresh')} tintColor={LingoTheme.colors.primary} />
        }
      >
        <View style={styles.contentPad}>
          <LingoScreenHeader
            badge="Student hub"
            icon="school"
            title="Classes that stay easy to follow"
            subtitle="See live lessons, upcoming sessions, and completed classes in one bright, clear view."
          >
            <View style={styles.headerStatsWrap}>
              <LingoStatPill icon="📅" value={String(upcoming.length)} label="Upcoming" tone="primary" />
              <LingoStatPill icon="✅" value={String(completed.length)} label="Completed" tone="teal" />
              <LingoStatPill icon="🎯" value={`${attendance.attendancePercentage}%`} label="Attendance" tone="gold" />
            </View>
          </LingoScreenHeader>

          <LingoCard style={styles.attendanceCard}>
            <View style={styles.attendanceHeader}>
              <View>
                <ThemedText style={styles.attendanceTitle}>Attendance overview</ThemedText>
                <ThemedText style={styles.attendanceSubtitle}>Track how many classes you joined and your attendance percentage.</ThemedText>
              </View>
              <View style={styles.attendanceBadge}>
                <ThemedText style={styles.attendanceBadgeText}>{attendance.attendancePercentage}%</ThemedText>
              </View>
            </View>
            <View style={styles.attendanceMetrics}>
              <View style={styles.attendanceMetricBox}>
                <ThemedText style={styles.attendanceMetricValue}>{attendance.attendedClasses}</ThemedText>
                <ThemedText style={styles.attendanceMetricLabel}>Taken</ThemedText>
              </View>
              <View style={styles.attendanceMetricBox}>
                <ThemedText style={styles.attendanceMetricValue}>{attendance.missedClasses}</ThemedText>
                <ThemedText style={styles.attendanceMetricLabel}>Missed</ThemedText>
              </View>
              <View style={styles.attendanceMetricBox}>
                <ThemedText style={styles.attendanceMetricValue}>{attendance.totalClasses}</ThemedText>
                <ThemedText style={styles.attendanceMetricLabel}>Total</ThemedText>
              </View>
            </View>
          </LingoCard>

          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Upcoming classes</ThemedText>
            <ThemedText style={styles.sectionCount}>{upcoming.length}</ThemedText>
          </View>
          {upcoming.length === 0 ? (
            <LingoCard>
              <LingoEmptyState icon="calendar-outline" title="No upcoming classes" subtitle="Your next scheduled lesson will appear here when it is ready." tone="primary" />
            </LingoCard>
          ) : (
            upcoming.map((c) => renderClassCard(c, false))
          )}

          <View style={[styles.sectionHeader, { marginTop: 24 }]}>
            <ThemedText style={styles.sectionTitle}>Completed classes</ThemedText>
            <ThemedText style={styles.sectionCount}>{completed.length}</ThemedText>
          </View>
          {completed.length === 0 ? (
            <LingoCard>
              <LingoEmptyState icon="checkmark-circle-outline" title="No completed classes yet" subtitle="Finished sessions will move here automatically so you can review them later." tone="teal" />
            </LingoCard>
          ) : (
            completed.map((c) => renderClassCard(c, true))
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <RateTeacherModal
        visible={ratingOpen}
        onClose={() => { setRatingOpen(false); setSelectedClass(null); }}
        onSuccess={() => { setRatingOpen(false); setSelectedClass(null); }}
        teacherId={selectedClass?.courses?.teacher_id || ''}
        teacherName={selectedClass?.courses?.teachers?.profiles?.full_name || 'Teacher'}
        sessionId={selectedClass?.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LingoTheme.colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  contentPad: {
    paddingHorizontal: 16,
  },
  headerStatsWrap: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  attendanceCard: {
    marginBottom: 20,
  },
  attendanceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  attendanceTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
  },
  attendanceSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: LingoTheme.colors.muted,
    marginTop: 4,
  },
  attendanceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FCD34D',
  },
  attendanceBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309',
  },
  attendanceMetrics: {
    flexDirection: 'row',
    gap: 10,
  },
  attendanceMetricBox: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    backgroundColor: LingoTheme.colors.surfaceAlt,
    paddingVertical: 14,
  },
  attendanceMetricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
  },
  attendanceMetricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: LingoTheme.colors.muted,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '800',
    color: LingoTheme.colors.muted,
  },

  /* Class Card */
  classCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    alignItems: 'center',
  },
  classCardLeft: {
    marginRight: 14,
  },
  dateBox: {
    width: 52,
    height: 58,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateBoxLive: {
    backgroundColor: '#EF4444',
  },
  dateDay: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
  },
  dateMonth: {
    fontSize: 11,
    color: '#6B7280',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
    marginTop: 2,
  },
  classCardMiddle: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  classTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  liveBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  teacherName: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  metaDot: {
    color: '#D1D5DB',
    fontSize: 12,
  },
  classCardRight: {
    marginLeft: 10,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14B8A6',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  joinBtnLive: {
    backgroundColor: '#EF4444',
  },
  joinBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  reviewBtnText: {
    color: '#D97706',
    fontSize: 13,
    fontWeight: '700',
  },

});
