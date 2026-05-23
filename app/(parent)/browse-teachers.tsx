import { StyleSheet, View, TextInput, ScrollView, TouchableOpacity, Image, Platform, RefreshControl } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { LinearGradient } from 'expo-linear-gradient';
import { LingoEmptyState, LingoScreenHeader } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';
import { SkeletonScreen } from '@/components/ui/skeleton';

interface Teacher {
  id: string;
  bio: string;
  subjects?: string[] | null;
  hourly_rate?: number | null;
  rating?: number | null;
  review_count?: number;
  verification_status?: string | null;
  has_ijaazah?: boolean;
  languages?: string[] | null;
  experience_years?: number | null;
  years_experience?: number | null;
  gender: string;
  profiles: {
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

export default function BrowseTeachersScreen() {
  const router = useRouter();
  const { topPadding, bottomPadding } = useSafePadding();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>('All');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const subjects = ['All', 'Quran Memorization', 'Tajweed', 'Arabic', 'Islamic Studies', 'Fiqh', 'Hadith'];

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

  if (loading) {
    return <SkeletonScreen />;
  }

  const onRefresh = () => {
    fetchTeachers('refresh');
  };

  const filteredTeachers = teachers.filter(teacher => {
    if (!searchQuery) return true;

    const subjects = Array.isArray(teacher.subjects) ? teacher.subjects : [];
    const matchesName = (teacher.profiles?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = subjects.some(s =>
      s.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return matchesName || matchesSubject;
  });

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + (Platform.OS === 'ios' ? 120 : 104) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={LingoTheme.colors.primary} 
          />
        }
      >
        <View style={styles.headerPad}>
          {/* Removed Parent Hub badge to match Islamic Education theme */}
          <LingoScreenHeader
            icon="people"
            title="Find a teacher with confidence"
            subtitle="Browse verified teachers, compare strengths, and filter by subject in a friendlier flow."
          />

          {/* Mode Switch - Tactile Lingo Style */}
          <View style={styles.modeSwitch}>
            <TouchableOpacity style={[styles.modePill, styles.modePillActive]} activeOpacity={1}>
              <Ionicons name="person" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <ThemedText style={[styles.modePillText, styles.modePillTextActive]}>Teachers</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.modePill} 
              onPress={() => router.push('/(parent)/browse-courses')}
              activeOpacity={0.8}
            >
              <Ionicons name="book" size={18} color="#777777" style={{ marginRight: 6 }} />
              <ThemedText style={styles.modePillText}>Courses</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Main Filter Card */}
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
          </View>
        </View>

        {/* Teacher List */}
        <View style={styles.listContent}>
          {filteredTeachers.length === 0 ? (
            <View style={styles.emptyCard}>
              <LingoEmptyState 
                icon="search-outline" 
                title="No teachers found" 
                subtitle="Try adjusting your search or filters to widen the results." 
                tone="teal" 
              />
            </View>
          ) : (
            filteredTeachers.map((teacher) => {
              const name = teacher.profiles?.full_name || 'Teacher';
              const subjects = Array.isArray(teacher.subjects) ? teacher.subjects.filter(Boolean) : [];
              const languages = Array.isArray(teacher.languages) ? teacher.languages.filter(Boolean) : [];
              const verificationStatus = String(teacher.verification_status || '').toLowerCase();
              const isVerified = ['verified', 'approved'].includes(verificationStatus);
              const rating = Number(teacher.rating);
              const hasRating = Number.isFinite(rating) && rating > 0;
              const reviewCount = Number(teacher.review_count || 0);
              const hourlyRate = Number(teacher.hourly_rate);
              const hasHourlyRate = Number.isFinite(hourlyRate) && hourlyRate > 0;
              const experienceYears = Number(teacher.experience_years ?? teacher.years_experience);
              const hasExperience = Number.isFinite(experienceYears) && experienceYears > 0;
              const hasFooter = hasHourlyRate || reviewCount > 0 || teacher.has_ijaazah || hasExperience;

              return (
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
                      {teacher.profiles?.avatar_url ? (
                        <Image source={{ uri: teacher.profiles.avatar_url }} style={styles.avatarImage} />
                      ) : (
                        <LinearGradient
                          colors={[LingoTheme.colors.teal, '#2BCBBA']}
                          style={styles.avatarPlaceholder}
                        >
                          <ThemedText style={styles.avatarText}>
                            {name.charAt(0)}
                          </ThemedText>
                        </LinearGradient>
                      )}
                      {isVerified && (
                        <View style={styles.verifiedBadge}>
                          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                        </View>
                      )}
                    </View>

                    <View style={styles.headerInfo}>
                      <View style={styles.nameRow}>
                        <ThemedText style={styles.nameText} numberOfLines={1}>
                          {name}
                        </ThemedText>
                        {hasRating && (
                          <View style={styles.ratingBadge}>
                            <Ionicons name="star" size={14} color="#FFC800" />
                            <ThemedText style={styles.ratingText}>
                              {rating.toFixed(1)}
                            </ThemedText>
                            {reviewCount > 0 ? (
                              <ThemedText style={styles.reviewCount}>
                                ({reviewCount})
                              </ThemedText>
                            ) : null}
                          </View>
                        )}
                      </View>

                      {subjects.length > 0 && (
                        <ThemedText style={styles.subjectsText} numberOfLines={2}>
                          {subjects.join(' • ')}
                        </ThemedText>
                      )}

                      <View style={styles.metaRow}>
                        {languages.length > 0 && (
                          <View style={styles.metaItem}>
                            <Ionicons name="globe-outline" size={15} color="#777777" />
                            <ThemedText style={styles.metaText} numberOfLines={1}>
                              {languages.join(', ')}
                            </ThemedText>
                          </View>
                        )}
                        {isVerified && (
                          <View style={styles.verifiedTag}>
                            <Ionicons name="checkmark-circle" size={14} color="#58cc02" />
                            <ThemedText style={styles.verifiedTagText}>Verified</ThemedText>
                          </View>
                        )}
                      </View>

                      <TouchableOpacity
                        style={styles.viewProfileBtn}
                        onPress={() => router.push({
                          pathname: '/teacher-profile/[id]',
                          params: { id: teacher.id }
                        })}
                        activeOpacity={0.8}
                      >
                        <ThemedText style={styles.viewProfileText}>View Profile</ThemedText>
                        <Ionicons name="chevron-forward" size={16} color={LingoTheme.colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {hasFooter && (
                    <View style={styles.cardFooter}>
                      {hasHourlyRate && (
                        <View style={styles.rateGroup}>
                          <ThemedText style={styles.rateLabel}>Hourly Rate</ThemedText>
                          <View style={styles.rateValueRow}>
                            <Ionicons name="cash-outline" size={16} color="#58cc02" />
                            <ThemedText style={styles.rateValue}>${hourlyRate}/hour</ThemedText>
                          </View>
                        </View>
                      )}
                      {hasExperience && (
                        <View style={styles.rateGroup}>
                          <ThemedText style={styles.rateLabel}>Experience</ThemedText>
                          <View style={styles.rateValueRow}>
                            <Ionicons name="ribbon-outline" size={16} color="#ce82ff" />
                            <ThemedText style={styles.rateValue}>{experienceYears}+ years</ThemedText>
                          </View>
                        </View>
                      )}
                      {reviewCount > 0 && (
                        <View style={styles.rateGroup}>
                          <ThemedText style={styles.rateLabel}>Reviews</ThemedText>
                          <View style={styles.rateValueRow}>
                            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#3B82F6" />
                            <ThemedText style={[styles.rateValue, { color: '#3B82F6' }]}>{reviewCount}</ThemedText>
                          </View>
                        </View>
                      )}
                      {teacher.has_ijaazah && (
                        <View style={styles.rateGroup}>
                          <ThemedText style={styles.rateLabel}>Credential</ThemedText>
                          <View style={styles.rateValueRow}>
                            <Ionicons name="shield-checkmark-outline" size={16} color="#0F766E" />
                            <ThemedText style={[styles.rateValue, { color: '#0F766E' }]}>Ijaazah</ThemedText>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7', // Lingo light background
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  headerPad: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },

  /* Mode Switch - Lingo Style */
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    paddingVertical: 14,
  },
  modePillActive: {
    backgroundColor: '#2D6B22', // Dark green like reference
  },
  modePillText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#777777',
  },
  modePillTextActive: {
    color: '#FFFFFF',
  },

  /* Filter Card */
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
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

  /* Pills - Lingo Style */
  pillsContainer: {
    gap: 8,
    paddingTop: 16,
    paddingBottom: 4,
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

  /* List Content */
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    padding: 24,
  },

  /* Teacher Card - Tactile Style */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    padding: 20,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 14,
  },
  avatarContainer: {
    position: 'relative',
    flexShrink: 0,
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 20, // Squircle look
    borderWidth: 2,
    borderColor: '#E5E5E5',
  },
  avatarPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#58cc02',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  nameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#3C3C3C',
    flex: 1,
    minWidth: 0,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    flexShrink: 0,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#D4AF37',
  },
  reviewCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#AFAFAF',
  },
  subjectsText: {
    fontSize: 14,
    color: '#777777',
    fontWeight: '600',
    marginBottom: 10,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    minWidth: 0,
  },
  metaText: {
    fontSize: 13,
    color: '#777777',
    fontWeight: '700',
    flexShrink: 1,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LingoTheme.colors.softPrimary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  verifiedTagText: {
    color: '#58cc02',
    fontWeight: '800',
    fontSize: 12,
  },
  viewProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#ECFCD8',
  },
  viewProfileText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#58cc02',
  },

  cardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 18,
    paddingTop: 16,
    marginTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#E5E5E5',
  },
  rateGroup: {
    gap: 4,
    minWidth: 96,
  },
  rateLabel: {
    fontSize: 10,
    color: '#AFAFAF',
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  rateValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rateValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#58cc02',
  },
});
