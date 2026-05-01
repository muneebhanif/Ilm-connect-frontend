import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, TouchableOpacity, View, Image } from 'react-native';
import { StudentProfileSkeleton } from '@/components/ui/dashboard-skeletons';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/config';
import { authFetch } from '@/lib/auth-fetch';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NotificationStatusCard } from '@/components/ui/notification-status-card';
import { Fonts, LingoTheme } from '@/constants/theme';

export default function StudentProfileScreen() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, [user?.id]);

  const loadProfile = async () => {
    if (!user?.id) return;
    try {
      const response = await authFetch(api.studentProfile(user.id));
      const data = await response.json();
      if (response.ok) setProfile(data.student || null);
    } catch (error) {
      console.error('Failed to load student profile', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const doLogout = async () => {
      try {
        await signOut();
      } catch (error) {
        console.error('Logout error:', error);
      }
    };

    if (Platform.OS === 'web') {
      try {
        const confirmed = window.confirm('Are you sure you want to logout?');
        if (confirmed) await doLogout();
      } catch {
        // Fallback if window.confirm fails
        await doLogout();
      }
    } else {
      Alert.alert('Logout', 'Are you sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  if (loading) {
    return <StudentProfileSkeleton />;
  }

  const name = profile?.name || user?.full_name || 'Student';
  const email = profile?.email || user?.email || '—';
  const age = profile?.age ?? '—';
  const attendancePercentage = Number(profile?.attendance_percentage || 0);
  const attendedClasses = Number(profile?.total_classes_attended || 0);
  const totalScheduledClasses = Number(profile?.total_classes_scheduled || 0);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <LinearGradient
          colors={['#0F766E', '#14B8A6', '#2DD4BF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Image
                source={{
                  uri: profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0F766E&color=fff&bold=true&size=128`,
                }}
                style={styles.avatarImage}
              />
            </View>
          </View>
          <ThemedText style={styles.profileName}>{name}</ThemedText>
          <ThemedText style={styles.profileEmail}>{email}</ThemedText>
        </LinearGradient>

        {/* Profile Details */}
        <View style={styles.contentPad}>
          <ThemedText style={styles.sectionTitle}>Profile Details</ThemedText>
          
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="person" size={18} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.detailLabel}>Full Name</ThemedText>
                <ThemedText style={styles.detailValue}>{name}</ThemedText>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="mail" size={18} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.detailLabel}>Email</ThemedText>
                <ThemedText style={styles.detailValue}>{email}</ThemedText>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="calendar" size={18} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.detailLabel}>Age</ThemedText>
                <ThemedText style={styles.detailValue}>{age} years</ThemedText>
              </View>
            </View>
          </View>

          <NotificationStatusCard title="Learning reminders" subtitle="Get notified before classes, new recordings, and teacher updates." />

          {/* Learning Stats */}
          <ThemedText style={styles.sectionTitle}>Learning Stats</ThemedText>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="book" size={20} color="#059669" />
              </View>
              <ThemedText style={styles.statValue}>{profile?.surahs_memorized || 0}</ThemedText>
              <ThemedText style={styles.statLabel}>Surahs</ThemedText>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#F5F3FF' }]}>
                <Ionicons name="mic" size={20} color="#7C3AED" />
              </View>
              <ThemedText style={styles.statValue}>{profile?.tajweed_mastery || 0}%</ThemedText>
              <ThemedText style={styles.statLabel}>Tajweed</ThemedText>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="flame" size={20} color="#D97706" />
              </View>
              <ThemedText style={styles.statValue}>{profile?.current_streak || 0}</ThemedText>
              <ThemedText style={styles.statLabel}>Streak</ThemedText>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#DBEAFE' }]}> 
                <Ionicons name="analytics" size={20} color="#2563EB" />
              </View>
              <ThemedText style={styles.statValue}>{attendancePercentage}%</ThemedText>
              <ThemedText style={styles.statLabel}>Attendance</ThemedText>
            </View>
          </View>

          <View style={styles.attendanceCard}>
            <View style={styles.attendanceHeader}>
              <ThemedText style={styles.sectionTitle}>Attendance</ThemedText>
              <View style={styles.attendancePill}>
                <ThemedText style={styles.attendancePillText}>{attendancePercentage}%</ThemedText>
              </View>
            </View>
            <View style={styles.attendanceSummaryRow}>
              <View style={styles.attendanceSummaryBox}>
                <ThemedText style={styles.attendanceSummaryValue}>{attendedClasses}</ThemedText>
                <ThemedText style={styles.attendanceSummaryLabel}>Classes taken</ThemedText>
              </View>
              <View style={styles.attendanceSummaryBox}>
                <ThemedText style={styles.attendanceSummaryValue}>{Math.max(totalScheduledClasses - attendedClasses, 0)}</ThemedText>
                <ThemedText style={styles.attendanceSummaryLabel}>Missed</ThemedText>
              </View>
              <View style={styles.attendanceSummaryBox}>
                <ThemedText style={styles.attendanceSummaryValue}>{totalScheduledClasses}</ThemedText>
                <ThemedText style={styles.attendanceSummaryLabel}>Completed</ThemedText>
              </View>
            </View>
          </View>

          {/* Actions */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
            <ThemedText style={styles.logoutText}>Logout</ThemedText>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LingoTheme.colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
  },

  /* Header */
  header: {
    paddingTop: 70,
    paddingBottom: 32,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },

  /* Content */
  contentPad: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Fonts.rounded,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    marginBottom: 14,
  },

  /* Detail Card */
  detailCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    borderBottomWidth: 4,
    ...LingoTheme.shadow.card,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
    marginLeft: 54,
  },

  /* Stats */
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    borderBottomWidth: 4,
    ...LingoTheme.shadow.card,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '600',
  },
  attendanceCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    borderBottomWidth: 4,
    ...LingoTheme.shadow.card,
  },
  attendanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  attendancePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  attendancePillText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '800',
  },
  attendanceSummaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  attendanceSummaryBox: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: LingoTheme.colors.border,
  },
  attendanceSummaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  attendanceSummaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },

  /* Logout */
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: '#FCA5A5',
    borderBottomWidth: 4,
    borderRadius: 20,
    paddingVertical: 14,
    gap: 8,
  },
  logoutText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '700',
  },
});
