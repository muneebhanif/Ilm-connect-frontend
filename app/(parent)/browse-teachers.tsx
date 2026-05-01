import { StyleSheet, View, TextInput, ScrollView, TouchableOpacity, Image, Platform, RefreshControl, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { LinearGradient } from 'expo-linear-gradient';
import { LingoCard, LingoEmptyState, LingoScreenHeader } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';

interface Teacher {
  id: string;
  bio: string;
  subjects: string[];
  hourly_rate: number;
  rating: number;
  review_count?: number;
  verification_status: string;
  has_ijaazah?: boolean;
  languages: string[];
  gender: string;
  profiles: {
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

export default function BrowseTeachersScreen() {
  const router = useRouter();
  const { topPadding } = useSafePadding();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>('All');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const subjects = ['All', 'Quran Memorization', 'Tajweed', 'Arabic Language', 'Islamic Studies', 'Fiqh', 'Hadith'];

  useEffect(() => {
    fetchTeachers();
  }, [selectedSubject]);

  const fetchTeachers = async (mode: 'initial' | 'refresh' = 'initial') => {
    try {
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      let url = api.teachers();

      const params = new URLSearchParams();
      if (selectedSubject && selectedSubject !== 'All') {
        params.append('subject', selectedSubject);
      }

      if (params.toString()) {
        url += '?' + params.toString();
      }

      const response = await fetch(url);
      const data = await response.json();
      setTeachers(data.teachers || []);
    } catch (error) {
      console.error('Error fetching teachers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    fetchTeachers('refresh');
  };

  const filteredTeachers = teachers.filter(teacher => {
    if (!searchQuery) return true;

    const matchesName = teacher.profiles.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = teacher.subjects.some(s => 
      s.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return matchesName || matchesSubject;
  });

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.headerScroll}
        contentContainerStyle={{ paddingTop: topPadding }}
        horizontal={false}
        scrollEnabled={false}
      >
        <View style={styles.headerPad}>
          <LingoScreenHeader
            badge="Parent hub"
            icon="people"
            title="Find a teacher with confidence"
            subtitle="Browse verified teachers, compare strengths, and filter by subject in a friendlier flow."
          />

          {/* Mode Switch - Lingo Style */}
          <View style={styles.modeSwitch}>
            <TouchableOpacity style={[styles.modePill, styles.modePillActive]} activeOpacity={0.8}>
              <ThemedText style={[styles.modePillText, styles.modePillTextActive]}>Teachers</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.modePill} 
              onPress={() => router.push('/(parent)/browse-courses')}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.modePillText}>Courses</ThemedText>
            </TouchableOpacity>
          </View>

          <LingoCard style={styles.filterCard}>
            {/* Search - Lingo Style */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={LingoTheme.colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or subject..."
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
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.pillsContainer}
            >
              {subjects.map((subject) => (
                <TouchableOpacity
                  key={subject}
                  style={[styles.pill, selectedSubject === subject && styles.pillActive]}
                  onPress={() => setSelectedSubject(subject)}
                  activeOpacity={0.8}
                >
                  <ThemedText style={[styles.pillText, selectedSubject === subject && styles.pillTextActive]}>
                    {subject}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </LingoCard>
        </View>
      </ScrollView>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={LingoTheme.colors.primary} 
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={LingoTheme.colors.primary} />
          </View>
        ) : filteredTeachers.length === 0 ? (
          <LingoCard>
            <LingoEmptyState 
              icon="search-outline" 
              title="No teachers found" 
              subtitle="Try adjusting your search or filters to widen the results." 
              tone="teal" 
            />
          </LingoCard>
        ) : (
          filteredTeachers.map((teacher) => (
            <TouchableOpacity 
              key={teacher.id} 
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push({ 
                pathname: '/teacher-profile/[id]',
                params: { id: teacher.id }
              })}
            >
              <View style={styles.cardHeader}>
                <View style={styles.avatarContainer}>
                  {teacher.profiles.avatar_url ? (
                    <Image source={{ uri: teacher.profiles.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <LinearGradient
                      colors={[LingoTheme.colors.teal, '#2BCBBA']}
                      style={styles.avatarPlaceholder}
                    >
                      <ThemedText style={styles.avatarText}>
                        {teacher.profiles.full_name.charAt(0)}
                      </ThemedText>
                    </LinearGradient>
                  )}
                  {(['verified', 'approved'].includes(String(teacher.verification_status || '').toLowerCase())) && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark" size={10} color={LingoTheme.colors.textInverse} />
                    </View>
                  )}
                </View>

                <View style={styles.headerInfo}>
                  <View style={styles.nameRow}>
                    <ThemedText style={styles.nameText} numberOfLines={1}>
                      {teacher.profiles.full_name}
                    </ThemedText>
                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={12} color={LingoTheme.colors.warning} />
                      <ThemedText style={styles.ratingText}>
                        {teacher.rating ? teacher.rating.toFixed(1) : 'New'}
                      </ThemedText>
                      {teacher.review_count ? (
                        <ThemedText style={styles.reviewCount}>
                          ({teacher.review_count})
                        </ThemedText>
                      ) : null}
                    </View>
                  </View>

                  <ThemedText style={styles.subjectsText} numberOfLines={1}>
                    {teacher.subjects.join(' • ')}
                  </ThemedText>

                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                       <Ionicons name="language-outline" size={14} color={LingoTheme.colors.textSecondary} />
                       <ThemedText style={styles.metaText}>{teacher.languages?.[0] || 'English'}</ThemedText>
                    </View>
                    {teacher.has_ijaazah && (
                      <View style={[styles.metaItem, styles.ijaazahTag]}>
                         <Ionicons name="ribbon-outline" size={14} color={LingoTheme.colors.gold} />
                         <ThemedText style={[styles.metaText, { color: LingoTheme.colors.gold }]}>Ijaazah</ThemedText>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View>
                   <ThemedText style={styles.rateLabel}>Hourly Rate</ThemedText>
                   <ThemedText style={styles.rateValue}>${teacher.hourly_rate}</ThemedText>
                </View>

                <TouchableOpacity style={styles.bookButton} activeOpacity={0.8}>
                   <ThemedText style={styles.bookButtonText}>View Profile</ThemedText>
                   <Ionicons name="arrow-forward" size={16} color={LingoTheme.colors.teal} />
                </TouchableOpacity>
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
  headerScroll: {
    flexGrow: 0,
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
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: LingoTheme.colors.ink,
    height: '100%',
  },

  /* Pills - Lingo Style */
  pillsContainer: {
    gap: 8,
    paddingTop: 14,
    paddingBottom: 4,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: LingoTheme.radius.pill,
    backgroundColor: LingoTheme.colors.surface,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    gap: 8,
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

  /* List */
  scrollView: {
    flex: 1,
  },
  listContent: {
    padding: 20,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },

  /* Card - Lingo Style */
  card: {
    backgroundColor: LingoTheme.colors.surface,
    borderRadius: LingoTheme.radius.lg,
    padding: 16,
    marginBottom: 16,
    ...LingoTheme.shadow.card,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  avatarContainer: {
    marginRight: 16,
    position: 'relative',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: LingoTheme.colors.textInverse,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: LingoTheme.colors.success,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: LingoTheme.colors.surface,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '700',
    color: LingoTheme.colors.text,
    flex: 1,
    marginRight: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LingoTheme.colors.softGold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: LingoTheme.colors.gold,
  },
  reviewCount: {
    fontSize: 11,
    fontWeight: '600',
    color: LingoTheme.colors.textTertiary,
  },
  subjectsText: {
    fontSize: 13,
    color: LingoTheme.colors.textSecondary,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ijaazahTag: {
    backgroundColor: LingoTheme.colors.softGold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metaText: {
    fontSize: 12,
    color: LingoTheme.colors.textSecondary,
    fontWeight: '500',
  },

  /* Footer */
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: LingoTheme.colors.borderLight,
  },
  rateLabel: {
    fontSize: 11,
    color: LingoTheme.colors.textTertiary,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  rateValue: {
    fontSize: 18,
    fontWeight: '700',
    color: LingoTheme.colors.text,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: LingoTheme.radius.sm,
    backgroundColor: LingoTheme.colors.softTeal,
  },
  bookButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: LingoTheme.colors.teal,
  },
});