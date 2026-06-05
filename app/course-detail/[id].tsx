import { StyleSheet, View, ScrollView, TouchableOpacity, Image, RefreshControl, Linking } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { useAuth } from '@/lib/auth-context';
import { LingoBadge, LingoButton, LingoCard, LingoEmptyState, LingoScreenHeader } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { SkeletonScreen } from '@/components/ui/skeleton';
import { useSafePadding } from '@/hooks/use-safe-padding';

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
  preview_lessons?: CoursePreviewLesson[];
}

interface CoursePreviewLesson {
  id: string;
  title: string;
  description?: string;
  content_type?: string;
  content_url?: string | null;
  duration_seconds?: number | null;
  is_preview?: boolean;
  sort_order?: number | null;
}

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { topPadding, bottomPadding } = useSafePadding();
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

  const getSubjectIcon = (subj: string): string => {
    if (subj.includes('Quran')) return 'book';
    if (subj.includes('Tajweed')) return 'mic';
    if (subj.includes('Arabic')) return 'language';
    if (subj.includes('Fiqh')) return 'library';
    if (subj.includes('Hadith')) return 'document-text';
    if (subj.includes('Seerah')) return 'people';
    return 'school';
  };

  const getLevelTone = (lvl: string): 'primary' | 'gold' | 'danger' => {
    switch (lvl) {
      case 'beginner': return 'primary';
      case 'intermediate': return 'gold';
      case 'advanced': return 'danger';
      default: return 'gold';
    }
  };

  if (loading) return <SkeletonScreen />;

  if (error || !course) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={[styles.screenPadding, { paddingTop: topPadding, paddingBottom: bottomPadding }]}> 
          <LingoCard>
            <LingoEmptyState
              icon="alert-circle-outline"
              title="Course not found"
              subtitle={error || 'This course could not be loaded right now. Please try again.'}
              tone="danger"
            />
            <LingoButton label="Try again" onPress={() => fetchCourse()} icon="refresh-outline" style={styles.retryButton} />
          </LingoCard>
        </View>
      </View>
    );
  }

  const teacherId = course.teacher_id || course.profiles?.id;
  const isParent = user?.role === 'parent';
  const previewLessons = Array.isArray(course.preview_lessons) ? course.preview_lessons : [];
  const bookingPath = teacherId
    ? `/book-teacher/${teacherId}?courseId=${encodeURIComponent(course.id)}&subject=${encodeURIComponent(course.subject || '')}&courseTitle=${encodeURIComponent(course.title || '')}`
    : '';

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding, paddingBottom: (isParent && teacherId ? 144 : 40) + bottomPadding }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchCourse('refresh')} tintColor={LingoTheme.colors.primary} />
        }
      >
        <View style={styles.screenPadding}>
          <LingoScreenHeader
            title={course.title}
            subtitle={`${course.subject} • ${course.total_lessons} lesson${course.total_lessons === 1 ? '' : 's'} to explore`}
            badge={course.is_free ? 'Free course' : 'Premium course'}
            icon={getSubjectIcon(course.subject) as any}
            onBack={() => router.back()}
          >
            <View style={styles.headerMetaRow}>
              <LingoBadge
                label={course.level.charAt(0).toUpperCase() + course.level.slice(1)}
                icon="speedometer-outline"
                tone={getLevelTone(course.level)}
              />
              <LingoBadge
                label={course.is_free ? 'No cost' : `$${course.price}`}
                icon="wallet-outline"
                tone={course.is_free ? 'teal' : 'purple'}
              />
            </View>
            <View style={styles.headerStats}>
              <View style={styles.metaPill}>
                <View style={styles.metaIcon}>
                  <Ionicons name="library-outline" size={18} color={LingoTheme.colors.primaryDark} />
                </View>
                <View>
                  <ThemedText style={styles.metaValue}>{String(course.total_lessons)}</ThemedText>
                  <ThemedText style={styles.metaLabel}>Lessons</ThemedText>
                </View>
              </View>
              <View style={styles.metaPill}>
                <View style={[styles.metaIcon, { backgroundColor: LingoTheme.colors.softTeal }]}>
                  <Ionicons name={getSubjectIcon(course.subject) as any} size={18} color={LingoTheme.colors.teal} />
                </View>
                <View>
                  <ThemedText style={styles.metaValue} numberOfLines={1}>{course.subject.split(' ')[0]}</ThemedText>
                  <ThemedText style={styles.metaLabel}>Subject</ThemedText>
                </View>
              </View>
            </View>
          </LingoScreenHeader>

        {course.description ? (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>About this course</ThemedText>
            <LingoCard>
              <ThemedText style={styles.descText}>{course.description}</ThemedText>
            </LingoCard>
          </View>
        ) : null}

        {course.profiles && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Instructor</ThemedText>
            <LingoCard>
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
                <View style={styles.teacherBody}>
                  <ThemedText style={styles.teacherName}>{course.profiles.full_name}</ThemedText>
                  {course.profiles.bio ? (
                    <ThemedText style={styles.teacherBio} numberOfLines={2}>{course.profiles.bio}</ThemedText>
                  ) : (
                    <ThemedText style={styles.teacherBio}>Tap to view the instructor profile and teaching background.</ThemedText>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={LingoTheme.colors.muted} />
              </TouchableOpacity>
            </LingoCard>
          </View>
        )}

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Preview lessons</ThemedText>
          <LingoCard style={styles.previewCard}>
            {previewLessons.length === 0 ? (
              <ThemedText style={styles.previewEmpty}>Preview lessons will appear after the instructor marks lessons as preview.</ThemedText>
            ) : (
              previewLessons.map((lesson, index) => (
                <View key={lesson.id} style={[styles.previewRow, index > 0 && styles.previewRowBorder]}>
                  <View style={[styles.previewIcon, lesson.is_preview && styles.previewIconOpen]}>
                    <Ionicons name={lesson.is_preview ? 'play' : 'lock-closed'} size={16} color={lesson.is_preview ? '#FFFFFF' : LingoTheme.colors.muted} />
                  </View>
                  <View style={styles.previewBody}>
                    <ThemedText style={styles.previewTitle} numberOfLines={1}>{lesson.title || `Lesson ${index + 1}`}</ThemedText>
                    {lesson.description ? (
                      <ThemedText style={styles.previewDesc} numberOfLines={2}>{lesson.description}</ThemedText>
                    ) : null}
                    {lesson.duration_seconds ? (
                      <ThemedText style={styles.previewMeta}>{Math.max(1, Math.round(lesson.duration_seconds / 60))} min</ThemedText>
                    ) : null}
                  </View>
                  {lesson.is_preview && lesson.content_url ? (
                    <TouchableOpacity style={styles.previewButton} onPress={() => Linking.openURL(lesson.content_url!)} activeOpacity={0.85}>
                      <ThemedText style={styles.previewButtonText}>Preview</ThemedText>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.lockedBadge}>
                      <ThemedText style={styles.lockedBadgeText}>Locked</ThemedText>
                    </View>
                  )}
                </View>
              ))
            )}
          </LingoCard>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>What you will learn</ThemedText>
          <LingoCard style={styles.learnCard}>
            <View style={styles.learnRow}>
              <Ionicons name="checkmark-circle" size={18} color={LingoTheme.colors.primary} />
              <ThemedText style={styles.learnText}>
                {course.total_lessons} structured lessons in {course.subject}
              </ThemedText>
            </View>
            <View style={styles.learnRow}>
              <Ionicons name="checkmark-circle" size={18} color={LingoTheme.colors.primary} />
              <ThemedText style={styles.learnText}>
                {course.level.charAt(0).toUpperCase() + course.level.slice(1)} level content
              </ThemedText>
            </View>
            <View style={styles.learnRow}>
              <Ionicons name="checkmark-circle" size={18} color={LingoTheme.colors.primary} />
              <ThemedText style={styles.learnText}>
                Learn at your own pace with video lessons
              </ThemedText>
            </View>
            <View style={styles.learnRow}>
              <Ionicons name="checkmark-circle" size={18} color={LingoTheme.colors.primary} />
              <ThemedText style={styles.learnText}>
                Direct access to your instructor for questions
              </ThemedText>
            </View>
          </LingoCard>
        </View>

        </View>
      </ScrollView>

      {isParent && teacherId && (
        <View style={[styles.bottomBar, { paddingBottom: bottomPadding + 12 }]}> 
          <View style={styles.bottomPrice}>
            <ThemedText style={styles.bottomPriceLabel}>Price</ThemedText>
            <ThemedText style={styles.bottomPriceValue}>
              {course.is_free ? 'Free' : `$${course.price}`}
            </ThemedText>
          </View>
          <LingoButton
            label="Enroll in Course"
            icon="school-outline"
            onPress={() => router.push(bookingPath as any)}
            style={styles.bookButton}
          />
        </View>
      )}
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
    paddingHorizontal: 20,
  },
  screenPadding: {
    paddingHorizontal: 20,
  },
  retryButton: {
    marginTop: 20,
  },
  scrollContent: {
    gap: 20,
  },
  headerMetaRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  headerStats: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  metaPill: {
    minWidth: 126,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: LingoTheme.colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metaIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LingoTheme.colors.softPrimary,
  },
  metaValue: {
    maxWidth: 78,
    fontSize: 16,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: LingoTheme.colors.muted,
    textTransform: 'uppercase',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    paddingHorizontal: 4,
  },
  descText: {
    fontSize: 15,
    color: LingoTheme.colors.ink,
    lineHeight: 24,
  },
  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  teacherBody: {
    flex: 1,
    gap: 4,
  },
  teacherAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    backgroundColor: LingoTheme.colors.softTeal,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '800',
    color: LingoTheme.colors.teal,
  },
  teacherName: {
    fontSize: 16,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
  },
  teacherBio: {
    fontSize: 13,
    color: LingoTheme.colors.muted,
    lineHeight: 18,
  },
  learnCard: {
    gap: 14,
  },
  previewCard: {
    paddingVertical: 6,
  },
  previewEmpty: {
    fontSize: 14,
    lineHeight: 20,
    color: LingoTheme.colors.muted,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  previewRowBorder: {
    borderTopWidth: 1,
    borderTopColor: LingoTheme.colors.border,
  },
  previewIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LingoTheme.colors.surfaceAlt,
  },
  previewIconOpen: {
    backgroundColor: LingoTheme.colors.primary,
  },
  previewBody: {
    flex: 1,
    minWidth: 0,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
  },
  previewDesc: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: LingoTheme.colors.muted,
  },
  previewMeta: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: LingoTheme.colors.teal,
  },
  previewButton: {
    borderRadius: 14,
    backgroundColor: LingoTheme.colors.softPrimary,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  previewButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: LingoTheme.colors.primaryDark,
  },
  lockedBadge: {
    borderRadius: 14,
    backgroundColor: LingoTheme.colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  lockedBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: LingoTheme.colors.muted,
  },
  learnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  learnText: {
    fontSize: 14,
    color: LingoTheme.colors.ink,
    flex: 1,
    lineHeight: 20,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: LingoTheme.colors.border,
    gap: 16,
  },
  bottomPrice: {
    minWidth: 84,
  },
  bottomPriceLabel: {
    fontSize: 12,
    color: LingoTheme.colors.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bottomPriceValue: {
    fontSize: 22,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
  },
  bookButton: {
    flex: 1,
  },
});
