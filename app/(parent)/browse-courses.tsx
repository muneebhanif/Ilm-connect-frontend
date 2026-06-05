import { useState, useCallback } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, TextInput, RefreshControl, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { useFocusEffect } from '@react-navigation/native';
import { LingoEmptyState, LingoScreenHeader } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';
import { useRouter } from 'expo-router';
import { BrowseCoursesSkeleton } from '@/components/ui/dashboard-skeletons';

interface Course {
  id: string;
  title: string;
  description: string;
  subject: string;
  level: string;
  price: number;
  is_free: boolean;
  total_lessons: number;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url?: string;
  };
}

const SUBJECTS = ['All', 'Quran Memorization', 'Tajweed', 'Arabic', 'Islamic Studies', 'Fiqh', 'Hadith'];
const LEVELS = ['All', 'beginner', 'intermediate', 'advanced'];

export default function BrowseCoursesScreen() {
  const router = useRouter();
  const { topPadding } = useSafePadding();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [showFreeOnly, setShowFreeOnly] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchCourses();
    }, [selectedSubject, showFreeOnly, selectedLevel])
  );

  const fetchCourses = async (mode = 'initial') => {
    try {
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);

      let url = api.courses.browse();
      const params = new URLSearchParams();
      if (selectedSubject !== 'All') params.append('subject', selectedSubject);
      if (showFreeOnly) params.append('is_free', 'true');
      if (params.toString()) url += '?' + params.toString();

      const response = await fetch(url);
      const data = await response.json();
      setCourses(data.courses || []);
    } catch (e) {
      console.error('Fetch courses error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredCourses = courses.filter(course => {
    let matches = true;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      matches = course.title.toLowerCase().includes(q) ||
        (course.description || '').toLowerCase().includes(q) ||
        (course.profiles?.full_name || '').toLowerCase().includes(q);
    }
    if (selectedLevel !== 'All') {
      matches = matches && course.level === selectedLevel;
    }
    return matches;
  });

  const getLevelColor = (lvl: string) => {
    switch (lvl) {
      case 'beginner': return LingoTheme.colors.success;
      case 'intermediate': return LingoTheme.colors.warning;
      case 'advanced': return LingoTheme.colors.danger;
      default: return LingoTheme.colors.muted;
    }
  };

  const getSubjectIcon = (subj: string): string => {
    if (subj.includes('Quran')) return 'book';
    if (subj.includes('Tajweed')) return 'mic';
    if (subj.includes('Arabic')) return 'language';
    if (subj.includes('Fiqh')) return 'library';
    if (subj.includes('Hadith')) return 'document-text';
    return 'school';
  };

  if (loading) {
    return <BrowseCoursesSkeleton />;
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => fetchCourses('refresh')} 
            tintColor={LingoTheme.colors.primary} 
          />
        }
      >
        <View style={styles.headerPad}>
          {/* Removed Parent Hub badge and updated copy for Islamic Education */}
          <LingoScreenHeader
            icon="library"
            title="Find a course with confidence"
            subtitle="Browse verified Islamic courses, compare levels, and filter by subject in a friendlier flow."
          />

          {/* Mode Switch - Lingo Style */}
          <View style={styles.modeSwitch}>
            <TouchableOpacity 
              style={styles.modePill} 
              onPress={() => router.push('/(parent)/browse-teachers')}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.modePillText}>Teachers</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modePill, styles.modePillActive]} activeOpacity={1}>
              <ThemedText style={[styles.modePillText, styles.modePillTextActive]}>Courses</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Main Filter Card - Matches the reference image */}
          <View style={styles.filterCard}>
            {/* Search Bar */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={22} color="#AFAFAF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or subject..."
                placeholderTextColor="#AFAFAF"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#AFAFAF" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Subject Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContainer}>
              {SUBJECTS.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.pill, selectedSubject === s && styles.pillActive]}
                  onPress={() => setSelectedSubject(s)}
                  activeOpacity={0.8}
                >
                  <ThemedText style={[styles.pillText, selectedSubject === s && styles.pillTextActive]}>{s}</ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.secondaryFiltersRow}>
              {/* Level Pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levelPills}>
                {LEVELS.map(l => (
                  <TouchableOpacity
                    key={l}
                    style={[styles.levelPill, selectedLevel === l && styles.levelPillActive]}
                    onPress={() => setSelectedLevel(l)}
                    activeOpacity={0.8}
                  >
                    <ThemedText style={[styles.levelPillText, selectedLevel === l && styles.levelPillTextActive]}>
                      {l === 'All' ? 'All Levels' : l.charAt(0).toUpperCase() + l.slice(1)}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Free Toggle */}
              <TouchableOpacity
                style={[styles.freeToggle, showFreeOnly && styles.freeToggleActive]}
                onPress={() => setShowFreeOnly(!showFreeOnly)}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name="pricetag" 
                  size={14} 
                  color={showFreeOnly ? '#FFFFFF' : '#777777'} 
                />
                <ThemedText style={[styles.freeToggleText, showFreeOnly && { color: '#FFFFFF' }]}> 
                  Free
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Course List */}
        <View style={styles.listContent}>
          {filteredCourses.length === 0 ? (
            <View style={styles.emptyCard}>
              <LingoEmptyState 
                icon="library-outline" 
                title="No courses found" 
                subtitle="Try adjusting your filters or search to widen the results." 
                tone="gold" 
              />
            </View>
          ) : (
            filteredCourses.map(course => (
              <TouchableOpacity
                key={course.id}
                style={styles.courseCard}
                onPress={() => router.push(`/course-detail/${course.id}` as any)}
                activeOpacity={0.85}
              >
                {/* Course Header */}
                <View style={styles.courseTop}>
                  <View style={[styles.courseIconWrap, { backgroundColor: `${getLevelColor(course.level)}15` }]}>
                    <Ionicons
                      name={getSubjectIcon(course.subject) as any}
                      size={28}
                      color={getLevelColor(course.level)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.courseTitle} numberOfLines={2}>{course.title}</ThemedText>
                    <View style={styles.teacherRow}>
                      <Ionicons name="person-circle" size={16} color="#777777" />
                      <ThemedText style={styles.teacherName}>
                        {course.profiles?.full_name || 'Teacher'}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={[
                    styles.priceBadge, 
                    { backgroundColor: course.is_free ? LingoTheme.colors.softPrimary : LingoTheme.colors.softGold }
                  ]}>
                    <ThemedText style={[
                      styles.priceText, 
                      { color: course.is_free ? LingoTheme.colors.primary : LingoTheme.colors.gold }
                    ]}>
                      {course.is_free ? 'Free' : `$${course.price}`}
                    </ThemedText>
                  </View>
                </View>

                {/* Description */}
                {course.description ? (
                  <ThemedText style={styles.courseDesc} numberOfLines={2}>{course.description}</ThemedText>
                ) : null}

                {/* Footer */}
                <View style={styles.courseFooter}>
                  <View style={[styles.levelBadge, { backgroundColor: `${getLevelColor(course.level)}15` }]}>
                    <ThemedText style={[styles.levelText, { color: getLevelColor(course.level) }]}>
                      {course.level.charAt(0).toUpperCase() + course.level.slice(1)}
                    </ThemedText>
                  </View>
                  <View style={[styles.subjectBadge, { backgroundColor: LingoTheme.colors.softTeal }]}>
                    <ThemedText style={[styles.subjectText, { color: LingoTheme.colors.teal }]}>
                      {course.subject}
                    </ThemedText>
                  </View>
                  <View style={styles.lessonsMeta}>
                    <Ionicons name="book" size={14} color="#AFAFAF" />
                    <ThemedText style={styles.lessonsText}>{course.total_lessons} lessons</ThemedText>
                  </View>
                </View>
                <View style={styles.courseActions}>
                  <View style={styles.detailHint}>
                    <ThemedText style={styles.detailHintText}>View details</ThemedText>
                  </View>
                  <View style={styles.enrollPill}>
                    <ThemedText style={styles.enrollPillText}>Enroll in Course</ThemedText>
                    <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7', // Lingo app background color
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Platform.OS === 'ios' ? 120 : 100, // Make sure we can scroll past bottom tab bar
  },
  headerPad: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },

  /* Mode Switch - Matches Image Perfectly */
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4, // 3D tactile border
    padding: 4,
    marginBottom: 16,
  },
  modePill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    paddingVertical: 14,
  },
  modePillActive: {
    backgroundColor: '#1E293B', // Dark ink color from image
  },
  modePillText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#777777',
  },
  modePillTextActive: {
    color: '#FFFFFF',
  },

  /* Filter Card - 3D tactile layout from image */
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4, // 3D tactile border
    padding: 16,
    marginBottom: 20,
  },

  /* Search Bar */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    height: 52,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E5E5',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '500',
    color: '#3C3C3C',
    height: '100%',
  },

  /* Primary Pills (Subjects) */
  pillsContainer: {
    paddingTop: 16,
    paddingBottom: 4,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E5E5',
  },
  pillActive: {
    backgroundColor: LingoTheme.colors.primary, // #58cc02
    borderColor: LingoTheme.colors.primary,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#3C3C3C',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },

  /* Secondary Filters Row */
  secondaryFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },

  /* Level Pills */
  levelPills: {
    gap: 8,
    paddingRight: 16,
  },
  levelPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E5E5',
  },
  levelPillActive: {
    backgroundColor: '#E5F6FF', // Soft blue
    borderColor: '#3B82F6',
  },
  levelPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#777777',
  },
  levelPillTextActive: {
    color: '#3B82F6',
  },

  /* Free Toggle */
  freeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  freeToggleActive: {
    backgroundColor: LingoTheme.colors.primary,
    borderColor: LingoTheme.colors.primary,
  },
  freeToggleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#777777',
  },

  /* List Styling */
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    padding: 24,
  },

  /* Course Card - Tactile Lingo Style */
  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4, // Essential tactile shadow
    padding: 20,
    marginBottom: 16,
  },
  courseTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 12,
  },
  courseIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#3C3C3C',
    marginBottom: 4,
  },
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  teacherName: {
    fontSize: 14,
    color: '#777777',
    fontWeight: '600',
  },
  priceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '800',
  },
  courseDesc: {
    fontSize: 14,
    color: '#777777',
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 16,
  },
  courseFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  levelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '800',
  },
  subjectBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  subjectText: {
    fontSize: 12,
    fontWeight: '800',
  },
  lessonsMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  lessonsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#AFAFAF',
  },
  courseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 14,
  },
  detailHint: {
    minHeight: 42,
    justifyContent: 'center',
  },
  detailHintText: {
    fontSize: 14,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
  },
  enrollPill: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: LingoTheme.colors.primary,
    borderBottomWidth: 3,
    borderBottomColor: LingoTheme.colors.primaryDark,
  },
  enrollPillText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
