import { StyleSheet, View, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { LinearGradient } from 'expo-linear-gradient';
import { Fonts } from '@/constants/theme';

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
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      if (!user?.id) {
        router.replace('/login');
        return;
      }

      const response = await fetch(api.teacherProfile(user.id));
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load profile');
      }

      setProfile(data.profile);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) {
        await signOut();
      }
    } else {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Logout', 
            style: 'destructive',
            onPress: async () => await signOut()
          }
        ]
      );
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      
      {/* Header with Background */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
           <ThemedText style={styles.headerTitle}>My Profile</ThemedText>
           <TouchableOpacity onPress={() => router.push('/(teacher)/edit-profile')}>
              <Ionicons name="create-outline" size={24} color="#1F2937" />
           </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        
        {/* Profile Card Section */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <LinearGradient
                colors={['#FF6B6B', '#EE5A24']}
                style={styles.avatarPlaceholder}
              >
                <ThemedText style={styles.avatarText}>
                  {profile?.full_name?.charAt(0) || 'T'}
                </ThemedText>
              </LinearGradient>
            )}
            
            {profile?.verification_status === 'approved' && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={12} color="#FFF" />
              </View>
            )}
          </View>

          <ThemedText style={styles.userName}>{profile?.full_name || 'Teacher'}</ThemedText>
          <ThemedText style={styles.userEmail}>{profile?.email}</ThemedText>
          
          <View style={styles.tagsRow}>
             <View style={styles.tag}>
                <ThemedText style={styles.tagText}>{profile?.gender || 'N/A'}</ThemedText>
             </View>
             {profile?.subjects?.slice(0, 2).map((sub, i) => (
                <View key={i} style={styles.tag}>
                   <ThemedText style={styles.tagText}>{sub}</ThemedText>
                </View>
             ))}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <ThemedText style={styles.statValue}>${profile?.hourly_rate || 0}</ThemedText>
              <ThemedText style={styles.statLabel}>Hourly Rate</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={16} color="#F59E0B" />
                <ThemedText style={styles.statValue}>{profile?.rating?.toFixed(1) || 'New'}</ThemedText>
              </View>
              <ThemedText style={styles.statLabel}>Rating</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <ThemedText style={styles.statValue}>Active</ThemedText>
              <ThemedText style={styles.statLabel}>Status</ThemedText>
            </View>
          </View>
        </View>

        {/* Menu Options */}
        <View style={styles.menuContainer}>
          <ThemedText style={styles.menuHeader}>Settings</ThemedText>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/(teacher)/my-profile')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#E0F2F1' }]}>
              <Ionicons name="briefcase-outline" size={20} color="#00695C" />
            </View>
            <ThemedText style={styles.menuText}>View My Portfolio</ThemedText>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/(teacher)/edit-profile')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#F0FDFA' }]}>
              <Ionicons name="person-outline" size={20} color="#0D9488" />
            </View>
            <ThemedText style={styles.menuText}>Edit Profile</ThemedText>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/(teacher)/availability')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="calendar-outline" size={20} color="#EA580C" />
            </View>
            <ThemedText style={styles.menuText}>Manage Availability</ThemedText>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/(teacher)/performance-analytics')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="bar-chart-outline" size={20} color="#2563EB" />
            </View>
            <ThemedText style={styles.menuText}>Performance Analytics</ThemedText>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.iconBox, { backgroundColor: '#FDF2F8' }]}>
              <Ionicons name="wallet-outline" size={20} color="#DB2777" />
            </View>
            <ThemedText style={styles.menuText}>Payout Settings</ThemedText>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>
        </View>

        <View style={styles.menuContainer}>
          <ThemedText style={styles.menuHeader}>Support</ThemedText>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/(teacher)/notifications')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#F3F4F6' }]}>
              <Ionicons name="notifications-outline" size={20} color="#4B5563" />
            </View>
            <ThemedText style={styles.menuText}>Notifications</ThemedText>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.iconBox, { backgroundColor: '#F3F4F6' }]}>
              <Ionicons name="help-circle-outline" size={20} color="#4B5563" />
            </View>
            <ThemedText style={styles.menuText}>Help & Support</ThemedText>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            onPress={handleLogout}
          >
            <View style={[styles.iconBox, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            </View>
            <ThemedText style={[styles.menuText, { color: '#EF4444' }]}>Logout</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
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
  
  /* Header */
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    // No shadow here, letting content overlap or just flow
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: Fonts.rounded,
    fontWeight: '700',
    color: '#111827',
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },

  /* Profile Card */
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 24,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  tag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  
  /* Stats Row within Profile Card */
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#E5E7EB',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },

  /* Menus */
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  menuHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  
  bottomPadding: {
    height: 40,
  },
});