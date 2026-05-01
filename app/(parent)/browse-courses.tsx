import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, TextInput, RefreshControl, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { useFocusEffect } from '@react-navigation/native';
import { LingoCard, LingoEmptyState, LingoScreenHeader } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';
import { useRouter } from 'expo-router';

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

const SUBJECTS = ['All', 'Quran Memorization', 'Tajweed', 'Arabic Language', 'Islamic Studies', 'Fiqh', 'Hadith', 'Seerah'];
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
    }, [selectedSubject, showFreeOnly])
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
    if (subj.includes('Seerah')) return 'people';
    return 'school';
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: topPadding, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={LingoTheme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.headerPad}>
        <LingoScreenHeader
          badge="Parent hub"
          icon="library"
          title="Browse courses with less guesswork"
          subtitle="Compare subjects, levels, and lesson counts in a calmer, easier-to-scan course browser."
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
          <TouchableOpacity style={[styles.modePill, styles.modePillActive]} activeOpacity={0.8}>
            <ThemedText style={[styles.modePillText, styles.modePillTextActive]}>Courses</ThemedText>
          </TouchableOpacity>
        </View>

        <LingoCard style={styles.filterCard}>
          {/* Free Toggle - Lingo Button Style */}
          <TouchableOpacity
            style={[styles.freeToggle, showFreeOnly && styles.freeToggleActive]}
            onPress={() => setShowFreeOnly(!showFreeOnly)}
            activeOpacity={0.8}
          >
            <Ionicons 
              name="pricetag" 
              size={14} 
              color={showFreeOnly ? LingoTheme.colors.textInverse : LingoTheme.colors.ink} 
            />
            <ThemedText style={[styles.freeToggleText, showFreeOnly && { color: LingoTheme.colors.textInverse }]}> 
              Free Only
            </ThemedText>
          </TouchableOpacity>

          {/* Search Bar - Lingo Style */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={LingoTheme.colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search courses or teachers..."
              placeholderTextColor={LingoTheme.colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={LingoTheme.colors.textTertiary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Subject Pills - Lingo Style */}
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

          {/* Level Pills - Lingo Style */}
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
        </LingoCard>
      </View>

      {/* Course List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => fetchCourses('refresh')} 
            tintColor={LingoTheme.colors.primary} 
          />
        }
      >
        {filteredCourses.length === 0 ? (
          <LingoCard>
            <LingoEmptyState 
              icon="library-outline" 
              title="No courses found" 
              subtitle="Try adjusting your filters or search to widen the results." 
              tone="gold" 
            />
          </LingoCard>
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
                    size={24}
                    color={getLevelColor(course.level)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.courseTitle} numberOfLines={2}>{course.title}</ThemedText>
                  <View style={styles.teacherRow}>
                    <Ionicons name="person-circle" size={16} color={LingoTheme.colors.textSecondary} />
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
                  <Ionicons name="book-outline" size={14} color={LingoTheme.colors.textTertiary} />
                  <ThemedText style={styles.lessonsText}>{course.total_lessons} lessons</ThemedText>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LingoTheme.colors.background,
  },

  headerPad: {
    paddingHorizontal: 16,
  },

  /* Mode Switch - Lingo Style */
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: LingoTheme.colors.surface,
    borderRadius: LingoTheme.radius.md,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    padding: 4,
    marginBottom: 14,
    ...LingoTheme.shadow.card,
  },
  modePill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: LingoTheme.radius.sm,
    paddingVertical: 10,
  },
  modePillActive: {
    backgroundColor: LingoTheme.colors.ink,
  },
  modePillText: {
    fontSize: 14,
    fontWeight: '800',
    color: LingoTheme.colors.muted,
  },
  modePillTextActive: {
    color: LingoTheme.colors.textInverse,
  },

  /* Filter Card */
  filterCard: {
    marginBottom: 14,
  },

  /* Free Toggle - Lingo Button Style */
  freeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: LingoTheme.colors.surface,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: LingoTheme.radius.pill,
    gap: 6,
  },
  freeToggleActive: {
    backgroundColor: LingoTheme.colors.primary,
    borderColor: LingoTheme.colors.primary,
  },
  freeToggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
  },

  /* Search - Lingo Style */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LingoTheme.colors.surface,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: LingoTheme.radius.md,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    marginTop: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: LingoTheme.colors.ink,
    height: '100%',
  },

  /* Subject Pills - Lingo Style */
  pillsContainer: {
    paddingTop: 14,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: LingoTheme.radius.pill,
    backgroundColor: LingoTheme.colors.surface,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
  },
  pillActive: {
    backgroundColor: LingoTheme.colors.primary,
    borderColor: LingoTheme.colors.primary,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    color: LingoTheme.colors.ink,
  },
  pillTextActive: {
    color: LingoTheme.colors.textInverse,
  },

  /* Level Pills - Lingo Style */
  levelPills: {
    paddingTop: 12,
    gap: 8,
  },
  levelPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: LingoTheme.radius.md,
    backgroundColor: LingoTheme.colors.surface,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
  },
  levelPillActive: {
    backgroundColor: LingoTheme.colors.softTeal,
    borderColor: LingoTheme.colors.teal,
  },
  levelPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: LingoTheme.colors.ink,
  },
  levelPillTextActive: {
    color: LingoTheme.colors.teal,
  },

  /* List */
  scrollView: {
    flex: 1,
  },
  listContent: {
    padding: 20,
  },

  /* Course Card - Lingo Style */
  courseCard: {
    backgroundColor: LingoTheme.colors.surface,
    borderRadius: LingoTheme.radius.lg,
    padding: 18,
    marginBottom: 14,
    ...LingoTheme.shadow.card,
  },
  courseTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 12,
  },
  courseIconWrap: {
    width: 48,
    height: 48,
    borderRadius: LingoTheme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: LingoTheme.colors.text,
    marginBottom: 4,
  },
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  teacherName: {
    fontSize: 13,
    color: LingoTheme.colors.textSecondary,
    fontWeight: '500',
  },
  priceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: LingoTheme.radius.sm,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
  },
  courseDesc: {
    fontSize: 13,
    color: LingoTheme.colors.textSecondary,
    lineHeight: 19,
    marginBottom: 14,
  },
  courseFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: LingoTheme.radius.sm,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subjectBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: LingoTheme.radius.sm,
  },
  subjectText: {
    fontSize: 11,
    fontWeight: '600',
  },
  lessonsMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  lessonsText: {
    fontSize: 12,
    color: LingoTheme.colors.textTertiary,
  },
});