import { useEffect, useMemo, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View, RefreshControl } from 'react-native';
import { StudentClassesSkeleton } from '@/components/ui/dashboard-skeletons';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/config';
import { authFetch } from '@/lib/auth-fetch';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RateTeacherModal } from '@/components/rate-teacher-modal';
import { LinearGradient } from 'expo-linear-gradient';
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

export default function StudentClassesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { topPadding } = useSafePadding();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [classes, setClasses] = useState<ClassSession[]>([]);
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
      if (response.ok) setClasses(data.classes || []);
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadClasses('refresh')} tintColor="#14B8A6" />
        }
      >
        {/* Header */}
        <LinearGradient
          colors={['#0F766E', '#14B8A6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: topPadding }]}
        >
          <ThemedText style={styles.headerTitle}>My Classes</ThemedText>
          <ThemedText style={styles.headerSubtitle}>Join live sessions & review history</ThemedText>
          <View style={styles.headerStats}>
            <View style={styles.headerStat}>
              <ThemedText style={styles.headerStatValue}>{upcoming.length}</ThemedText>
              <ThemedText style={styles.headerStatLabel}>Upcoming</ThemedText>
            </View>
            <View style={styles.headerStatDivider} />
            <View style={styles.headerStat}>
              <ThemedText style={styles.headerStatValue}>{completed.length}</ThemedText>
              <ThemedText style={styles.headerStatLabel}>Completed</ThemedText>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.contentPad}>
          {/* Upcoming */}
          <View style={styles.sectionHeader}>
            <Ionicons name="time" size={18} color="#059669" />
            <ThemedText style={styles.sectionTitle}>Upcoming</ThemedText>
          </View>
          {upcoming.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={28} color="#D1D5DB" />
              <ThemedText style={styles.emptyText}>No upcoming classes</ThemedText>
            </View>
          ) : (
            upcoming.map((c) => renderClassCard(c, false))
          )}

          {/* Completed */}
          <View style={[styles.sectionHeader, { marginTop: 24 }]}>
            <Ionicons name="checkmark-circle" size={18} color="#6B7280" />
            <ThemedText style={styles.sectionTitle}>Completed</ThemedText>
          </View>
          {completed.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="time-outline" size={28} color="#D1D5DB" />
              <ThemedText style={styles.emptyText}>No completed classes yet</ThemedText>
            </View>
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
    backgroundColor: '#F9FAFB',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  /* Header */
  header: {
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 16,
  },
  headerStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    padding: 14,
  },
  headerStat: {
    flex: 1,
    alignItems: 'center',
  },
  headerStatValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  headerStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  headerStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 8,
  },

  /* Content */
  contentPad: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
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

  /* Empty */
  emptyCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
