import { StyleSheet, View, ScrollView, TouchableOpacity, Alert, Image, Platform, RefreshControl } from 'react-native';
import { SkeletonScreen } from '@/components/ui/skeleton';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { useSafePadding } from '@/hooks/use-safe-padding';
import { NotificationStatusCard } from '@/components/ui/notification-status-card';

interface TeacherProfile {
  full_name: string;
  email: string;
  bio: string;
  subjects: string[];
  hourly_rate: number;
  rating: number;
  verification_status: string;
  gender: string;
  avatar_url?: string;
}

export default function TeacherProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { topPadding, bottomPadding } = useSafePadding();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async (mode: 'initial' | 'refresh' = 'initial') => {
    try {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      const response = await fetch(api.teacherProfile(user.id));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load profile');
      setProfile(data.profile);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => loadProfile('refresh');

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) await signOut();
    } else {
      Alert.alert('Logout', 'Are you sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: async () => await signOut() },
      ]);
    }
  };

  if (loading) return <SkeletonScreen />;

  const isVerified = profile?.verification_status === 'approved';

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + (Platform.OS === 'ios' ? 120 : 100) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />}
      >
        {/* ── Top Bar ── */}
        <View style={[styles.headerWrap, { paddingTop: topPadding }]}>
          <View style={styles.topBar}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.topBarTitle}>My Profile</ThemedText>
              <ThemedText style={styles.topBarSub}>{isVerified ? '✅ Verified Teacher' : '⏳ Pending Verification'}</ThemedText>
            </View>
            <TouchableOpacity style={styles.editButton} onPress={() => router.push('/(teacher)/edit-profile')} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={22} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Stat Pills ── */}
        <View style={styles.pillsRow}>
          <View style={styles.metricPill}>
            <ThemedText style={styles.pillEmoji}>💰</ThemedText>
            <ThemedText style={styles.pillValue}>${profile?.hourly_rate || 0}</ThemedText>
            <ThemedText style={styles.pillLabel}>HOURLY</ThemedText>
          </View>
          <View style={styles.metricPill}>
            <ThemedText style={styles.pillEmoji}>⭐</ThemedText>
            <ThemedText style={styles.pillValue}>{profile?.rating?.toFixed(1) || 'New'}</ThemedText>
            <ThemedText style={styles.pillLabel}>RATING</ThemedText>
          </View>
          <View style={styles.metricPill}>
            <ThemedText style={styles.pillEmoji}>{isVerified ? '✅' : '⏳'}</ThemedText>
            <ThemedText style={styles.pillValue}>{isVerified ? 'Active' : 'Pending'}</ThemedText>
            <ThemedText style={styles.pillLabel}>STATUS</ThemedText>
          </View>
        </View>
        {/* ── Profile Hero Card ── */}
        <View style={styles.heroCard}>
          <View style={styles.avatarWrapper}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <ThemedText style={styles.avatarText}>
                  {profile?.full_name?.charAt(0) || 'T'}
                </ThemedText>
              </View>
            )}
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={12} color="#FFF" />
              </View>
            )}
          </View>
          <ThemedText style={styles.userName}>{profile?.full_name || 'Teacher'}</ThemedText>
          <ThemedText style={styles.userEmail}>{profile?.email}</ThemedText>
          {(profile?.gender || (profile?.subjects && profile.subjects.length > 0)) && (
            <View style={styles.tagsRow}>
              {profile?.gender ? (
                <View style={styles.tag}><ThemedText style={styles.tagText}>{profile.gender}</ThemedText></View>
              ) : null}
              {profile?.subjects?.slice(0, 2).map((sub: string, i: number) => (
                <View key={i} style={styles.tag}><ThemedText style={styles.tagText}>{sub}</ThemedText></View>
              ))}
            </View>
          )}
        </View>

        <NotificationStatusCard
          title="Teacher notifications"
          subtitle="Get instant alerts for bookings, live classes, student updates, and messages."
        />

        {/* ── Settings Menu ── */}
        <View style={styles.menuCard}>
          <ThemedText style={styles.menuHeader}>Settings</ThemedText>

          <TouchableOpacity style={styles.menuRow} onPress={() => router.push('/(teacher)/my-profile')}>
            <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="briefcase-outline" size={20} color="#10B981" />
            </View>
            <ThemedText style={styles.menuText}>View My Portfolio</ThemedText>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} onPress={() => router.push('/(teacher)/edit-profile')}>
            <View style={[styles.iconBox, { backgroundColor: '#FFF7D6' }]}>
              <Ionicons name="person-outline" size={20} color="#F59E0B" />
            </View>
            <ThemedText style={styles.menuText}>Edit Profile</ThemedText>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} onPress={() => router.push('/(teacher)/availability')}>
            <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="calendar-outline" size={20} color="#3B82F6" />
            </View>
            <ThemedText style={styles.menuText}>Manage Availability</ThemedText>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} onPress={() => router.push('/(teacher)/performance-analytics')}>
            <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="bar-chart-outline" size={20} color="#22C55E" />
            </View>
            <ThemedText style={styles.menuText}>Performance Analytics</ThemedText>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuRow, { borderBottomWidth: 0 }]} onPress={() => router.push('/(teacher)/payout-settings' as any)}>
            <View style={[styles.iconBox, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="wallet-outline" size={20} color="#EF4444" />
            </View>
            <ThemedText style={styles.menuText}>Payout Settings</ThemedText>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        {/* ── Support & Account Menu ── */}
        <View style={styles.menuCard}>
          <ThemedText style={styles.menuHeader}>Support & Account</ThemedText>

          <TouchableOpacity style={styles.menuRow} onPress={() => router.push('/(teacher)/notifications')}>
            <View style={[styles.iconBox, { backgroundColor: '#F5F3FF' }]}>
              <Ionicons name="notifications-outline" size={20} color="#8B5CF6" />
            </View>
            <ThemedText style={styles.menuText}>Notifications</ThemedText>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow}>
            <View style={[styles.iconBox, { backgroundColor: '#F0F9FF' }]}>
              <Ionicons name="help-circle-outline" size={20} color="#0EA5E9" />
            </View>
            <ThemedText style={styles.menuText}>Help & Support</ThemedText>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuRow, { borderBottomWidth: 0 }]} onPress={handleLogout}>
            <View style={[styles.iconBox, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            </View>
            <ThemedText style={[styles.menuText, { color: '#EF4444' }]}>Logout</ThemedText>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },

  /* ── Top Bar ── */
  headerWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  topBarTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  topBarSub: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '400',
    marginTop: 2,
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── Pills Row ── */
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  metricPill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  pillEmoji: {
    fontSize: 18,
  },
  pillValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  pillLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },

  /* ── Scroll ── */
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, gap: 16 },

  /* ── Hero Card ── */
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    padding: 24,
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 14,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#F59E0B',
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF7D6',
  },
  avatarText: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFF',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#10B981',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 14,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  tag: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },

  /* ── Menu Card ── */
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  menuHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 6,
    marginLeft: 2,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
});
