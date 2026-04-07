import { StyleSheet, View, TouchableOpacity, ScrollView, RefreshControl, Image, Animated, Dimensions } from 'react-native';
import { StudentDashboardSkeleton } from '@/components/ui/dashboard-skeletons';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/config';
import { LinearGradient } from 'expo-linear-gradient';

interface ClassItem {
  id: string;
  scheduled_date: string;
  status: string;
  live_status?: string;
  courses?: {
    title?: string;
    teachers?: { profiles?: { full_name?: string; avatar_url?: string } };
  };
}

interface StudentProfile {
  name: string;
  age?: number;
  surahs_memorized?: number;
  tajweed_mastery?: number;
  total_classes_attended?: number;
  total_stars_earned?: number;
  current_streak?: number;
  longest_streak?: number;
  avatar_url?: string;
}

// Animated progress ring component
function ProgressRing({ progress, size, strokeWidth, color, label, value }: {
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
  label: string;
  value: string;
}) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: Math.min(progress, 100),
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: strokeWidth,
        borderColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
      }}>
        {/* Active arc overlay */}
        <View style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: 'transparent',
          borderTopColor: color,
          borderRightColor: clampedProgress > 25 ? color : 'transparent',
          borderBottomColor: clampedProgress > 50 ? color : 'transparent',
          borderLeftColor: clampedProgress > 75 ? color : 'transparent',
          transform: [{ rotate: '-45deg' }],
        }} />
        <ThemedText style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>
          {value}
        </ThemedText>
      </View>
      <ThemedText style={{ marginTop: 8, fontSize: 12, fontWeight: '600', color: '#6B7280' }}>
        {label}
      </ThemedText>
    </View>
  );
}

export default function StudentDashboardScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadData();
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) loadData('background');
    }, [user?.id])
  );

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading]);

  const loadData = async (mode: string = 'initial') => {
    if (!user?.id) return;
    try {
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      
      const [classesRes, profileRes] = await Promise.all([
        authFetch(api.studentClasses(user.id)),
        authFetch(api.studentProfile(user.id)),
      ]);
      
      const classesData = await classesRes.json().catch(() => ({}));
      if (classesRes.ok) setClasses(classesData.classes || []);
      
      const profileData = await profileRes.json().catch(() => ({}));
      if (profileRes.ok) setProfile(profileData.student || null);
    } catch (e) {
      console.warn('Failed to load student data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const summary = useMemo(() => {
    const now = Date.now();
    const upcoming = classes.filter((c) => {
      const t = new Date(c.scheduled_date).getTime();
      return Number.isFinite(t) && t >= now && String(c.status || '').toLowerCase() !== 'completed';
    }).length;
    const completed = classes.filter((c) => {
      const raw = String(c.status || '').toLowerCase();
      if (raw === 'completed') return true;
      const t = new Date(c.scheduled_date).getTime();
      return Number.isFinite(t) && t < now;
    }).length;
    return { upcoming, completed, total: classes.length };
  }, [classes]);

  const nextClass = useMemo(() => {
    const now = Date.now();
    return classes
      .filter((c) => new Date(c.scheduled_date).getTime() >= now)
      .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())[0];
  }, [classes]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getTimeUntilClass = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return 'Starting now';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  if (loading) {
    return <StudentDashboardSkeleton />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData('refresh')} tintColor="#4ECDC4" />
        }
      >
        {/* Premium Header */}
        <LinearGradient
          colors={['#0F766E', '#14B8A6', '#2DD4BF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.greetingText}>{getGreeting()} 👋</ThemedText>
              <ThemedText style={styles.userName}>
                {profile?.name || user?.full_name || 'Student'}
              </ThemedText>
            </View>
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={() => router.push('/(student)/profile' as any)}
            >
              <Image
                source={{
                  uri: profile?.avatar_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || user?.full_name || 'S')}&background=0F766E&color=fff&bold=true`,
                }}
                style={styles.avatarImage}
              />
            </TouchableOpacity>
          </View>

          {/* Streak Badge */}
          <View style={styles.streakContainer}>
            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={18} color="#F59E0B" />
              <ThemedText style={styles.streakText}>
                {profile?.current_streak || 0} day streak
              </ThemedText>
            </View>
            <View style={styles.starsBadge}>
              <Ionicons name="star" size={16} color="#F59E0B" />
              <ThemedText style={styles.starsText}>
                {profile?.total_stars_earned || 0} stars
              </ThemedText>
            </View>
          </View>
        </LinearGradient>

        <Animated.View style={[styles.contentContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: '#ECFDF5' }]}>
              <View style={[styles.statIcon, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="calendar" size={20} color="#059669" />
              </View>
              <ThemedText style={styles.statValue}>{summary.upcoming}</ThemedText>
              <ThemedText style={styles.statLabel}>Upcoming</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}>
              <View style={[styles.statIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="checkmark-circle" size={20} color="#2563EB" />
              </View>
              <ThemedText style={styles.statValue}>{summary.completed}</ThemedText>
              <ThemedText style={styles.statLabel}>Completed</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#F5F3FF' }]}>
              <View style={[styles.statIcon, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="book" size={20} color="#7C3AED" />
              </View>
              <ThemedText style={styles.statValue}>{summary.total}</ThemedText>
              <ThemedText style={styles.statLabel}>Total</ThemedText>
            </View>
          </View>

          {/* Progress Section */}
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>My Progress</ThemedText>
          </View>
          <View style={styles.progressCard}>
            <View style={styles.progressRow}>
              <ProgressRing
                progress={(profile?.surahs_memorized || 0) * (100 / 114)}
                size={72}
                strokeWidth={4}
                color="#10B981"
                label="Surahs"
                value={`${profile?.surahs_memorized || 0}`}
              />
              <ProgressRing
                progress={profile?.tajweed_mastery || 0}
                size={72}
                strokeWidth={4}
                color="#6366F1"
                label="Tajweed"
                value={`${profile?.tajweed_mastery || 0}%`}
              />
              <ProgressRing
                progress={Math.min((profile?.total_classes_attended || 0) * 5, 100)}
                size={72}
                strokeWidth={4}
                color="#F59E0B"
                label="Classes"
                value={`${profile?.total_classes_attended || 0}`}
              />
            </View>
          </View>

          {/* Next Class */}
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Next Class</ThemedText>
            <TouchableOpacity onPress={() => router.push('/(student)/classes' as any)}>
              <ThemedText style={styles.seeAllText}>See All</ThemedText>
            </TouchableOpacity>
          </View>

          {nextClass ? (
            <TouchableOpacity
              style={styles.nextClassCard}
              activeOpacity={0.9}
              onPress={() => router.push('/(student)/classes' as any)}
            >
              <LinearGradient
                colors={['#4ECDC4', '#2BCBBA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.nextClassGradient}
              >
                <View style={styles.nextClassTop}>
                  <View style={styles.nextClassIconWrap}>
                    <Ionicons name="videocam" size={24} color="#FFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.nextClassName}>
                      {nextClass?.courses?.title || 'Class Session'}
                    </ThemedText>
                    <ThemedText style={styles.nextClassTeacher}>
                      w/ {nextClass?.courses?.teachers?.profiles?.full_name || 'Teacher'}
                    </ThemedText>
                  </View>
                  <View style={styles.countdownBadge}>
                    <Ionicons name="time" size={14} color="#FFF" />
                    <ThemedText style={styles.countdownText}>
                      {getTimeUntilClass(nextClass.scheduled_date)}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.nextClassBottom}>
                  <View style={styles.nextClassMeta}>
                    <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.9)" />
                    <ThemedText style={styles.nextClassDateText}>
                      {new Date(nextClass.scheduled_date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </ThemedText>
                  </View>
                  <View style={styles.nextClassMeta}>
                    <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.9)" />
                    <ThemedText style={styles.nextClassDateText}>
                      {new Date(nextClass.scheduled_date).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </ThemedText>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="calendar-outline" size={28} color="#9CA3AF" />
              </View>
              <ThemedText style={styles.emptyTitle}>No upcoming classes</ThemedText>
              <ThemedText style={styles.emptyDesc}>Your next class will appear here</ThemedText>
            </View>
          )}

          {/* Quick Actions */}
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Quick Actions</ThemedText>
          </View>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(student)/classes' as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="videocam" size={22} color="#059669" />
              </View>
              <ThemedText style={styles.actionLabel}>Join Class</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(student)/recordings' as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="play-circle" size={22} color="#2563EB" />
              </View>
              <ThemedText style={styles.actionLabel}>Recordings</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(student)/classes' as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: '#F5F3FF' }]}>
                <Ionicons name="calendar" size={22} color="#7C3AED" />
              </View>
              <ThemedText style={styles.actionLabel}>Schedule</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(student)/profile' as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="person" size={22} color="#D97706" />
              </View>
              <ThemedText style={styles.actionLabel}>Profile</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Recent Classes */}
          {classes.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle}>Recent Activity</ThemedText>
              </View>
              {classes.slice(0, 3).map((item) => {
                const classDate = new Date(item.scheduled_date);
                const isPast = classDate.getTime() < Date.now();
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.recentCard}
                    activeOpacity={0.8}
                    onPress={() => router.push('/(student)/classes' as any)}
                  >
                    <View style={[styles.recentIcon, { backgroundColor: isPast ? '#F3F4F6' : '#ECFDF5' }]}>
                      <Ionicons
                        name={isPast ? 'checkmark-circle' : 'time'}
                        size={20}
                        color={isPast ? '#6B7280' : '#059669'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.recentTitle}>
                        {item.courses?.title || 'Class Session'}
                      </ThemedText>
                      <ThemedText style={styles.recentMeta}>
                        {classDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ·{' '}
                        {classDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </ThemedText>
                    </View>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: isPast ? '#F3F4F6' : '#ECFDF5' }
                    ]}>
                      <ThemedText style={[
                        styles.statusText,
                        { color: isPast ? '#6B7280' : '#059669' }
                      ]}>
                        {isPast ? 'Done' : 'Upcoming'}
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  /* Header */
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greetingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
  },
  avatarButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  streakContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  streakText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  starsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  starsText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Content */
  contentContainer: {
    padding: 20,
  },

  /* Stats Grid */
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
    marginTop: -16,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '600',
  },

  /* Progress Card */
  progressCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },

  /* Sections */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  seeAllText: {
    fontSize: 14,
    color: '#14B8A6',
    fontWeight: '600',
  },

  /* Next Class Card */
  nextClassCard: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  nextClassGradient: {
    padding: 20,
  },
  nextClassTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  nextClassIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextClassName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  nextClassTeacher: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  countdownText: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '700',
  },
  nextClassBottom: {
    flexDirection: 'row',
    gap: 20,
  },
  nextClassMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nextClassDateText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },

  /* Empty State */
  emptyCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  emptyIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#9CA3AF',
  },

  /* Quick Actions */
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    width: '47%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },

  /* Recent Activity */
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  recentIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  recentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  recentMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
