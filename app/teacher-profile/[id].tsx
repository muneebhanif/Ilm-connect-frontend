import { StyleSheet, View, ScrollView, TouchableOpacity, Image, Platform, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '@/components/themed-text';
import { BackButton } from '@/components/back-button';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { Fonts } from '@/constants/theme';
import { SkeletonScreen } from '@/components/ui/skeleton';
import { useSafePadding } from '@/hooks/use-safe-padding';

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  parent: {
    full_name: string;
  };
}

interface TeacherProfile {
  id: string;
  bio: string;
  subjects: string[];
  hourly_rate: number;
  rating: number;
  verification_status: string;
  languages: string[];
  gender: string;
  availability: Record<string, string[]>;
  intro_video_url?: string;
  portfolio_media?: Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
  }>;
  reviews?: Review[];
  profiles: {
    full_name: string;
    email: string;
    avatar_url?: string; // Assuming avatar is in profiles or fetched separately
  };
}

export default function TeacherProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { topPadding, bottomPadding } = useSafePadding();
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeacherProfile();
  }, [id]);

  const fetchTeacherProfile = async () => {
    try {
      const response = await fetch(api.teacherById(id as string));
      const data = await response.json();
      setTeacher(data.teacher);
    } catch (error) {
      console.error('Error fetching teacher:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <SkeletonScreen />;
  }

  if (!teacher) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
        <ThemedText style={styles.errorText}>Teacher not found</ThemedText>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding }]}> 
        <BackButton lightColor="#FFF" />
        <ThemedText style={styles.headerTitle}>Teacher Profile</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: bottomPadding + 112 }} showsVerticalScrollIndicator={false}>
        
        {/* Profile Card */}
        <View style={styles.profileHeaderContainer}>
          <LinearGradient
            colors={['#4ECDC4', '#2BCBBA']}
            style={styles.profileGradient}
          >
            {teacher.profiles.avatar_url ? (
              <>
                <Image
                  source={{ uri: teacher.profiles.avatar_url }}
                  style={styles.avatarBackgroundGlow}
                  blurRadius={18}
                />
                <View style={styles.avatarBackgroundOverlay} />
              </>
            ) : (
              <View style={styles.avatarFallbackGlow} />
            )}

            <View style={styles.avatarWrapper}>
              <View style={styles.avatar}>
                {teacher.profiles.avatar_url ? (
                  <Image source={{ uri: teacher.profiles.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <ThemedText style={styles.avatarText}>
                    {teacher.profiles.full_name.charAt(0)}
                  </ThemedText>
                )}
              </View>
              {teacher.verification_status === 'verified' && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark" size={12} color="#FFF" />
                </View>
              )}
            </View>

            <ThemedText style={styles.teacherName}>{teacher.profiles.full_name}</ThemedText>
            <ThemedText style={styles.teacherSubjects}>
              {teacher.subjects?.join(' • ') || 'Islamic Studies'}
            </ThemedText>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <ThemedText style={styles.statText}>
                  {teacher.rating ? teacher.rating.toFixed(1) : 'New'}
                </ThemedText>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="time-outline" size={16} color="#E0F2F1" />
                <ThemedText style={styles.statText}>${teacher.hourly_rate}/hr</ThemedText>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="language-outline" size={16} color="#E0F2F1" />
                <ThemedText style={styles.statText}>
                  {teacher.languages?.[0] || 'English'}
                </ThemedText>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Content Body */}
        <View style={styles.contentBody}>
          
          {/* About Section */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>About Me</ThemedText>
            <ThemedText style={styles.bioText}>
              {teacher.bio || "This teacher hasn't added a bio yet."}
            </ThemedText>
          </View>

          {/* Intro Video Placeholder */}
          {teacher.intro_video_url && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Introduction</ThemedText>
              <TouchableOpacity style={styles.videoCard} onPress={() => teacher.intro_video_url && Linking.openURL(teacher.intro_video_url)}>
                <LinearGradient
                  colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.8)']}
                  style={styles.videoOverlay}
                >
                  <View style={styles.playButton}>
                    <Ionicons name="play" size={24} color="#4ECDC4" />
                  </View>
                  <ThemedText style={styles.videoLabel}>Watch Video</ThemedText>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Portfolio */}
          {!!teacher.portfolio_media?.length && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Portfolio</ThemedText>
              <View style={styles.portfolioGrid}>
                {teacher.portfolio_media.map((item) => (
                  <TouchableOpacity key={item.id} style={styles.portfolioCard} onPress={() => Linking.openURL(item.url)}>
                    {item.type === 'image' ? (
                      <Image source={{ uri: item.url }} style={styles.portfolioImage} />
                    ) : (
                      <View style={styles.portfolioVideoPlaceholder}>
                        <Ionicons name="play-circle" size={34} color="#4ECDC4" />
                        <ThemedText style={styles.portfolioVideoText}>Play Video</ThemedText>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Availability Preview */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Availability</ThemedText>
            <View style={styles.availabilityCard}>
              <View style={styles.weekRow}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
                  // Map index to full day name keys in JSONB (assuming Monday start or standard map)
                  // Simple check: does availability have keys containing this short day?
                  // Better: Standardize keys. Assuming standard full English names.
                  const fullDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                  const dayKey = fullDays[index];
                  const isAvailable = teacher.availability && teacher.availability[dayKey] && teacher.availability[dayKey].length > 0;
                  
                  return (
                    <View key={day} style={styles.dayColumn}>
                      <ThemedText style={styles.dayHeader}>{day}</ThemedText>
                      <View style={[
                        styles.dayDot, 
                        isAvailable ? styles.dotAvailable : styles.dotUnavailable
                      ]} />
                    </View>
                  );
                })}
              </View>
              <ThemedText style={styles.availabilityHint}>
                Green dots indicate days with open slots.
              </ThemedText>
            </View>
          </View>

          {/* Reviews Section */}
          {teacher.reviews && teacher.reviews.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle}>
                  Reviews ({teacher.reviews.length})
                </ThemedText>
                <View style={styles.avgRatingBadge}>
                  <Ionicons name="star" size={16} color="#F59E0B" />
                  <ThemedText style={styles.avgRatingText}>
                    {teacher.rating ? teacher.rating.toFixed(1) : '0.0'}
                  </ThemedText>
                </View>
              </View>
              {teacher.reviews.slice(0, 5).map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerAvatar}>
                      <ThemedText style={styles.reviewerInitials}>
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
              ))}
              {teacher.reviews.length > 5 && (
                <ThemedText style={styles.moreReviews}>
                  +{teacher.reviews.length - 5} more reviews
                </ThemedText>
              )}
            </View>
          )}

        </View>
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Footer Action */}
      <View style={[styles.footer, { paddingBottom: bottomPadding }]}> 
        <View style={styles.footerButtons}>
          <TouchableOpacity 
            style={styles.messageButton}
            activeOpacity={0.8}
            onPress={() => router.push({
              pathname: '/chat/[id]',
              params: { id: teacher.id, name: teacher.profiles.full_name }
            })}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#4ECDC4" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.bookButton}
            activeOpacity={0.8}
            onPress={() => router.push({
              pathname: '/book-teacher/[id]',
              params: { id: teacher.id }
            })}
          >
            <LinearGradient
              colors={['#4ECDC4', '#2BCBBA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.bookGradient}
            >
              <ThemedText style={styles.bookButtonText}>Book Class</ThemedText>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
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
  scrollView: {
    flex: 1,
  },
  
  /* Header */
  header: {
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4ECDC4', // Matches theme
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    fontFamily: Fonts.rounded,
  },

  /* Profile Card (Gradient) */
  profileHeaderContainer: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  profileGradient: {
    paddingTop: 18,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  avatarBackgroundGlow: {
    position: 'absolute',
    top: -24,
    alignSelf: 'center',
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.3,
    transform: [{ scale: 1.2 }],
  },
  avatarBackgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(34, 197, 186, 0.18)',
  },
  avatarFallbackGlow: {
    position: 'absolute',
    top: -32,
    alignSelf: 'center',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
    zIndex: 2,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFF',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#10B981', // Success Green
    borderWidth: 2,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teacherName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
    fontFamily: Fonts.rounded,
    zIndex: 2,
  },
  teacherSubjects: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 16,
    fontWeight: '500',
    zIndex: 2,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    zIndex: 2,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 13,
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 16,
  },

  /* Content Body */
  contentBody: {
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    fontFamily: Fonts.rounded,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#4B5563',
  },
  
  /* Video Card */
  videoCard: {
    height: 180,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    overflow: 'hidden',
  },
  videoOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
    marginBottom: 8,
  },
  videoLabel: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },

  portfolioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  portfolioCard: {
    width: '48%',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  portfolioImage: {
    width: '100%',
    height: 135,
  },
  portfolioVideoPlaceholder: {
    height: 135,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFEFF',
    gap: 8,
  },
  portfolioVideoText: {
    fontSize: 12,
    color: '#0F766E',
    fontWeight: '600',
  },

  /* Availability Preview */
  availabilityCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dayColumn: {
    alignItems: 'center',
    gap: 8,
  },
  dayHeader: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  dayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotAvailable: {
    backgroundColor: '#4ECDC4', // Theme color
  },
  dotUnavailable: {
    backgroundColor: '#E5E7EB',
  },
  availabilityHint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },

  /* Reviews */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  avgRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  avgRatingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F59E0B',
  },
  reviewCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
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
    backgroundColor: '#E0F2F1', // Light Teal
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reviewerInitials: {
    color: '#00695C',
    fontWeight: '700',
    fontSize: 14,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  reviewDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  starsRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  reviewComment: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  moreReviews: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },

  /* Error/Loading */
  errorText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: '700',
  },

  bottomPadding: {
    height: 24,
  },

  /* Footer */
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(249,250,251,0.96)',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  footerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  messageButton: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  bookButton: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  bookButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});