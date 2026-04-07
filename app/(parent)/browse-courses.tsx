import { StyleSheet, View, ScrollView, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { BrowseCoursesSkeleton } from '@/components/ui/dashboard-skeletons';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Fonts } from '@/constants/theme';

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

  if (loading) {
    return <BrowseCoursesSkeleton />;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <ThemedText style={styles.headerTitle}>Browse Courses</ThemedText>
          <TouchableOpacity
            style={[styles.freeToggle, showFreeOnly && styles.freeToggleActive]}
            onPress={() => setShowFreeOnly(!showFreeOnly)}
          >
            <Ionicons name="pricetag" size={14} color={showFreeOnly ? '#FFF' : '#6B7280'} />
            <ThemedText style={[styles.freeToggleText, showFreeOnly && { color: '#FFF' }]}>
              Free Only
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search courses or teachers..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Subject Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContainer}>
          {SUBJECTS.map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.pill, selectedSubject === s && styles.pillActive]}
              onPress={() => setSelectedSubject(s)}
            >
              <ThemedText style={[styles.pillText, selectedSubject === s && styles.pillTextActive]}>{s}</ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Level Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levelPills}>
          {LEVELS.map(l => (
            <TouchableOpacity
              key={l}
              style={[styles.levelPill, selectedLevel === l && styles.levelPillActive]}
              onPress={() => setSelectedLevel(l)}
            >
              <ThemedText style={[styles.levelPillText, selectedLevel === l && styles.levelPillTextActive]}>
                {l === 'All' ? 'All Levels' : l.charAt(0).toUpperCase() + l.slice(1)}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Course List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchCourses('refresh')} tintColor="#4ECDC4" />
        }
      >
        {filteredCourses.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="library-outline" size={40} color="#D1D5DB" />
            </View>
            <ThemedText style={styles.emptyTitle}>No courses found</ThemedText>
            <ThemedText style={styles.emptyDesc}>Try adjusting your filters or search</ThemedText>
          </View>
        ) : (
          filteredCourses.map(course => (
            <View key={course.id} style={styles.courseCard}>
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
                    <Ionicons name="person-circle" size={16} color="#6B7280" />
                    <ThemedText style={styles.teacherName}>
                      {course.profiles?.full_name || 'Teacher'}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.priceBadge}>
                  <ThemedText style={styles.priceText}>
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
                <View style={styles.subjectBadge}>
                  <ThemedText style={styles.subjectText}>{course.subject}</ThemedText>
                </View>
                <View style={styles.lessonsMeta}>
                  <Ionicons name="book-outline" size={14} color="#6B7280" />
                  <ThemedText style={styles.lessonsText}>{course.total_lessons} lessons</ThemedText>
                </View>
              </View>
            </View>
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
    backgroundColor: '#F9FAFB',
  },

  /* Header */
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: Fonts.rounded,
    fontWeight: '700',
    color: '#111827',
  },
  freeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  freeToggleActive: {
    backgroundColor: '#4ECDC4',
  },
  freeToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },

  /* Search */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 14,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#111827',
    height: '100%',
  },

  /* Subject Pills */
  pillsContainer: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  pillActive: {
    backgroundColor: '#111827',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  pillTextActive: {
    color: '#FFF',
  },

  /* Level Pills */
  levelPills: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 4,
  },
  levelPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  levelPillActive: {
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4',
  },
  levelPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  levelPillTextActive: {
    color: '#FFF',
  },

  /* List */
  scrollView: {
    flex: 1,
  },
  listContent: {
    padding: 20,
  },

  /* Course Card */
  courseCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
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
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  teacherName: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  priceBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  courseDesc: {
    fontSize: 13,
    color: '#6B7280',
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
    borderRadius: 8,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subjectBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  subjectText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  lessonsMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  lessonsText: {
    fontSize: 12,
    color: '#6B7280',
  },

  /* States */
  loadingState: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
