import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/config';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';
import { PerformanceAnalyticsSkeleton } from '@/components/ui/dashboard-skeletons';

type SessionStatus = 'upcoming' | 'completed' | 'cancelled';

interface ScheduleSession {
  id: string;
  session_date: string;
  status?: SessionStatus;
}

interface StudentItem {
  id: string;
  name?: string;
  progress?: number | string | null;
}

interface TeacherProfileResponse {
  profile?: {
    rating?: number;
    hourly_rate?: number;
  };
  stats?: {
    totalStudents?: number;
    completedClasses?: number;
    upcomingClasses?: number;
  };
}

interface DayPoint {
  label: string;
  total: number;
}

const safeNumber = (value: unknown): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const getEffectiveStatus = (session: ScheduleSession): SessionStatus => {
  const raw = String(session.status || '').toLowerCase();
  if (raw === 'cancelled') return 'cancelled';
  if (raw === 'completed') return 'completed';

  const ms = new Date(session.session_date).getTime();
  if (Number.isFinite(ms) && ms <= Date.now()) return 'completed';

  return 'upcoming';
};

export default function PerformanceAnalyticsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { topPadding, bottomPadding } = useSafePadding();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<ScheduleSession[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [profileData, setProfileData] = useState<TeacherProfileResponse | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadAnalytics();
    }, [user?.id])
  );

  const loadAnalytics = async () => {
    if (!user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);

      const [profileRes, scheduleRes, studentsRes] = await Promise.all([
        fetch(api.teacherProfile(user.id)),
        fetch(api.teacherSchedule(user.id)),
        fetch(`${api.teacherById(user.id)}/students`),
      ]);

      const [profileJson, scheduleJson, studentsJson] = await Promise.all([
        profileRes.json(),
        scheduleRes.json(),
        studentsRes.json(),
      ]);

      if (profileRes.ok) {
        setProfileData(profileJson);
      }

      if (scheduleRes.ok) {
        setSessions(Array.isArray(scheduleJson.sessions) ? scheduleJson.sessions : []);
      } else {
        setSessions([]);
      }

      if (studentsRes.ok) {
        setStudents(Array.isArray(studentsJson.students) ? studentsJson.students : []);
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      setSessions([]);
      setStudents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  const analytics = useMemo(() => {
    const now = new Date();
    const last30DaysStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const normalizedSessions = sessions.map((s) => ({
      ...s,
      effectiveStatus: getEffectiveStatus(s),
      dateObj: new Date(s.session_date),
    }));

    const last30Sessions = normalizedSessions.filter(
      (s) => Number.isFinite(s.dateObj.getTime()) && s.dateObj >= last30DaysStart
    );

    const statusCounts = {
      completed: last30Sessions.filter((s) => s.effectiveStatus === 'completed').length,
      upcoming: last30Sessions.filter((s) => s.effectiveStatus === 'upcoming').length,
      cancelled: last30Sessions.filter((s) => s.effectiveStatus === 'cancelled').length,
    };

    const total30 = last30Sessions.length;
    const completionRate = total30 > 0 ? Math.round((statusCounts.completed / total30) * 100) : 0;

    const dayLabels: DayPoint[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date(now);
      day.setDate(now.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);

      const total = normalizedSessions.filter((s) => {
        const ms = s.dateObj.getTime();
        return Number.isFinite(ms) && ms >= day.getTime() && ms < nextDay.getTime();
      }).length;

      dayLabels.push({
        label: day.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1),
        total,
      });
    }

    const maxDayCount = Math.max(1, ...dayLabels.map((d) => d.total));

    const studentProgress = students
      .map((s) => ({
        id: s.id,
        name: String(s.name || 'Student'),
        progress: Math.max(0, Math.min(100, Math.round(safeNumber(s.progress)))),
      }))
      .filter((s) => s.progress > 0)
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 5);

    const avgProgress = studentProgress.length > 0
      ? Math.round(studentProgress.reduce((sum, s) => sum + s.progress, 0) / studentProgress.length)
      : 0;

    return {
      total30,
      completionRate,
      statusCounts,
      dayLabels,
      maxDayCount,
      studentProgress,
      avgProgress,
      activeStudents: students.length,
      rating: safeNumber(profileData?.profile?.rating),
      hourlyRate: safeNumber(profileData?.profile?.hourly_rate),
      totalStudentsStat: safeNumber(profileData?.stats?.totalStudents),
    };
  }, [sessions, students, profileData]);

  if (loading) {
    return <PerformanceAnalyticsSkeleton />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingTop: topPadding, paddingBottom: bottomPadding + (Platform.OS === 'ios' ? 120 : 100) }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LingoTheme.colors.primary} />}
      >
        <View style={styles.contentPad}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color="#3C3C3C" />
          </TouchableOpacity>
          <View style={styles.topBarCenter}>
            <ThemedText style={styles.topBarTitle}>Analytics</ThemedText>
            <ThemedText style={styles.topBarSub}>Your teaching performance</ThemedText>
          </View>
          <View style={{ width: 44 }} />
        </View>
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.metricPill}>
            <ThemedText style={styles.pillIcon}>📚</ThemedText>
            <ThemedText style={styles.pillValue}>{analytics.total30}</ThemedText>
            <ThemedText style={styles.pillLabel}>30d classes</ThemedText>
          </View>
          <View style={styles.metricPill}>
            <ThemedText style={styles.pillIcon}>✅</ThemedText>
            <ThemedText style={styles.pillValue}>{analytics.completionRate}%</ThemedText>
            <ThemedText style={styles.pillLabel}>Done</ThemedText>
          </View>
          <View style={styles.metricPill}>
            <ThemedText style={styles.pillIcon}>👥</ThemedText>
            <ThemedText style={styles.pillValue}>{analytics.activeStudents}</ThemedText>
            <ThemedText style={styles.pillLabel}>Students</ThemedText>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { borderLeftColor: '#4ECDC4', borderLeftWidth: 4 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <ThemedText style={styles.metricValue}>{analytics.total30}</ThemedText>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#F0FDFA', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="calendar" size={18} color="#4ECDC4" />
              </View>
            </View>
            <ThemedText style={styles.metricLabel}>Classes (30d)</ThemedText>
          </View>
          <View style={[styles.metricCard, { borderLeftColor: '#10B981', borderLeftWidth: 4 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <ThemedText style={styles.metricValue}>{analytics.completionRate}%</ThemedText>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              </View>
            </View>
            <ThemedText style={styles.metricLabel}>Completion Rate</ThemedText>
          </View>
          <View style={[styles.metricCard, { borderLeftColor: '#6366F1', borderLeftWidth: 4 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <ThemedText style={styles.metricValue}>{analytics.activeStudents}</ThemedText>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="people" size={18} color="#6366F1" />
              </View>
            </View>
            <ThemedText style={styles.metricLabel}>Active Students</ThemedText>
          </View>
          <View style={[styles.metricCard, { borderLeftColor: '#F59E0B', borderLeftWidth: 4 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <ThemedText style={styles.metricValue}>{analytics.avgProgress}%</ThemedText>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#FFFBEB', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="trending-up" size={18} color="#F59E0B" />
              </View>
            </View>
            <ThemedText style={styles.metricLabel}>Avg Progress</ThemedText>
          </View>
        </View>

        <View style={styles.chartCard}>
          <ThemedText style={styles.cardTitle}>Classes in Last 7 Days</ThemedText>
          <View style={styles.barChartRow}>
            {analytics.dayLabels.map((point) => {
              const barHeight = Math.max(8, (point.total / analytics.maxDayCount) * 120);
              return (
                <View key={point.label} style={styles.barColumn}>
                  <ThemedText style={styles.barValue}>{point.total}</ThemedText>
                  <View style={[styles.bar, { height: barHeight }]} />
                  <ThemedText style={styles.barLabel}>{point.label}</ThemedText>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.chartCard}>
          <ThemedText style={styles.cardTitle}>Session Status Breakdown</ThemedText>

          {([
            { key: 'completed', label: 'Completed', color: '#10B981', count: analytics.statusCounts.completed },
            { key: 'upcoming', label: 'Upcoming', color: '#3B82F6', count: analytics.statusCounts.upcoming },
            { key: 'cancelled', label: 'Cancelled', color: '#EF4444', count: analytics.statusCounts.cancelled },
          ] as const).map((item) => {
            const total = Math.max(1, analytics.total30);
            const percentage = Math.round((item.count / total) * 100);
            return (
              <View key={item.key} style={styles.statusRow}>
                <View style={styles.statusHeader}>
                  <ThemedText style={styles.statusLabel}>{item.label}</ThemedText>
                  <ThemedText style={styles.statusValue}>{item.count} ({percentage}%)</ThemedText>
                </View>
                <View style={styles.statusTrack}>
                  <View style={[styles.statusFill, { width: `${percentage}%`, backgroundColor: item.color }]} />
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.chartCard}>
          <ThemedText style={styles.cardTitle}>Top Student Progress</ThemedText>
          {analytics.studentProgress.length === 0 ? (
            <ThemedText style={styles.emptyText}>No progress data yet.</ThemedText>
          ) : (
            analytics.studentProgress.map((student) => (
              <View key={student.id} style={styles.studentRow}>
                <View style={styles.studentNameWrap}>
                  <ThemedText style={styles.studentName} numberOfLines={1}>{student.name}</ThemedText>
                  <ThemedText style={styles.studentPercent}>{student.progress}%</ThemedText>
                </View>
                <View style={styles.studentTrack}>
                  <View style={[styles.studentFill, { width: `${student.progress}%` }]} />
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.summaryCard}>
          <ThemedText style={styles.cardTitle}>Overview</ThemedText>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#FFFBEB', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="star" size={20} color="#F59E0B" />
              </View>
              <View>
                <ThemedText style={styles.summaryValue}>{analytics.rating > 0 ? analytics.rating.toFixed(1) : 'New'}</ThemedText>
                <ThemedText style={styles.summaryLabel}>Rating</ThemedText>
              </View>
            </View>
            <View style={styles.summaryItem}>
              <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="cash-outline" size={20} color="#10B981" />
              </View>
              <View>
                <ThemedText style={styles.summaryValue}>${analytics.hourlyRate || 0}</ThemedText>
                <ThemedText style={styles.summaryLabel}>Hourly Rate</ThemedText>
              </View>
            </View>
            <View style={styles.summaryItem}>
              <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="people-outline" size={20} color="#3B82F6" />
              </View>
              <View>
                <ThemedText style={styles.summaryValue}>{analytics.totalStudentsStat || analytics.activeStudents}</ThemedText>
                <ThemedText style={styles.summaryLabel}>Total Students</ThemedText>
              </View>
            </View>
          </View>
        </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LingoTheme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentPad: {
    paddingHorizontal: 16,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  backButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 2, borderColor: '#E5E5E5', borderBottomWidth: 4,
    justifyContent: 'center', alignItems: 'center',
  },
  topBarCenter: { flex: 1, alignItems: 'center' },
  topBarTitle: { fontSize: 20, fontWeight: '800', color: '#3C3C3C' },
  topBarSub: { fontSize: 13, color: '#AFAFAF', fontWeight: '600', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginBottom: 16 },
  metricPill: {
    flex: 1, alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, borderWidth: 2, borderColor: '#E5E5E5', borderBottomWidth: 4,
    paddingVertical: 12, paddingHorizontal: 4,
  },
  pillIcon: { fontSize: 18, marginBottom: 2 },
  pillValue: { fontSize: 16, fontWeight: '800', color: '#3C3C3C' },
  pillLabel: { fontSize: 10, fontWeight: '700', color: '#AFAFAF', textTransform: 'uppercase' },
  metricsGrid: {
    marginTop: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  metricLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  chartCard: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  barChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 150,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barValue: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  bar: {
    width: 20,
    borderRadius: 10,
    backgroundColor: '#4ECDC4',
  },
  barLabel: {
    marginTop: 6,
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  statusRow: {
    marginBottom: 12,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statusLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  statusTrack: {
    height: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    overflow: 'hidden',
  },
  statusFill: {
    height: '100%',
    borderRadius: 10,
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  studentRow: {
    marginBottom: 12,
  },
  studentNameWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  studentName: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
  },
  studentPercent: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
  },
  studentTrack: {
    height: 9,
    borderRadius: 9,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  studentFill: {
    height: '100%',
    borderRadius: 9,
    backgroundColor: '#6366F1',
  },
  summaryCard: {
    marginTop: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    gap: 8,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  summaryText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
});
