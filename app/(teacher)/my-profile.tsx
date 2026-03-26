import { StyleSheet, View, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/lib/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { LinearGradient } from 'expo-linear-gradient';
import { Fonts } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

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
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>My Profile</ThemedText>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => router.push('/(teacher)/edit-profile')}
        >
          <Ionicons name="create-outline" size={20} color="#4ECDC4" />
          <ThemedText style={styles.editButtonText}>Edit</ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Profile Card */}
        <LinearGradient
          colors={['#4ECDC4', '#2BCBBA']}
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
            
            {/* Verification Status */}
            <View style={[styles.statusBadge, { backgroundColor: getVerificationBadgeColor() }]}>
              <Ionicons 
                name={profile?.verification_status === 'verified' ? 'shield-checkmark' : 'time'} 
                size={14} 
                color="#FFF" 
              />
              <ThemedText style={styles.statusText}>{getVerificationLabel()}</ThemedText>
            </View>
          </View>

          {/* Quick Stats */}
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
              <Ionicons name="people" size={18} color="#E0F2F1" />
              <ThemedText style={styles.statValue}>{stats?.totalStudents || 0}</ThemedText>
              <ThemedText style={styles.statLabel}>Students</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="book" size={18} color="#E0F2F1" />
              <ThemedText style={styles.statValue}>{stats?.completedClasses || 0}</ThemedText>
              <ThemedText style={styles.statLabel}>Classes</ThemedText>
            </View>
          </View>
        </LinearGradient>

        {/* About Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>About Me</ThemedText>
          </View>
          <ThemedText style={styles.bioText}>
            {profile?.bio || 'Add a bio to tell parents about yourself and your teaching style.'}
          </ThemedText>
        </View>

        {/* Hourly Rate */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Hourly Rate</ThemedText>
          </View>
          <View style={styles.rateCard}>
            <ThemedText style={styles.rateValue}>${profile?.hourly_rate || 0}</ThemedText>
            <ThemedText style={styles.rateLabel}>per hour</ThemedText>
          </View>
        </View>

        {/* Subjects */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Subjects I Teach</ThemedText>
          </View>
          <View style={styles.tagsContainer}>
            {profile?.subjects?.length ? (
              profile.subjects.map((subject, idx) => (
                <View key={idx} style={styles.tag}>
                  <ThemedText style={styles.tagText}>{subject}</ThemedText>
                </View>
              ))
            ) : (
              <ThemedText style={styles.emptyText}>No subjects added</ThemedText>
            )}
          </View>
        </View>

        {/* Languages */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Languages</ThemedText>
          </View>
          <View style={styles.tagsContainer}>
            {profile?.languages?.length ? (
              profile.languages.map((lang, idx) => (
                <View key={idx} style={[styles.tag, styles.languageTag]}>
                  <Ionicons name="language-outline" size={14} color="#4ECDC4" />
                  <ThemedText style={[styles.tagText, { color: '#4ECDC4' }]}>{lang}</ThemedText>
                </View>
              ))
            ) : (
              <ThemedText style={styles.emptyText}>No languages added</ThemedText>
            )}
          </View>
        </View>

        {/* Availability Overview */}
        <View style={styles.section}>
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
        </View>

        {/* Reviews Section */}
        <View style={styles.section}>
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
            <View style={styles.emptyReviews}>
              <Ionicons name="chatbubbles-outline" size={40} color="#D1D5DB" />
              <ThemedText style={styles.emptyReviewsText}>
                No reviews yet. Complete more classes to get reviews!
              </ThemedText>
            </View>
          )}
        </View>

        {/* Earnings Summary */}
        <View style={styles.section}>
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
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFF',
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: Fonts.rounded,
    fontWeight: '700',
    color: '#111827',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F0FDFA',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4ECDC4',
  },
  scrollView: {
    flex: 1,
  },
  profileCard: {
    margin: 20,
    borderRadius: 20,
    padding: 24,
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
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFF',
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
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 8,
  },
  section: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
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
    fontWeight: '700',
    color: '#111827',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4ECDC4',
  },
  bioText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  rateCard: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  rateValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#4ECDC4',
  },
  rateLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#E0F2F1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#00695C',
  },
  languageTag: {
    backgroundColor: '#F0FDFA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    color: '#6B7280',
  },
  dayIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayAvailable: {
    backgroundColor: '#4ECDC4',
  },
  reviewCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
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
    backgroundColor: '#E0F2F1',
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
    fontWeight: '600',
    color: '#111827',
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
  emptyReviews: {
    alignItems: 'center',
    padding: 24,
  },
  emptyReviewsText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 12,
  },
  earningsCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 16,
  },
  earningsRow: {
    flexDirection: 'row',
  },
  earningsItem: {
    flex: 1,
  },
  earningsLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  earningsValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4ECDC4',
  },
});
