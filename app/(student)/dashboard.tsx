import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Image,
  Animated,
  Platform,
} from 'react-native';
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
import { useSafePadding } from '@/hooks/use-safe-padding';
import { LingoTheme } from '@/constants/theme';

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
function ProgressRing({
  progress,
  size,
  strokeWidth,
  color,
  label,
  value,
}: {
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
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: LingoTheme.colors.borderLight,
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        {/* Active arc overlay */}
        <View
          style={{
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
          }}
        />
        <ThemedText
          style={{
            fontSize: LingoTheme.typography.sizes.base,
            fontWeight: LingoTheme.typography.weights.extrabold,
            color: LingoTheme.colors.ink,
          }}
        >
          {value}
        </ThemedText>
      </View>
      <ThemedText
        style={{
          marginTop: LingoTheme.spacing[2],
          fontSize: LingoTheme.typography.sizes.xs,
          fontWeight: LingoTheme.typography.weights.semibold,
          color: LingoTheme.colors.muted,
        }}
      >
        {label}
      </ThemedText>
    </View>
  );
}

export default function StudentDashboardScreen() {
  const { user, signOut } = useAuth();
  const { topPadding } = useSafePadding();
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
      return (
        Number.isFinite(t) &&
        t >= now &&
        String(c.status || '').toLowerCase() !== 'completed'
      );
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
      .sort(
        (a, b) =>
          new Date(a.scheduled_date).getTime() -
          new Date(b.scheduled_date).getTime()
      )[0];
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData('refresh')}
            tintColor={LingoTheme.colors.primary}
          />
        }
      >
        {/* ── Top Bar ── */}
        <View style={[styles.headerWrap, { paddingTop: topPadding + 10 }]}>
          <View style={styles.topBar}>
            <View style={styles.userInfo}>
              <TouchableOpacity
                style={styles.profileButton}
                onPress={() => router.push('/(student)/profile' as any)}
                activeOpacity={0.8}
              >
                <Image
                  source={{
                    uri:
                      profile?.avatar_url ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        profile?.name || user?.full_name || 'S'
                      )}&background=0F766E&color=fff&bold=true`,
                  }}
                  style={styles.profileImage}
                />
              </TouchableOpacity>
              <View style={styles.welcomeText}>
                <ThemedText style={styles.greetingText}>{getGreeting()},</ThemedText>
                <ThemedText style={styles.nameText}>{(profile?.name || user?.full_name || 'Student').split(' ')[0]}!</ThemedText>
                <ThemedText style={styles.motivationalText}>Keep up the great learning streak! 🌟</ThemedText>
              </View>
            </View>
            <TouchableOpacity style={styles.iconButton} activeOpacity={0.8}>
              <Ionicons name="notifications" size={24} color="#AFAFAF" />
            </TouchableOpacity>
          </View>

          {/* Student Hub Card */}
          <LinearGradient
            colors={['#E0FDF4', '#FFFFFF', '#EEF2FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hubCard}
          >
            <View style={styles.hubAvatarContainer}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.hubAvatar} />
              ) : (
                <View style={[styles.hubAvatar, styles.hubAvatarFallback]}>
                  <ThemedText style={styles.hubAvatarInitial}>
                    {(profile?.name || user?.full_name || 'S').charAt(0).toUpperCase()}
                  </ThemedText>
                </View>
              )}
            </View>
            <ThemedText style={styles.hubTitle}>{(profile?.name || user?.full_name || 'Student').split(' ')[0]}</ThemedText>
            <ThemedText style={styles.hubSubtitle}>Track classes, build habits, and grow your knowledge every day.</ThemedText>
          </LinearGradient>

          {/* Horizontal Stats Row */}
          <View style={styles.horizontalStatsRow}>
            <TouchableOpacity style={styles.metricPill} activeOpacity={0.8} onPress={() => router.push('/(student)/classes' as any)}>
              <Ionicons name="calendar" size={24} color="#58cc02" />
              <ThemedText style={styles.metricValue}>{summary.upcoming}</ThemedText>
              <ThemedText style={styles.metricLabel}>UPCOMING</ThemedText>
              <View style={styles.metricArrow}>
                <Ionicons name="arrow-forward" size={14} color="#58cc02" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.metricPill} activeOpacity={0.8} onPress={() => router.push('/(student)/classes' as any)}>
              <Ionicons name="checkmark-circle" size={24} color="#14B8A6" />
              <ThemedText style={styles.metricValue}>{summary.completed}</ThemedText>
              <ThemedText style={styles.metricLabel}>COMPLETED</ThemedText>
              <View style={[styles.metricArrow, { backgroundColor: '#E0FDF4' }]}>
                <Ionicons name="arrow-forward" size={14} color="#14B8A6" />
              </View>
            </TouchableOpacity>
            <View style={styles.metricPill}>
              <Ionicons name="star" size={24} color="#FFC800" />
              <ThemedText style={styles.metricValue}>{profile?.total_stars_earned || 0}</ThemedText>
              <ThemedText style={styles.metricLabel}>STARS</ThemedText>
              <View style={[styles.metricArrow, { backgroundColor: '#FFF9E6' }]}>
                <Ionicons name="arrow-forward" size={14} color="#FFC800" />
              </View>
            </View>
          </View>

          {/* Streak banner */}
          <View style={styles.streakBanner}>
            <View style={styles.streakIconBg}>
              <Ionicons name="flame" size={28} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.streakTitle}>{profile?.current_streak || 0} Day Streak 🔥</ThemedText>
              <ThemedText style={styles.streakSub}>Keep learning daily to maintain your streak!</ThemedText>
            </View>
          </View>
        </View>

        <Animated.View
          style={[
            styles.contentContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
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
                color={LingoTheme.colors.teal}
                label="Surahs"
                value={`${profile?.surahs_memorized || 0}`}
              />
              <ProgressRing
                progress={profile?.tajweed_mastery || 0}
                size={72}
                strokeWidth={4}
                color={LingoTheme.colors.purple}
                label="Tajweed"
                value={`${profile?.tajweed_mastery || 0}%`}
              />
              <ProgressRing
                progress={Math.min(
                  (profile?.total_classes_attended || 0) * 5,
                  100
                )}
                size={72}
                strokeWidth={4}
                color={LingoTheme.colors.gold}
                label="Classes"
                value={`${profile?.total_classes_attended || 0}`}
              />
            </View>
          </View>

          {/* Next Class */}
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Next Class</ThemedText>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push('/(student)/classes' as any)}
            >
              <ThemedText style={styles.seeAllText}>See All</ThemedText>
            </TouchableOpacity>
          </View>

          {nextClass ? (
            <TouchableOpacity
              style={styles.nextClassCard}
              activeOpacity={0.85}
              onPress={() => router.push('/(student)/classes' as any)}
            >
              <LinearGradient
                colors={[LingoTheme.colors.teal, LingoTheme.colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.nextClassGradient}
              >
                <View style={styles.nextClassTop}>
                  <View style={styles.nextClassIconWrap}>
                    <Ionicons
                      name="videocam"
                      size={24}
                      color={LingoTheme.colors.surface}
                    />
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
                    <Ionicons
                      name="time"
                      size={14}
                      color={LingoTheme.colors.surface}
                    />
                    <ThemedText style={styles.countdownText}>
                      {getTimeUntilClass(nextClass.scheduled_date)}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.nextClassBottom}>
                  <View style={styles.nextClassMeta}>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color={LingoTheme.colors.textInverse}
                    />
                    <ThemedText style={styles.nextClassDateText}>
                      {new Date(nextClass.scheduled_date).toLocaleDateString(
                        'en-US',
                        { weekday: 'short', month: 'short', day: 'numeric' }
                      )}
                    </ThemedText>
                  </View>
                  <View style={styles.nextClassMeta}>
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={LingoTheme.colors.textInverse}
                    />
                    <ThemedText style={styles.nextClassDateText}>
                      {new Date(nextClass.scheduled_date).toLocaleTimeString(
                        'en-US',
                        { hour: 'numeric', minute: '2-digit' }
                      )}
                    </ThemedText>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconBg}>
                <Ionicons
                  name="calendar-outline"
                  size={28}
                  color={LingoTheme.colors.textTertiary}
                />
              </View>
              <ThemedText style={styles.emptyTitle}>
                No upcoming classes
              </ThemedText>
              <ThemedText style={styles.emptyDesc}>
                Your next class will appear here
              </ThemedText>
            </View>
          )}

          {/* Quick Actions */}
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Quick Actions</ThemedText>
          </View>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.85}
              onPress={() => router.push('/(student)/classes' as any)}
            >
              <View
                style={[
                  styles.actionIconWrap,
                  { backgroundColor: LingoTheme.colors.softPrimary },
                ]}
              >
                <Ionicons
                  name="videocam"
                  size={22}
                  color={LingoTheme.colors.primary}
                />
              </View>
              <ThemedText style={styles.actionLabel}>Join Class</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.85}
              onPress={() => router.push('/(student)/recordings' as any)}
            >
              <View
                style={[
                  styles.actionIconWrap,
                  { backgroundColor: LingoTheme.colors.softTeal },
                ]}
              >
                <Ionicons
                  name="play-circle"
                  size={22}
                  color={LingoTheme.colors.teal}
                />
              </View>
              <ThemedText style={styles.actionLabel}>Recordings</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.85}
              onPress={() => router.push('/(student)/classes' as any)}
            >
              <View
                style={[
                  styles.actionIconWrap,
                  { backgroundColor: LingoTheme.colors.softPurple },
                ]}
              >
                <Ionicons
                  name="calendar"
                  size={22}
                  color={LingoTheme.colors.purple}
                />
              </View>
              <ThemedText style={styles.actionLabel}>Schedule</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.85}
              onPress={() => router.push('/(student)/profile' as any)}
            >
              <View
                style={[
                  styles.actionIconWrap,
                  { backgroundColor: LingoTheme.colors.softGold },
                ]}
              >
                <Ionicons
                  name="person"
                  size={22}
                  color={LingoTheme.colors.gold}
                />
              </View>
              <ThemedText style={styles.actionLabel}>Profile</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Recent Classes */}
          {classes.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle}>
                  Recent Activity
                </ThemedText>
              </View>
              {classes.slice(0, 3).map((item) => {
                const classDate = new Date(item.scheduled_date);
                const isPast = classDate.getTime() < Date.now();
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.recentCard}
                    activeOpacity={0.85}
                    onPress={() => router.push('/(student)/classes' as any)}
                  >
                    <View
                      style={[
                        styles.recentIcon,
                        {
                          backgroundColor: isPast
                            ? LingoTheme.colors.borderLight
                            : LingoTheme.colors.softPrimary,
                        },
                      ]}
                    >
                      <Ionicons
                        name={isPast ? 'checkmark-circle' : 'time'}
                        size={20}
                        color={
                          isPast
                            ? LingoTheme.colors.muted
                            : LingoTheme.colors.primary
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.recentTitle}>
                        {item.courses?.title || 'Class Session'}
                      </ThemedText>
                      <ThemedText style={styles.recentMeta}>
                        {classDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                        {' · '}
                        {classDate.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </ThemedText>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: isPast
                            ? LingoTheme.colors.borderLight
                            : LingoTheme.colors.softPrimary,
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.statusText,
                          {
                            color: isPast
                              ? LingoTheme.colors.muted
                              : LingoTheme.colors.primary,
                          },
                        ]}
                      >
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
    backgroundColor: '#F7F7F7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Platform.OS === 'ios' ? 140 : 120,
  },

  /* ── Top Bar ── */
  headerWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  welcomeText: {
    justifyContent: 'center',
    flex: 1,
  },
  greetingText: {
    fontSize: 14,
    color: '#AFAFAF',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  nameText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#3C3C3C',
  },
  motivationalText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#AFAFAF',
    marginTop: 3,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    overflow: 'hidden',
    backgroundColor: '#FFF',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },

  /* ── Student Hub Card ── */
  hubCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    marginBottom: 16,
    overflow: 'hidden',
  },
  hubAvatarContainer: {
    marginBottom: 4,
  },
  hubAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#99F6E4',
  },
  hubAvatarFallback: {
    backgroundColor: '#0D9488',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hubAvatarInitial: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  hubTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#3C3C3C',
    marginTop: 12,
    marginBottom: 6,
  },
  hubSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },

  /* ── Horizontal Stats Row ── */
  horizontalStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 16,
  },
  metricPill: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#3C3C3C',
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#AFAFAF',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  metricArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ECFCD8',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },

  /* ── Streak Banner ── */
  streakBanner: {
    backgroundColor: '#FFFBEB',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FDE68A',
    borderBottomWidth: 4,
    marginBottom: 16,
    gap: 14,
  },
  streakIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFF7D6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F4D778',
  },
  streakTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 2,
  },
  streakSub: {
    fontSize: 13,
    color: '#B45309',
    fontWeight: '500',
  },

  /* ── Content ── */
  contentContainer: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: LingoTheme.spacing[3],
  },
  sectionTitle: {
    fontSize: LingoTheme.typography.sizes.lg,
    fontWeight: LingoTheme.typography.weights.extrabold,
    color: LingoTheme.colors.ink,
  },
  seeAllText: {
    fontSize: LingoTheme.typography.sizes.sm,
    color: LingoTheme.colors.primaryDark,
    fontWeight: LingoTheme.typography.weights.extrabold,
  },

  /* Progress Card */
  progressCard: {
    backgroundColor: LingoTheme.colors.surface,
    borderRadius: LingoTheme.radius.lg,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    padding: LingoTheme.spacing[5],
    marginBottom: LingoTheme.spacing[5],
    ...LingoTheme.shadow.card,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },

  /* Next Class Card */
  nextClassCard: {
    marginBottom: LingoTheme.spacing[5],
    borderRadius: LingoTheme.radius.lg,
    overflow: 'hidden',
    ...LingoTheme.shadow.card,
  },
  nextClassGradient: {
    padding: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  nextClassTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: LingoTheme.spacing[4],
    gap: LingoTheme.spacing[3],
  },
  nextClassIconWrap: {
    width: 44,
    height: 44,
    borderRadius: LingoTheme.radius.md, // 18
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextClassName: {
    fontSize: LingoTheme.typography.sizes.base, // 16
    fontWeight: LingoTheme.typography.weights.bold,
    color: LingoTheme.colors.surface,
    marginBottom: 2,
  },
  nextClassTeacher: {
    fontSize: LingoTheme.typography.sizes.sm,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: LingoTheme.typography.weights.medium,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: LingoTheme.spacing[2],
    paddingVertical: LingoTheme.spacing[1],
    borderRadius: LingoTheme.radius.pill,
    gap: LingoTheme.spacing[1],
  },
  countdownText: {
    fontSize: LingoTheme.typography.sizes.sm,
    color: LingoTheme.colors.surface,
    fontWeight: LingoTheme.typography.weights.bold,
  },
  nextClassBottom: {
    flexDirection: 'row',
    gap: 20,
  },
  nextClassMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LingoTheme.spacing[1],
  },
  nextClassDateText: {
    fontSize: LingoTheme.typography.sizes.sm,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: LingoTheme.typography.weights.medium,
  },

  /* Empty State */
  emptyCard: {
    backgroundColor: LingoTheme.colors.surface,
    borderRadius: LingoTheme.radius.lg,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    padding: LingoTheme.spacing[6],
    alignItems: 'center',
    marginBottom: LingoTheme.spacing[5],
    ...LingoTheme.shadow.card,
  },
  emptyIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: LingoTheme.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: LingoTheme.spacing[3],
  },
  emptyTitle: {
    fontSize: LingoTheme.typography.sizes.base,
    fontWeight: LingoTheme.typography.weights.extrabold,
    color: LingoTheme.colors.ink,
    marginBottom: LingoTheme.spacing[1],
  },
  emptyDesc: {
    fontSize: LingoTheme.typography.sizes.sm,
    color: LingoTheme.colors.muted,
  },

  /* Quick Actions */
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LingoTheme.spacing[3],
    marginBottom: LingoTheme.spacing[5],
  },
  actionCard: {
    width: '47%',
    backgroundColor: LingoTheme.colors.surface,
    borderRadius: LingoTheme.radius.lg,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    padding: LingoTheme.spacing[4],
    alignItems: 'center',
    ...LingoTheme.shadow.card,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: LingoTheme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: LingoTheme.spacing[2],
  },
  actionLabel: {
    fontSize: LingoTheme.typography.sizes.sm,
    fontWeight: LingoTheme.typography.weights.extrabold,
    color: LingoTheme.colors.ink,
  },

  /* Recent Activity */
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LingoTheme.colors.surface,
    borderRadius: LingoTheme.radius.lg,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    padding: LingoTheme.spacing[4],
    marginBottom: LingoTheme.spacing[2],
    ...LingoTheme.shadow.card,
  },
  recentIcon: {
    width: 40,
    height: 40,
    borderRadius: LingoTheme.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: LingoTheme.spacing[3],
  },
  recentTitle: {
    fontSize: LingoTheme.typography.sizes.sm,
    fontWeight: LingoTheme.typography.weights.extrabold,
    color: LingoTheme.colors.ink,
    marginBottom: 2,
  },
  recentMeta: {
    fontSize: LingoTheme.typography.sizes.xs,
    color: LingoTheme.colors.muted,
  },
  statusBadge: {
    paddingHorizontal: LingoTheme.spacing[2],
    paddingVertical: LingoTheme.spacing[1],
    borderRadius: LingoTheme.radius.sm / 2, // 6
    marginLeft: LingoTheme.spacing[2],
  },
  statusText: {
    fontSize: LingoTheme.typography.sizes.xs,
    fontWeight: LingoTheme.typography.weights.bold,
  },
});