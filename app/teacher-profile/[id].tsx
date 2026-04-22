import { StyleSheet, View, ScrollView, TouchableOpacity, Image, Platform, Linking, Modal, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '@/components/themed-text';
// Back navigation uses simple arrow icon
import { useState, useEffect, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { LingoBadge, LingoButton, LingoCard, LingoEmptyState, LingoScreenHeader, LingoStatPill } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { SkeletonScreen } from '@/components/ui/skeleton';
import { useSafePadding } from '@/hooks/use-safe-padding';
import { WebView } from 'react-native-webview';

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
  const [portfolioIndex, setPortfolioIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const screenWidth = Dimensions.get('window').width;
  const portfolioCardWidth = screenWidth - 40;

  const orderedPortfolioMedia = useMemo(() => {
    if (!teacher?.portfolio_media?.length) return [];

    const videos = teacher.portfolio_media.filter((item) => item.type === 'video');
    const images = teacher.portfolio_media.filter((item) => item.type === 'image');
    return [...videos, ...images];
  }, [teacher?.portfolio_media]);

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

  const openPortfolioViewer = (index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  };

  const handlePortfolioScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / portfolioCardWidth);
    if (Number.isFinite(nextIndex)) {
      setPortfolioIndex(Math.max(0, Math.min(nextIndex, orderedPortfolioMedia.length - 1)));
    }
  };

  const handleViewerScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    if (Number.isFinite(nextIndex)) {
      setViewerIndex(Math.max(0, Math.min(nextIndex, orderedPortfolioMedia.length - 1)));
    }
  };

  if (loading) {
    return <SkeletonScreen />;
  }

  if (!teacher) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <LingoCard style={styles.errorCard}>
          <LingoEmptyState icon="alert-circle-outline" title="Teacher not found" subtitle="This teacher profile could not be loaded right now." tone="danger" />
          <LingoButton label="Go back" variant="secondary" onPress={() => router.back()} style={styles.backButton} />
        </LingoCard>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding }]}> 
        <LingoScreenHeader
          title="Teacher profile"
          subtitle="Review teaching highlights, portfolio, availability, and parent feedback before booking."
          badge="Public profile"
          icon="school-outline"
          onBack={() => router.back()}
        >
          <View style={styles.headerStats}>
            <LingoStatPill icon="⭐" value={teacher.rating ? teacher.rating.toFixed(1) : 'New'} label="Rating" tone="gold" />
            <LingoStatPill icon="💵" value={`$${teacher.hourly_rate}`} label="Hourly" tone="teal" />
            <LingoStatPill icon="🗣️" value={teacher.languages?.[0] || 'English'} label="Language" tone="purple" />
          </View>
        </LingoScreenHeader>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: bottomPadding + 112 }} showsVerticalScrollIndicator={false}>
        
        {/* Profile Card */}
        <View style={styles.profileHeaderContainer}>
          <LinearGradient
            colors={['#ECFCD8', '#FFFFFF', '#F2E8FF']}
            style={styles.profileGradient}
          >
            <View style={styles.avatarFallbackGlow} />

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

            <View style={styles.profileBadges}>
              <LingoBadge label={teacher.verification_status === 'verified' ? 'Verified teacher' : 'Verification pending'} icon="shield-checkmark-outline" tone={teacher.verification_status === 'verified' ? 'primary' : 'gold'} />
              {teacher.languages?.[1] ? <LingoBadge label={`${teacher.languages.length} languages`} icon="language-outline" tone="purple" /> : null}
            </View>
          </LinearGradient>
        </View>

        {/* Content Body */}
        <View style={styles.contentBody}>
          
          {/* About Section */}
          <LingoCard style={styles.section}>
            <ThemedText style={styles.sectionTitle}>About Me</ThemedText>
            <ThemedText style={styles.bioText}>
              {teacher.bio || "This teacher hasn't added a bio yet."}
            </ThemedText>
          </LingoCard>

          {/* Intro Video Placeholder */}
          {teacher.intro_video_url && (
            <LingoCard style={styles.section}>
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
            </LingoCard>
          )}

          {/* Portfolio */}
          {!!orderedPortfolioMedia.length && (
            <LingoCard style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Portfolio</ThemedText>
              <ThemedText style={styles.portfolioHint}>Videos appear first, then swipe right to view images.</ThemedText>

              <ScrollView
                horizontal
                pagingEnabled
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                snapToInterval={portfolioCardWidth + 12}
                snapToAlignment="start"
                disableIntervalMomentum
                contentContainerStyle={styles.portfolioCarousel}
                onMomentumScrollEnd={handlePortfolioScroll}
              >
                {orderedPortfolioMedia.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.portfolioSlide, { width: portfolioCardWidth }]}
                    activeOpacity={0.92}
                    onPress={() => openPortfolioViewer(index)}
                  >
                    {item.type === 'image' ? (
                      <Image source={{ uri: item.url }} style={styles.portfolioImage} />
                    ) : (
                      <LinearGradient colors={['#0F172A', '#111827']} style={styles.portfolioVideoPlaceholder}>
                        <View style={styles.portfolioVideoIconWrap}>
                          <Ionicons name="play" size={30} color="#4ECDC4" />
                        </View>
                        <ThemedText style={styles.portfolioVideoText}>Portfolio Video</ThemedText>
                        <ThemedText style={styles.portfolioVideoSubtext}>Tap to watch inside the app</ThemedText>
                      </LinearGradient>
                    )}

                    <LinearGradient colors={['transparent', 'rgba(17,24,39,0.78)']} style={styles.portfolioOverlay}>
                      <View style={styles.portfolioTag}>
                        <Ionicons name={item.type === 'video' ? 'videocam' : 'image'} size={12} color="#FFFFFF" />
                        <ThemedText style={styles.portfolioTagText}>{item.type === 'video' ? 'Video' : 'Image'}</ThemedText>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {orderedPortfolioMedia.length > 1 ? (
                <View style={styles.portfolioDots}>
                  {orderedPortfolioMedia.map((item, index) => (
                    <View
                      key={`${item.id}-dot`}
                      style={[
                        styles.portfolioDot,
                        index === portfolioIndex && styles.portfolioDotActive,
                      ]}
                    />
                  ))}
                </View>
              ) : null}
            </LingoCard>
          )}

          {/* Availability Preview */}
          <LingoCard style={styles.section}>
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
          </LingoCard>

          {/* Reviews Section */}
          {teacher.reviews && teacher.reviews.length > 0 && (
            <LingoCard style={styles.section}>
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
            </LingoCard>
          )}

        </View>
        <View style={styles.bottomPadding} />
      </ScrollView>

      <Modal visible={viewerVisible} animationType="fade" transparent onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.viewerBackdrop}>
          <TouchableOpacity style={styles.viewerCloseButton} onPress={() => setViewerVisible(false)}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: viewerIndex * screenWidth, y: 0 }}
            onMomentumScrollEnd={handleViewerScroll}
            style={styles.viewerScroll}
          >
            {orderedPortfolioMedia.map((item) => (
              <View key={`viewer-${item.id}`} style={[styles.viewerSlide, { width: screenWidth }]}> 
                {item.type === 'image' ? (
                  <Image source={{ uri: item.url }} style={styles.viewerImage} resizeMode="contain" />
                ) : (
                  <View style={styles.viewerVideoFrame}>
                    <WebView
                      source={{
                        html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"><style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden;}video{width:100%;height:100%;background:#000;}</style></head><body><video src="${item.url}" controls playsinline webkit-playsinline preload="metadata"></video></body></html>`,
                      }}
                      style={styles.viewerWebView}
                      allowsInlineMediaPlayback
                      mediaPlaybackRequiresUserAction
                      javaScriptEnabled
                      scrollEnabled={false}
                    />
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          {orderedPortfolioMedia.length > 1 ? (
            <View style={styles.viewerFooter}>
              <ThemedText style={styles.viewerCounter}>{viewerIndex + 1} / {orderedPortfolioMedia.length}</ThemedText>
              <View style={styles.viewerDots}>
                {orderedPortfolioMedia.map((item, index) => (
                  <View
                    key={`viewer-dot-${item.id}`}
                    style={[styles.viewerDot, index === viewerIndex && styles.viewerDotActive]}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      {/* Footer Action */}
      <View style={[styles.footer, { paddingBottom: Math.max(bottomPadding, 24) + 12 }]}> 
        <View style={styles.footerButtons}>
          <LingoButton 
            label="Message"
            variant="secondary"
            icon="chatbubble-outline"
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: teacher.id, name: teacher.profiles.full_name } })}
            style={styles.messageButton}
          />
          <LingoButton 
            label="Book class"
            icon="arrow-forward"
            onPress={() => router.push({ pathname: '/book-teacher/[id]', params: { id: teacher.id } })}
            style={styles.bookButton}
          />
        </View>
      </View>
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
  errorCard: {
    width: '100%',
    maxWidth: 340,
  },
  scrollView: {
    flex: 1,
  },
  
  /* Header */
  header: {
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  headerStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },

  /* Profile Card (Gradient) */
  profileHeaderContainer: {
    marginBottom: 20,
    marginHorizontal: 20,
  },
  profileGradient: {
    borderRadius: 28,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    paddingTop: 18,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  avatarFallbackGlow: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
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
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: LingoTheme.colors.border,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: LingoTheme.colors.primaryDark,
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
    color: LingoTheme.colors.ink,
    marginBottom: 4,
    zIndex: 2,
  },
  teacherSubjects: {
    fontSize: 14,
    color: LingoTheme.colors.muted,
    marginBottom: 16,
    fontWeight: '500',
    zIndex: 2,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    zIndex: 2,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: LingoTheme.colors.ink,
    fontWeight: '600',
    fontSize: 13,
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: LingoTheme.colors.border,
    marginHorizontal: 16,
  },
  profileBadges: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
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

  portfolioHint: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  portfolioCarousel: {
    paddingRight: 12,
  },
  portfolioSlide: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginRight: 12,
    position: 'relative',
  },
  portfolioImage: {
    width: '100%',
    height: 220,
  },
  portfolioVideoPlaceholder: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  portfolioVideoIconWrap: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  portfolioVideoText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  portfolioVideoSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
  },
  portfolioOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    justifyContent: 'flex-end',
    height: 80,
  },
  portfolioTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(17,24,39,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  portfolioTagText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  portfolioDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  portfolioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  portfolioDotActive: {
    width: 24,
    backgroundColor: '#4ECDC4',
  },

  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    justifyContent: 'center',
  },
  viewerCloseButton: {
    position: 'absolute',
    right: 18,
    top: Platform.OS === 'android' ? 30 : 54,
    zIndex: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerScroll: {
    flex: 1,
  },
  viewerSlide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  viewerImage: {
    width: '100%',
    height: '72%',
  },
  viewerVideoFrame: {
    width: '100%',
    height: '62%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  viewerWebView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  viewerFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 36,
    alignItems: 'center',
    gap: 10,
  },
  viewerCounter: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  viewerDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  viewerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  viewerDotActive: {
    width: 22,
    backgroundColor: '#4ECDC4',
  },

  /* Availability Preview */
  availabilityCard: {
    backgroundColor: LingoTheme.colors.surfaceAlt,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
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
  backButton: { marginTop: 20 },

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
  messageButton: { width: 140 },
  bookButton: { flex: 1 },
});