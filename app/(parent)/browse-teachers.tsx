import { StyleSheet, View, TextInput, ScrollView, TouchableOpacity, Image, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { LinearGradient } from 'expo-linear-gradient';
import { Fonts } from '@/constants/theme';
import { SkeletonScreen } from '@/components/ui/skeleton';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>('All');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  const subjects = ['All', 'Quran Memorization', 'Tajweed', 'Arabic Language', 'Islamic Studies', 'Fiqh', 'Hadith'];

  useEffect(() => {
    fetchTeachers();
  }, [selectedSubject]);

  const fetchTeachers = async () => {
    try {
      setLoading(true);
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
    }
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
           <ThemedText style={styles.headerTitle}>Find a Teacher</ThemedText>
           <TouchableOpacity style={styles.filterBtn}>
              <Ionicons name="options-outline" size={24} color="#111827" />
           </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or subject..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filter Pills */}
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
            >
              <ThemedText style={[styles.pillText, selectedSubject === subject && styles.pillTextActive]}>
                {subject}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <SkeletonScreen />
        ) : filteredTeachers.length === 0 ? (
          <View style={styles.centerState}>
            <View style={styles.emptyIconBg}>
               <Ionicons name="search-outline" size={32} color="#9CA3AF" />
            </View>
            <ThemedText style={styles.emptyTitle}>No teachers found</ThemedText>
            <ThemedText style={styles.emptyText}>Try adjusting your search or filters.</ThemedText>
          </View>
        ) : (
          filteredTeachers.map((teacher) => (
            
            <TouchableOpacity 
              key={teacher.id} 
              style={styles.card}
              activeOpacity={0.9}
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
                      colors={['#4ECDC4', '#2BCBBA']}
                      style={styles.avatarPlaceholder}
                    >
                      <ThemedText style={styles.avatarText}>
                        {teacher.profiles.full_name.charAt(0)}
                      </ThemedText>
                    </LinearGradient>
                  )}
                  {(['verified', 'approved'].includes(String(teacher.verification_status || '').toLowerCase())) && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark" size={10} color="#FFF" />
                    </View>
                  )}
                </View>
                
                <View style={styles.headerInfo}>
                  <View style={styles.nameRow}>
                    <ThemedText style={styles.nameText} numberOfLines={1}>
                      {teacher.profiles.full_name}
                    </ThemedText>
                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={12} color="#F59E0B" />
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
                       <Ionicons name="language-outline" size={14} color="#6B7280" />
                       <ThemedText style={styles.metaText}>{teacher.languages?.[0] || 'English'}</ThemedText>
                    </View>
                    {teacher.has_ijaazah && (
                      <View style={[styles.metaItem, styles.ijaazahTag]}>
                         <Ionicons name="ribbon-outline" size={14} color="#C2410C" />
                         <ThemedText style={[styles.metaText, { color: '#C2410C' }]}>Ijaazah</ThemedText>
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
                
                <TouchableOpacity style={styles.bookButton}>
                   <ThemedText style={styles.bookButtonText}>View Profile</ThemedText>
                   <Ionicons name="arrow-forward" size={16} color="#4ECDC4" />
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
    backgroundColor: '#F9FAFB',
  },
  
  /* Header */
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 16,
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
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: Fonts.rounded,
    fontWeight: '700',
    color: '#111827',
  },
  filterBtn: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
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
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#111827',
    height: '100%',
  },

  /* Pills */
  pillsContainer: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 4,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pillActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },

  /* List */
  scrollView: {
    flex: 1,
  },
  listContent: {
    padding: 20,
  },
  
  /* Card */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
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
    color: '#FFFFFF',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#10B981',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
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
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  reviewCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  subjectsText: {
    fontSize: 13,
    color: '#6B7280',
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
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },

  /* Footer */
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  rateLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  rateValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F0FDFA',
  },
  bookButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4ECDC4',
  },

  /* States */
  centerState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
});