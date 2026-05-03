import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  RefreshControl,
  Platform,
} from 'react-native';
import { StudentClassesSkeleton } from '@/components/ui/dashboard-skeletons';
import { ThemedText } from '@/components/themed-text';
import {
  LingoEmptyState,
  } from '@/components/ui/lingo-mobile';
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
    loadClasses('initial');
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id && !loading) loadClasses('background');
    }, [user?.id, loading])
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
        setAttendance(
          data.attendance || {
            totalClasses: 0,
            attendedClasses: 0,
            missedClasses: 0,
            attendancePercentage: 0,
          }
        );
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
      return (
        Number.isFinite(ms) &&
        ms >= now &&
        String(c.status || '').toLowerCase() !== 'completed'
      );
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
            <ThemedText style={[styles.dateDay, isLive && { color: '#FFFFFF' }]}>
              {classDate.getDate()}
            </ThemedText>
            <ThemedText style={[styles.dateMonth, isLive && { color: 'rgba(255,255,255,0.9)' }]}>
              {classDate.toLocaleDateString('en-US', { month: 'short' })}
            </ThemedText>
            {isLive && <View style={styles.liveDot} />}
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
            <Ionicons name="time" size={14} color="#AFAFAF" />
            <ThemedText style={styles.metaText}>
              {classDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </ThemedText>
            {item.duration_minutes && (
              <>
                <ThemedText style={styles.metaDot}>·</ThemedText>
                <ThemedText style={styles.metaText}>
                  {item.duration_minutes} min
                </ThemedText>
              </>
            )}
          </View>
        </View>

        <View style={styles.classCardRight}>
          {!isPast ? (
            <TouchableOpacity
              style={[styles.joinBtn, isLive && styles.joinBtnLive]}
              onPress={() =>
                router.push({
                  pathname: '/class-room/[id]' as any,
                  params: { id: item.id },
                })
              }
              activeOpacity={0.85}
            >
              <Ionicons name="videocam" size={18} color="#FFFFFF" />
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
              activeOpacity={0.85}
            >
              <Ionicons name="star" size={16} color="#3B82F6" />
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
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topPadding,
            paddingBottom: bottomPadding + (Platform.OS === 'ios' ? 140 : 120), // Massive padding for bottom tab bar
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadClasses('refresh')}
            tintColor="#58cc02"
          />
        }
      >
        <View style={styles.contentPad}>
          <ThemedText style={styles.pageTitle}>Classes</ThemedText>
            {/* Stats Row */}
            <View style={styles.horizontalStatsRow}>
              <View style={styles.statChip}>
                <View style={[styles.statIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="calendar" size={22} color="#3B82F6" />
                </View>
                <ThemedText style={[styles.metricValue, { color: '#3B82F6' }]}>{upcoming.length}</ThemedText>
                <ThemedText style={styles.metricLabel}>Upcoming</ThemedText>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statChip}>
                <View style={[styles.statIconBox, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
                </View>
                <ThemedText style={[styles.metricValue, { color: '#22C55E' }]}>{completed.length}</ThemedText>
                <ThemedText style={styles.metricLabel}>Completed</ThemedText>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statChip}>
                <View style={[styles.statIconBox, { backgroundColor: '#FFF7ED' }]}>
                  <Ionicons name="stats-chart" size={22} color="#F97316" />
                </View>
                <ThemedText style={[styles.metricValue, { color: '#F97316' }]}>{attendance.attendancePercentage}%</ThemedText>
                <ThemedText style={styles.metricLabel}>Attendance</ThemedText>
              </View>
            </View>

          {/* Tactile Attendance Card */}
          <View style={styles.tactileCard}>
            <View style={styles.attendanceHeader}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.attendanceTitle}>
                  Attendance overview
                </ThemedText>
                <ThemedText style={styles.attendanceSubtitle}>
                  Track how many classes you joined and your attendance percentage.
                </ThemedText>
              </View>
              <View style={styles.attendanceBadge}>
                <ThemedText style={styles.attendanceBadgeText}>
                  {attendance.attendancePercentage}%
                </ThemedText>
              </View>
            </View>
            <View style={styles.attendanceMetrics}>
              <View style={styles.attendanceMetricBox}>
                <ThemedText style={styles.attendanceMetricValue}>
                  {attendance.attendedClasses}
                </ThemedText>
                <ThemedText style={styles.attendanceMetricLabel}>
                  Taken
                </ThemedText>
              </View>
              <View style={styles.attendanceMetricBox}>
                <View style={styles.attendanceMetricBoxInner}>
                  <ThemedText style={[styles.attendanceMetricValue, { color: '#FF4B4B' }]}>
                    {attendance.missedClasses}
                  </ThemedText>
                  <ThemedText style={styles.attendanceMetricLabel}>
                    Missed
                  </ThemedText>
                </View>
              </View>
              <View style={styles.attendanceMetricBox}>
                <ThemedText style={styles.attendanceMetricValue}>
                  {attendance.totalClasses}
                </ThemedText>
                <ThemedText style={styles.attendanceMetricLabel}>
                  Total
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Upcoming Section */}
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>
              Upcoming classes
            </ThemedText>
            <ThemedText style={styles.sectionCount}>
              {upcoming.length}
            </ThemedText>
          </View>
          {upcoming.length === 0 ? (
            <View style={styles.tactileCard}>
              <LingoEmptyState
                icon="calendar"
                title="No upcoming classes"
                subtitle="Your next scheduled lesson will appear here when it is ready."
                tone="primary"
              />
            </View>
          ) : (
            upcoming.map((c) => renderClassCard(c, false))
          )}

          {/* Completed Section */}
          <View style={[styles.sectionHeader, { marginTop: 24 }]}>
            <ThemedText style={styles.sectionTitle}>
              Completed classes
            </ThemedText>
            <ThemedText style={styles.sectionCount}>
              {completed.length}
            </ThemedText>
          </View>
          {completed.length === 0 ? (
            <View style={styles.tactileCard}>
              <LingoEmptyState
                icon="checkmark-circle"
                title="No completed classes yet"
                subtitle="Finished sessions will move here automatically so you can review them later."
                tone="teal"
              />
            </View>
          ) : (
            completed.map((c) => renderClassCard(c, true))
          )}
        </View>
      </ScrollView>

      <RateTeacherModal
        visible={ratingOpen}
        onClose={() => {
          setRatingOpen(false);
          setSelectedClass(null);
        }}
        onSuccess={() => {
          setRatingOpen(false);
          setSelectedClass(null);
        }}
        teacherId={selectedClass?.courses?.teacher_id || ''}
        teacherName={
          selectedClass?.courses?.teachers?.profiles?.full_name || 'Teacher'
        }
        sessionId={selectedClass?.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7', // Lingo brand background
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    // paddingBottom is handled dynamically in the component
  },
  contentPad: {
    paddingHorizontal: 20,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
    marginBottom: 4,
    marginTop: 8,
  },

  /* Stats Row */
  horizontalStatsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  statChip: { flex: 1, alignItems: 'center', gap: 6 },
  statIconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  metricValue: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  metricLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  statDivider: { width: 1, height: 48, backgroundColor: '#E5E7EB' },

  /* Tactile Base Card */
  tactileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    padding: 24,
    marginBottom: 24,
  },

  /* Attendance Card Specifics */
  attendanceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  attendanceTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#3C3C3C',
  },
  attendanceSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#777777',
    marginTop: 4,
    fontWeight: '500',
  },
  attendanceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFF8E5',
    borderWidth: 2,
    borderColor: '#D4AF37',
  },
  attendanceBadgeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#D4AF37',
  },
  attendanceMetrics: {
    flexDirection: 'row',
    gap: 12,
  },
  attendanceMetricBox: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    backgroundColor: '#F7F7F7',
    borderBottomWidth: 4, // Tactile metric boxes
    paddingVertical: 14,
  },
  attendanceMetricBoxInner: {
    alignItems: 'center',
  },
  attendanceMetricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#3C3C3C',
  },
  attendanceMetricLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#AFAFAF',
    marginTop: 4,
    textTransform: 'uppercase',
  },

  /* Section Headers */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#3C3C3C',
  },
  sectionCount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#AFAFAF',
  },

  /* Class Card - Tactile 3D Row */
  classCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  classCardLeft: {
    marginRight: 16,
  },
  dateBox: {
    width: 56,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#F7F7F7',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateBoxLive: {
    backgroundColor: '#FF4B4B',
    borderColor: '#FF4B4B',
  },
  dateDay: {
    fontSize: 20,
    fontWeight: '800',
    color: '#3C3C3C',
  },
  dateMonth: {
    fontSize: 12,
    color: '#AFAFAF',
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginTop: 4,
  },
  classCardMiddle: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  classTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#3C3C3C',
    flex: 1,
  },
  liveBadge: {
    backgroundColor: '#FFF1F1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FF4B4B',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF4B4B',
  },
  teacherName: {
    fontSize: 14,
    color: '#777777',
    fontWeight: '600',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#AFAFAF',
    fontWeight: '700',
  },
  metaDot: {
    color: '#E5E5E5',
    fontSize: 14,
    fontWeight: '800',
    marginHorizontal: 2,
  },
  classCardRight: {
    marginLeft: 12,
  },

  /* Buttons - Tactile 3D Styling */
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#58cc02',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent', // Let background color shine through
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.15)', // Creates the 3D shadow effect
    gap: 6,
  },
  joinBtnLive: {
    backgroundColor: '#FF4B4B',
  },
  joinBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5F6FF', // Soft Blue
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 6,
  },
  reviewBtnText: {
    color: '#3B82F6',
    fontSize: 15,
    fontWeight: '800',
  },
});