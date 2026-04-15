import { StyleSheet, View, ScrollView, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { BackButton } from '@/components/back-button';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/lib/config';
import { useAuth } from '@/lib/auth-context';
import { Fonts } from '@/constants/theme';
import { SkeletonScreen } from '@/components/ui/skeleton';

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  subject: string;
  level: string;
  price: number;
  is_free: boolean;
  total_lessons: number;
  status: string;
  created_at: string;
  teacher_id?: string;
  profiles?: {
    id: string;
    full_name: string;
    avatar_url?: string;
    bio?: string;
  };
}

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) fetchCourse();
  }, [id]);

  const fetchCourse = async (mode = 'initial') => {
    try {
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      setError('');

      const response = await fetch(api.courses.byId(id!));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load course');
      setCourse(data.course);
    } catch (e: any) {
      setError(e?.message || 'Failed to load course');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getLevelColor = (lvl: string) => {
    switch (lvl) {
      case 'beginner': return '#10B981';
      case 'intermediate': return '#F59E0B';
      case 'advanced': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getSubjectIcon = (subj: string): string => {
    if (subj.includes('Quran')) return 'book';
    if (subj.includes('Tajweed')) return 'mic';
    if (subj.includes('Arabic')) return 'language';
    if (subj.includes('Fiqh')) return 'library';
    if (subj.includes('Hadith')) return 'document-text';
    if (subj.includes('Seerah')) return 'people';
    return 'school';
  };

  const getGradientColors = (lvl: string): [string, string] => {
    switch (lvl) {
      case 'beginner': return ['#10B981', '#059669'];
      case 'intermediate': return ['#F59E0B', '#D97706'];
      case 'advanced': return ['#EF4444', '#DC2626'];
      default: return ['#6B7280', '#4B5563'];
    }
  };

  if (loading) return <SkeletonScreen />;

  if (error || !course) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
        <ThemedText style={styles.errorText}>{error || 'Course not found'}</ThemedText>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchCourse()}>
          <ThemedText style={styles.retryText}>Retry</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  const teacherId = course.teacher_id || course.profiles?.id;
  const isParent = user?.role === 'parent';

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchCourse('refresh')} tintColor="#4ECDC4" />
        }
      >
        {/* Header */}
        <LinearGradient
          colors={getGradientColors(course.level)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerNav}>
            <BackButton />
          </View>
          <View style={styles.headerContent}>
            <View style={styles.subjectIconWrap}>
              <Ionicons name={getSubjectIcon(course.subject) as any} size={32} color="#FFF" />
            </View>
            <ThemedText style={styles.courseTitle}>{course.title}</ThemedText>
            <View style={styles.headerMeta}>
              <View style={styles.levelChip}>
                <ThemedText style={styles.levelChipText}>
                  {course.level.charAt(0).toUpperCase() + course.level.slice(1)}
                </ThemedText>
              </View>
              <View style={styles.priceChip}>
                <ThemedText style={styles.priceChipText}>
                  {course.is_free ? 'Free' : `$${course.price}`}
                </ThemedText>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="book-outline" size={20} color="#4ECDC4" />
            <ThemedText style={styles.statValue}>{course.total_lessons}</ThemedText>
            <ThemedText style={styles.statLabel}>Lessons</ThemedText>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="school-outline" size={20} color="#F59E0B" />
            <ThemedText style={styles.statValue}>{course.subject.split(' ')[0]}</ThemedText>
            <ThemedText style={styles.statLabel}>Subject</ThemedText>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="speedometer-outline" size={20} color={getLevelColor(course.level)} />
            <ThemedText style={styles.statValue}>{course.level.charAt(0).toUpperCase() + course.level.slice(1)}</ThemedText>
            <ThemedText style={styles.statLabel}>Level</ThemedText>
          </View>
        </View>

        {/* Description */}
        {course.description ? (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>About this course</ThemedText>
            <View style={styles.descCard}>
              <ThemedText style={styles.descText}>{course.description}</ThemedText>
            </View>
          </View>
        ) : null}

        {/* Teacher Card */}
        {course.profiles && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Instructor</ThemedText>
            <TouchableOpacity
              style={styles.teacherCard}
              onPress={() => {
                if (teacherId) {
                  router.push(`/teacher-profile/${teacherId}` as any);
                }
              }}
              activeOpacity={0.7}
            >
              {course.profiles.avatar_url ? (
                <Image source={{ uri: course.profiles.avatar_url }} style={styles.teacherAvatar} />
              ) : (
                <View style={[styles.teacherAvatar, styles.avatarFallback]}>
                  <ThemedText style={styles.avatarInitial}>
                    {course.profiles.full_name?.charAt(0) || 'T'}
                  </ThemedText>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.teacherName}>{course.profiles.full_name}</ThemedText>
                {course.profiles.bio ? (
                  <ThemedText style={styles.teacherBio} numberOfLines={2}>{course.profiles.bio}</ThemedText>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        )}

        {/* What You'll Learn */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>What you'll learn</ThemedText>
          <View style={styles.learnCard}>
            <View style={styles.learnRow}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <ThemedText style={styles.learnText}>
                {course.total_lessons} structured lessons in {course.subject}
              </ThemedText>
            </View>
            <View style={styles.learnRow}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <ThemedText style={styles.learnText}>
                {course.level.charAt(0).toUpperCase() + course.level.slice(1)} level content
              </ThemedText>
            </View>
            <View style={styles.learnRow}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <ThemedText style={styles.learnText}>
                Learn at your own pace with video lessons
              </ThemedText>
            </View>
            <View style={styles.learnRow}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <ThemedText style={styles.learnText}>
                Direct access to your instructor for questions
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Action Bar */}
      {isParent && teacherId && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomPrice}>
            <ThemedText style={styles.bottomPriceLabel}>Price</ThemedText>
            <ThemedText style={styles.bottomPriceValue}>
              {course.is_free ? 'Free' : `$${course.price}`}
            </ThemedText>
          </View>
          <TouchableOpacity
            style={styles.bookButton}
            onPress={() => router.push(`/book-teacher/${teacherId}` as any)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#4ECDC4', '#45B7AA']}
              style={styles.bookGradient}
            >
              <Ionicons name="calendar-outline" size={20} color="#FFF" />
              <ThemedText style={styles.bookText}>Book This Teacher</ThemedText>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
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
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryText: {
    color: '#FFF',
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 40,
  },

  /* Header */
  header: {
    paddingTop: 50,
    paddingBottom: 32,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerNav: {
    marginBottom: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  subjectIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  courseTitle: {
    fontSize: 24,
    fontFamily: Fonts.rounded,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 14,
  },
  headerMeta: {
    flexDirection: 'row',
    gap: 10,
  },
  levelChip: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  levelChipText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  priceChip: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  priceChipText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: -16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },

  /* Section */
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },

  /* Description */
  descCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  descText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
  },

  /* Teacher */
  teacherCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  teacherAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '700',
    color: '#6B7280',
  },
  teacherName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  teacherBio: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },

  /* What You'll Learn */
  learnCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  learnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  learnText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    lineHeight: 20,
  },

  /* Bottom Bar */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  bottomPrice: {
    marginRight: 16,
  },
  bottomPriceLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  bottomPriceValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  bookButton: {
    flex: 1,
  },
  bookGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  bookText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
