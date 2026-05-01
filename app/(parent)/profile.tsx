import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
  RefreshControl,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { useSafePadding } from '@/hooks/use-safe-padding';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SkeletonScreen } from '@/components/ui/skeleton';
import { NotificationStatusCard } from '@/components/ui/notification-status-card';

interface ParentProfile {
  full_name: string;
  email: string;
  role: string;
  avatar_url?: string;
}

interface ParentStats {
  children: number;
  activeClasses: number;
  teachers: number;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { topPadding, bottomPadding } = useSafePadding();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [stats, setStats] = useState<ParentStats>({ children: 0, activeClasses: 0, teachers: 0 });

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async (mode: 'initial' | 'refresh' = 'initial') => {
    try {
      if (!user?.id) { setLoading(false); return; }
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);

      const accessToken = await AsyncStorage.getItem('access_token');
      if (!accessToken) throw new Error('No token');

      const response = await fetch(api.parentProfile(user.id), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load profile');

      setProfile(data.profile);
      if (data.stats) setStats(data.stats);
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

  // First letter from real DB name — never hardcoded
  const avatarLetter = profile?.full_name?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <View style={styles.container}>
      {/* ── Top Bar ── */}
      <View style={[styles.topBar, { paddingTop: topPadding + 8 }]}>
        <View style={styles.iconCircle}>
          <Ionicons name="people-circle-outline" size={24} color="#58CC02" />
        </View>
        <View style={styles.topBarCenter}>
          <ThemedText style={styles.topBarTitle}>Profile</ThemedText>
          <ThemedText style={styles.topBarSub} numberOfLines={1}>
            {profile?.full_name ?? 'My Account'}
          </ThemedText>
        </View>
        <TouchableOpacity style={styles.iconCircle} onPress={() => router.push('/(parent)/edit-profile')}>
          <Ionicons name="create-outline" size={22} color="#58CC02" />
        </TouchableOpacity>
      </View>

      {/* ── Stat Pills ── */}
      <View style={styles.pillsRow}>
        <View style={styles.metricPill}>
          <ThemedText style={styles.pillEmoji}>👨‍👩‍👧</ThemedText>
          <ThemedText style={styles.pillValue}>{stats.children}</ThemedText>
          <ThemedText style={styles.pillLabel}>CHILDREN</ThemedText>
        </View>
        <View style={styles.metricPill}>
          <ThemedText style={styles.pillEmoji}>📚</ThemedText>
          <ThemedText style={styles.pillValue}>{stats.activeClasses}</ThemedText>
          <ThemedText style={styles.pillLabel}>CLASSES</ThemedText>
        </View>
        <View style={styles.metricPill}>
          <ThemedText style={styles.pillEmoji}>🎓</ThemedText>
          <ThemedText style={styles.pillValue}>{stats.teachers}</ThemedText>
          <ThemedText style={styles.pillLabel}>TEACHERS</ThemedText>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + (Platform.OS === 'ios' ? 120 : 100) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#58CC02" />}
      >
        {/* ── Profile Hero Card (all data from DB) ── */}
        <View style={styles.heroCard}>
          <View style={styles.avatarWrapper}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <ThemedText style={styles.avatarText}>{avatarLetter}</ThemedText>
              </View>
            )}
          </View>
          <ThemedText style={styles.userName}>{profile?.full_name ?? '—'}</ThemedText>
          <ThemedText style={styles.userEmail}>{profile?.email ?? ''}</ThemedText>
          <View style={styles.roleBadge}>
            <ThemedText style={styles.roleText}>👨‍👩‍👧 Parent Account</ThemedText>
          </View>
        </View>

        <NotificationStatusCard
          title="Family notifications"
          subtitle="Receive reminders about upcoming classes, teacher messages, and booking updates."
        />

        {/* ── Account Menu ── */}
        <View style={styles.menuCard}>
          <ThemedText style={styles.menuHeader}>Account</ThemedText>

          <TouchableOpacity style={styles.menuRow} onPress={() => router.push('/(parent)/edit-profile')}>
            <View style={[styles.iconBox, { backgroundColor: '#ECFCD8' }]}>
              <Ionicons name="person-outline" size={20} color="#58CC02" />
            </View>
            <ThemedText style={styles.menuText}>Edit Profile</ThemedText>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow}>
            <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="card-outline" size={20} color="#3B82F6" />
            </View>
            <ThemedText style={styles.menuText}>Payment Methods</ThemedText>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuRow, { borderBottomWidth: 0 }]} onPress={() => router.push('/(parent)/notifications')}>
            <View style={[styles.iconBox, { backgroundColor: '#F5F3FF' }]}>
              <Ionicons name="notifications-outline" size={20} color="#8B5CF6" />
            </View>
            <ThemedText style={styles.menuText}>Notifications</ThemedText>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        {/* ── Support Menu ── */}
        <View style={styles.menuCard}>
          <ThemedText style={styles.menuHeader}>Support</ThemedText>

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
  container: { flex: 1, backgroundColor: '#F7F7F7' },

  /* ── Top Bar ── */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#F7F7F7',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFCD8',
    borderWidth: 2,
    borderColor: '#58CC02',
    borderBottomWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarCenter: { flex: 1, alignItems: 'center' },
  topBarTitle: { fontSize: 18, fontWeight: '800', color: '#111827', letterSpacing: -0.3 },
  topBarSub: { fontSize: 12, color: '#6B7280', fontWeight: '500', marginTop: 1 },

  /* ── Pills ── */
  pillsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
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
  pillEmoji: { fontSize: 18 },
  pillValue: { fontSize: 14, fontWeight: '800', color: '#111827' },
  pillLabel: { fontSize: 9, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5 },

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
  avatarWrapper: { position: 'relative', marginBottom: 14 },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#58CC02',
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#58CC02',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ECFCD8',
  },
  avatarText: { fontSize: 38, fontWeight: '800', color: '#FFF' },
  userName: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 },
  userEmail: { fontSize: 13, color: '#6B7280', marginBottom: 14 },
  roleBadge: {
    backgroundColor: '#ECFCD8',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleText: { fontSize: 12, color: '#15803D', fontWeight: '700' },

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
  menuText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1F2937' },
});
