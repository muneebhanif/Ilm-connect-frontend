import { StyleSheet, View, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/lib/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { LinearGradient } from 'expo-linear-gradient';
import { LingoBadge, LingoButton, LingoCard, LingoEmptyState } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';
import { TeacherMyProfileSkeleton } from '@/components/ui/dashboard-skeletons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

interface TeacherProfile {
  full_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  bio: string;
  subjects: string[];
  hourly_rate: number;
  rating: number;
  review_count?: number;
  verification_status: string;
  languages: string[];
  gender: string;
  availability?: Record<string, string[]>;
  intro_video_url?: string;
  portfolio_media?: Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
  }>;
  documents?: Array<{
    type: string;
    url: string;
    verified: boolean;
  }>;
}

interface TeacherStats {
  totalStudents: number;
  totalEarnings: number;
  completedClasses: number;
  upcomingClasses: number;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  parent: {
    full_name: string;
  };
}

export default function MyProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { topPadding, bottomPadding } = useSafePadding();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [user?.id])
  );

  const loadProfile = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      // Get teacher profile with stats
      const profileRes = await fetch(api.teacherProfile(user.id));
      const profileData = await profileRes.json();
      
      if (profileRes.ok) {
        setProfile(profileData.profile);
        setStats(profileData.stats);
      }

      // Get reviews
      const reviewsRes = await fetch(api.reviews.forTeacher(user.id));
      const reviewsData = await reviewsRes.json();
      
      if (reviewsRes.ok) {
        setReviews(reviewsData.reviews || []);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  const getVerificationBadgeColor = () => {
    switch (profile?.verification_status?.toLowerCase()) {
      case 'verified':
      case 'approved':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      default:
        return '#9CA3AF';
    }
  };

  const getVerificationLabel = () => {
    switch (profile?.verification_status?.toLowerCase()) {
      case 'verified':
      case 'approved':
        return 'Verified Teacher';
      case 'pending':
        return 'Pending Verification';
      default:
        return 'Not Verified';
    }
  };

  if (loading && !profile) {
    return <TeacherMyProfileSkeleton />;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPadding }]}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={26} color="#111827" />
          </TouchableOpacity>
          <ThemedText style={styles.topBarTitle}>My Profile</ThemedText>
          <TouchableOpacity onPress={() => router.push('/(teacher)/edit-profile')} activeOpacity={0.8} style={styles.editButton}>
            <Ionicons name="create-outline" size={22} color="#111827" />
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.metricPill}>
            <View style={[styles.statIconBox, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="star" size={22} color="#F97316" />
            </View>
            <ThemedText style={[styles.pillValue, { color: '#F97316' }]}>{profile?.rating?.toFixed(1) || '0.0'}</ThemedText>
            <ThemedText style={styles.pillLabel}>Rating</ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.metricPill}>
            <View style={[styles.statIconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="people" size={22} color="#3B82F6" />
            </View>
            <ThemedText style={[styles.pillValue, { color: '#3B82F6' }]}>{stats?.totalStudents || 0}</ThemedText>
            <ThemedText style={styles.pillLabel}>Students</ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.metricPill}>
            <View style={[styles.statIconBox, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="book" size={22} color="#22C55E" />
            </View>
            <ThemedText style={[styles.pillValue, { color: '#22C55E' }]}>{stats?.completedClasses || 0}</ThemedText>
            <ThemedText style={styles.pillLabel}>Classes</ThemedText>
          </View>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPadding + (Platform.OS === 'ios' ? 120 : 100) }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LingoTheme.colors.primary} />
        }
      >
        <LinearGradient
          colors={['#ECFCD8', '#FFFFFF', '#F2E8FF']}
          style={styles.profileCard}
        >
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <ThemedText style={styles.avatarText}>
                    {profile?.full_name?.charAt(0) || 'T'}
                  </ThemedText>
                </View>
              )}
              {profile?.verification_status === 'verified' && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                </View>
              )}
            </View>
            <ThemedText style={styles.name}>{profile?.full_name || 'Teacher'}</ThemedText>
            <ThemedText style={styles.email}>{profile?.email}</ThemedText>
            
            <LingoBadge
              label={getVerificationLabel()}
              icon={profile?.verification_status === 'verified' ? 'shield-checkmark-outline' : 'time-outline'}
              tone={profile?.verification_status === 'verified' ? 'primary' : 'gold'}
            />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="star" size={18} color="#FFD700" />
              <ThemedText style={styles.statValue}>
                {profile?.rating?.toFixed(1) || '0.0'}
              </ThemedText>
              <ThemedText style={styles.statLabel}>
                ({reviews.length} reviews)
              </ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="people" size={18} color={LingoTheme.colors.teal} />
              <ThemedText style={styles.statValue}>{stats?.totalStudents || 0}</ThemedText>
              <ThemedText style={styles.statLabel}>Students</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="book" size={18} color={LingoTheme.colors.primary} />
              <ThemedText style={styles.statValue}>{stats?.completedClasses || 0}</ThemedText>
              <ThemedText style={styles.statLabel}>Classes</ThemedText>
            </View>
          </View>
        </LinearGradient>

        <LingoCard style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>About Me</ThemedText>
          </View>
          <ThemedText style={styles.bioText}>
            {profile?.bio || 'Add a bio to tell parents about yourself and your teaching style.'}
          </ThemedText>
        </LingoCard>

        <LingoCard style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Hourly Rate</ThemedText>
          </View>
          <View style={styles.rateCard}>
            <ThemedText style={styles.rateValue}>${profile?.hourly_rate || 0}</ThemedText>
            <ThemedText style={styles.rateLabel}>per hour</ThemedText>
          </View>
        </LingoCard>

        <LingoCard style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Subjects I Teach</ThemedText>
          </View>
          <View style={styles.tagsContainer}>
            {profile?.subjects?.length ? (
              profile.subjects.map((subject, idx) => (
                <LingoBadge key={idx} label={subject} icon="school-outline" tone="teal" />
              ))
            ) : (
              <ThemedText style={styles.emptyText}>No subjects added</ThemedText>
            )}
          </View>
        </LingoCard>

        <LingoCard style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Languages</ThemedText>
          </View>
          <View style={styles.tagsContainer}>
            {profile?.languages?.length ? (
              profile.languages.map((lang, idx) => (
                <LingoBadge key={idx} label={lang} icon="language-outline" tone="purple" />
              ))
            ) : (
              <ThemedText style={styles.emptyText}>No languages added</ThemedText>
            )}
          </View>
        </LingoCard>

        <LingoCard style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ThemedText style={styles.sectionTitle}>Portfolio</ThemedText>
              {profile?.portfolio_media?.length ? (
                <View style={{ backgroundColor: '#4ECDC4', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <ThemedText style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>
                    {profile.portfolio_media.length}
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => router.push('/(teacher)/edit-profile')}>
              <ThemedText style={styles.seeAllText}>Manage</ThemedText>
            </TouchableOpacity>
          </View>
          <View style={styles.portfolioGrid}>
            {profile?.portfolio_media?.length ? (
              profile.portfolio_media.slice(0, 6).map((item) => (
                <View key={item.id} style={styles.portfolioCard}>
                  {item.type === 'image' ? (
                    <Image source={{ uri: item.url }} style={styles.portfolioImage} />
                  ) : (
                    <View style={styles.portfolioVideoPlaceholder}>
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(78,205,196,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="play" size={24} color="#4ECDC4" />
                      </View>
                      <ThemedText style={styles.portfolioVideoText}>Video</ThemedText>
                    </View>
                  )}
                  <View style={{ position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <ThemedText style={{ color: '#FFF', fontSize: 10, fontWeight: '600' }}>
                      {item.type === 'image' ? '📷' : '🎥'}
                    </ThemedText>
                  </View>
                </View>
              ))
            ) : (
              <View style={{ width: '100%' }}>
                <LingoEmptyState icon="images-outline" title="No portfolio media yet" subtitle="Add visuals to help parents understand your teaching style and presentation." tone="purple" />
              </View>
            )}
          </View>
        </LingoCard>

        <LingoCard style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Weekly Availability</ThemedText>
            <TouchableOpacity onPress={() => router.push('/(teacher)/availability')}>
              <ThemedText style={styles.seeAllText}>Edit</ThemedText>
            </TouchableOpacity>
          </View>
          <View style={styles.availabilityGrid}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
              const fullDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              const dayKey = fullDays[index];
              const slots = profile?.availability?.[dayKey] || [];
              const isAvailable = slots.length > 0;
              
              return (
                <View key={day} style={styles.dayItem}>
                  <ThemedText style={styles.dayLabel}>{day}</ThemedText>
                  <View style={[styles.dayIndicator, isAvailable && styles.dayAvailable]}>
                    {isAvailable ? (
                      <Ionicons name="checkmark" size={12} color="#FFF" />
                    ) : (
                      <Ionicons name="close" size={12} color="#9CA3AF" />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </LingoCard>

        <LingoCard style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>
              Reviews ({reviews.length})
            </ThemedText>
          </View>
          
          {reviews.length > 0 ? (
            reviews.slice(0, 5).map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewerAvatar}>
                    <ThemedText style={styles.reviewerInitial}>
                      {review.parent?.full_name?.charAt(0) || 'P'}
                    </ThemedText>
                  </View>
                  <View style={styles.reviewerInfo}>
                    <ThemedText style={styles.reviewerName}>
                      {review.parent?.full_name || 'Parent'}
                    </ThemedText>
                    <View style={styles.starsRow}>
                      {[...Array(5)].map((_, i) => (
                        <Ionicons 
                          key={i} 
                          name="star" 
                          size={12} 
                          color={i < review.rating ? "#F59E0B" : "#E5E7EB"} 
                        />
                      ))}
                    </View>
                  </View>
                  <ThemedText style={styles.reviewDate}>
                    {new Date(review.created_at).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </ThemedText>
                </View>
                {review.comment && (
                  <ThemedText style={styles.reviewComment}>
                    "{review.comment}"
                  </ThemedText>
                )}
              </View>
            ))
          ) : (
            <LingoEmptyState icon="chatbubbles-outline" title="No reviews yet" subtitle="Complete more classes and parents will be able to leave feedback here." tone="gold" />
          )}
        </LingoCard>

        <LingoCard style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Earnings</ThemedText>
          </View>
          <View style={styles.earningsCard}>
            <View style={styles.earningsRow}>
              <View style={styles.earningsItem}>
                <ThemedText style={styles.earningsLabel}>Total Earned</ThemedText>
                <ThemedText style={styles.earningsValue}>
                  ${stats?.totalEarnings?.toFixed(2) || '0.00'}
                </ThemedText>
              </View>
              <View style={styles.earningsItem}>
                <ThemedText style={styles.earningsLabel}>Completed Classes</ThemedText>
                <ThemedText style={styles.earningsValue}>
                  {stats?.completedClasses || 0}
                </ThemedText>
              </View>
            </View>
          </View>
        </LingoCard>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LingoTheme.colors.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  backButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 2, borderColor: '#E5E5E5', borderBottomWidth: 4,
    justifyContent: 'center', alignItems: 'center',
  },
  editButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 2, borderColor: '#E5E5E5', borderBottomWidth: 4,
    justifyContent: 'center', alignItems: 'center',
  },
  topBarTitle: { flex: 1, fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: '#111827' },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, paddingHorizontal: 2 },
  metricPill: { flex: 1, alignItems: 'center', gap: 6 },
  statIconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  pillValue: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  pillLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  statDivider: { width: 1, height: 48, backgroundColor: '#E5E7EB' },
  scrollView: {
    flex: 1,
  },
  profileCard: {
    margin: 20,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    padding: 24,
    ...LingoTheme.shadow.card,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: LingoTheme.colors.softTeal,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: LingoTheme.colors.teal,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: LingoTheme.colors.muted,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
  },
  statLabel: {
    fontSize: 11,
    color: LingoTheme.colors.muted,
  },
  statDivider: {
    width: 1,
    backgroundColor: LingoTheme.colors.border,
    marginHorizontal: 8,
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: LingoTheme.colors.teal,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 22,
    color: LingoTheme.colors.ink,
  },
  emptyText: {
    fontSize: 14,
    color: LingoTheme.colors.muted,
    fontStyle: 'italic',
  },
  rateCard: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  rateValue: {
    fontSize: 32,
    fontWeight: '800',
    color: LingoTheme.colors.primary,
  },
  rateLabel: {
    fontSize: 14,
    color: LingoTheme.colors.muted,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  portfolioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  portfolioCard: {
    width: '48%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
  },
  portfolioImage: {
    width: '100%',
    height: 140,
  },
  portfolioVideoPlaceholder: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: LingoTheme.colors.softTeal,
  },
  portfolioVideoText: {
    color: LingoTheme.colors.teal,
    fontSize: 12,
    fontWeight: '600',
  },
  availabilityGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayItem: {
    alignItems: 'center',
    gap: 8,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: LingoTheme.colors.muted,
  },
  dayIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: LingoTheme.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayAvailable: {
    backgroundColor: LingoTheme.colors.primary,
  },
  reviewCard: {
    backgroundColor: LingoTheme.colors.surfaceAlt,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LingoTheme.colors.softTeal,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reviewerInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00695C',
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '700',
    color: LingoTheme.colors.ink,
  },
  starsRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  reviewComment: {
    fontSize: 14,
    color: '#4B5563',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  earningsCard: {
    backgroundColor: LingoTheme.colors.softTeal,
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
  },
  earningsRow: {
    flexDirection: 'row',
  },
  earningsItem: {
    flex: 1,
  },
  earningsLabel: {
    fontSize: 12,
    color: LingoTheme.colors.muted,
    marginBottom: 4,
  },
  earningsValue: {
    fontSize: 24,
    fontWeight: '800',
    color: LingoTheme.colors.teal,
  },
});
