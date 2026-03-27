import { StyleSheet, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { BackButton } from '@/components/back-button';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { SkeletonScreen } from '@/components/ui/skeleton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/lib/auth-context';

const cleanDisplayText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  let cleaned = value.trim();
  if (!cleaned) return null;

  cleaned = cleaned
    .replace(/\bundefined\b/gi, '')
    .replace(/\bnull\b/gi, '')
    .replace(/\s*[-–—]\s*$/g, '')
    .replace(/\s*[-–—]\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[-,\s]+|[-,\s]+$/g, '');

  return cleaned || null;
};

interface Session {
  id: string;
  session_date: string;
  duration_minutes: number;
  status: string;
  courses: {
    title: string;
    profiles: {
      full_name: string;
    };
  };
}

interface Enrollment {
  id: string;
  course_id: string;
  courses: {
    id: string;
    title: string;
    description: string;
    profiles: {
      full_name: string;
    };
  };
}

export default function ChildProfileScreen() {
  const { id, name } = useLocalSearchParams();
  const router = useRouter();
  const { user, refreshSession, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [childData, setChildData] = useState<any>(null);
  const [progress, setProgress] = useState({
    completedClasses: 0,
    enrollments: [] as Enrollment[],
    upcomingSessions: [] as Session[],
  });

  useEffect(() => {
    fetchChildData();
  }, [id]);

  const fetchChildData = async (allowRefresh: boolean = true) => {
    try {
      setLoading(true);
      const accessToken = await AsyncStorage.getItem('access_token');
      if (!accessToken) {
        throw new Error('No token');
      }

      const response = await fetch(api.childProfile(id as string), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await response.json();

      if (response.status === 401) {
        if (allowRefresh) {
          try {
            await refreshSession();
            return fetchChildData(false);
          } catch {
            // fall through
          }
        }
        await signOut();
        return;
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch child data');
      }
      
      setChildData(data.child);
      setProgress({
        completedClasses: data.progress?.completedClasses || 0,
        enrollments: data.progress?.enrollments || [],
        upcomingSessions: data.progress?.upcomingSessions || [],
      });
    } catch (err: any) {
      console.error('Error fetching child:', err);
      const msg = String(err?.message || 'Failed to fetch child data');
      if (msg === 'No token') {
        Alert.alert('Login required', 'Please login again.');
        await signOut();
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10B981';
      case 'upcoming': return '#4ECDC4';
      case 'cancelled': return '#EF4444';
      default: return '#4ECDC4';
    }
  };

  const confirmDeleteChild = () => {
    if (progress.enrollments.length > 0) {
      Alert.alert('Cannot Delete Child', 'This child is currently enrolled in courses and cannot be deleted.');
      return;
    }

    Alert.alert(
      'Delete Child',
      `Are you sure you want to delete ${displayName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: handleDeleteChild,
        },
      ]
    );
  };

  const handleDeleteChild = async () => {
    if (!user?.id || !id || deleting) return;

    const isChildOwner = Boolean(
      childData?.parent_id &&
      user.id === String(childData.parent_id) &&
      (user.role === 'parent' || user.role === 'admin')
    );

    if (!isChildOwner) {
      Alert.alert('Not Allowed', 'Only the child\'s parent can delete this child profile.');
      return;
    }

    try {
      setDeleting(true);
      const accessToken = await AsyncStorage.getItem('access_token');
      if (!accessToken) {
        throw new Error('No token');
      }

      const parentIdForDelete = String(childData?.parent_id || user.id);
      const response = await fetch(api.deleteChild(parentIdForDelete, String(id)), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (response.status === 409) {
        Alert.alert('Cannot Delete Child', data.error || 'This child is currently enrolled in courses.');
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete child');
      }

      Alert.alert('Deleted', `${displayName} has been deleted successfully.`);
      router.back();
    } catch (err: any) {
      const msg = String(err?.message || 'Failed to delete child');
      if (msg === 'No token') {
        Alert.alert('Login required', 'Please login again.');
        await signOut();
        return;
      }
      Alert.alert('Delete Failed', msg);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <SkeletonScreen />;
  }

  if (error || !childData) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ThemedText style={styles.errorText}>{error || 'Child not found'}</ThemedText>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <ThemedText style={styles.retryButtonText}>Go Back</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  const displayName = childData?.name || name || 'Child';
  const canDeleteChild = Boolean(
    user?.id &&
    childData?.parent_id &&
    user.id === String(childData.parent_id) &&
    (user.role === 'parent' || user.role === 'admin')
  );

  const hasStudentCredentials = Boolean(childData?.profile_id);

  const openStudentCredentialFlow = () => {
    if (!id) return;

    if (hasStudentCredentials) {
      Alert.alert(
        'Student account linked',
        `${displayName} already has student login credentials. Please login with the student's email/password to open student dashboard.`
      );
      return;
    }

    router.push({
      pathname: '/signup-student',
      params: {
        studentId: String(id),
        fullName: String(displayName),
      },
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton />
        <ThemedText style={styles.headerTitle}>{displayName}'s Profile</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Child Info Card */}
        <View style={styles.section}>
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <ThemedText style={styles.avatarText}>
                  {displayName.charAt(0).toUpperCase()}
                </ThemedText>
              </View>
            </View>
            <View style={styles.profileInfo}>
              <ThemedText style={styles.profileName}>{displayName}</ThemedText>
              <ThemedText style={styles.profileAge}>
                Age: {childData.age || 'N/A'}
              </ThemedText>
              {childData.subjects && childData.subjects.length > 0 && (
                <View style={styles.subjectTags}>
                  {childData.subjects.map((subject: string, index: number) => (
                    <View key={index} style={styles.subjectTag}>
                      <ThemedText style={styles.subjectTagText}>{subject}</ThemedText>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <ThemedText style={styles.statValue}>{progress.completedClasses}</ThemedText>
              <ThemedText style={styles.statLabel}>Classes Completed</ThemedText>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="book" size={24} color="#4ECDC4" />
              <ThemedText style={styles.statValue}>{progress.enrollments.length}</ThemedText>
              <ThemedText style={styles.statLabel}>Active Courses</ThemedText>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="calendar" size={24} color="#F59E0B" />
              <ThemedText style={styles.statValue}>{progress.upcomingSessions.length}</ThemedText>
              <ThemedText style={styles.statLabel}>Upcoming</ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.studentPortalCard}>
            <View style={styles.studentPortalHeader}>
              <Ionicons name="school-outline" size={20} color="#4ECDC4" />
              <ThemedText style={styles.studentPortalTitle}>Student Portal</ThemedText>
            </View>
            <ThemedText style={styles.studentPortalText}>
              {hasStudentCredentials
                ? `${displayName} can login as student and view dashboard, upcoming classes, and recorded courses.`
                : `Create ${displayName}'s student credentials to enable child login and student dashboard.`}
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.studentPortalButton,
                hasStudentCredentials ? styles.studentPortalButtonLinked : null,
              ]}
              onPress={openStudentCredentialFlow}
            >
              <ThemedText style={styles.studentPortalButtonText}>
                {hasStudentCredentials ? 'Student Login Linked' : 'Create Student Login'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Upcoming Classes */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Upcoming Classes</ThemedText>
          
          {progress.upcomingSessions.length > 0 ? (
            progress.upcomingSessions.map((session) => (
              <View key={session.id} style={styles.sessionCard}>
                <View style={styles.sessionInfo}>
                  <ThemedText style={styles.sessionTitle}>
                    {cleanDisplayText(session.courses?.title) || 'Class Session'}
                  </ThemedText>
                  <ThemedText style={styles.sessionTeacher}>
                    with {cleanDisplayText(session.courses?.profiles?.full_name) || 'Teacher'}
                  </ThemedText>
                  <ThemedText style={styles.sessionDate}>
                    {new Date(session.session_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </ThemedText>
                </View>
                <View style={[styles.sessionBadge, { backgroundColor: getStatusColor(session.status) }]}>
                  <ThemedText style={styles.sessionBadgeText}>
                    {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                  </ThemedText>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
              <ThemedText style={styles.emptyStateText}>No upcoming classes scheduled</ThemedText>
              <TouchableOpacity 
                style={styles.browseButton}
                onPress={() => router.push('/(parent)/browse-teachers')}>
                <ThemedText style={styles.browseButtonText}>Book a Teacher</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Enrolled Courses */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Enrolled Courses</ThemedText>
          
          {progress.enrollments.length > 0 ? (
            progress.enrollments.map((enrollment) => (
              <View key={enrollment.id} style={styles.courseCard}>
                <View style={styles.courseIcon}>
                  <Ionicons name="book" size={20} color="#4ECDC4" />
                </View>
                <View style={styles.courseInfo}>
                  <ThemedText style={styles.courseTitle}>
                    {cleanDisplayText(enrollment.courses?.title) || 'Course'}
                  </ThemedText>
                  <ThemedText style={styles.courseTeacher}>
                    Teacher: {cleanDisplayText(enrollment.courses?.profiles?.full_name) || 'N/A'}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="school-outline" size={48} color="#D1D5DB" />
              <ThemedText style={styles.emptyStateText}>Not enrolled in any courses yet</ThemedText>
              <ThemedText style={styles.emptyStateHint}>
                Book a teacher to start learning
              </ThemedText>
            </View>
          )}
        </View>

        {canDeleteChild && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
              onPress={confirmDeleteChild}
              disabled={deleting}
            >
              <ThemedText style={styles.deleteButtonText}>
                {deleting ? 'Deleting...' : 'Delete Child'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  profileAge: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  subjectTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectTag: {
    backgroundColor: '#E8FAF8',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subjectTagText: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  studentPortalCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  studentPortalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  studentPortalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  studentPortalText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
  studentPortalButton: {
    marginTop: 12,
    backgroundColor: '#4ECDC4',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  studentPortalButtonLinked: {
    backgroundColor: '#0EA5E9',
  },
  studentPortalButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyState: {
    backgroundColor: '#F9FAFB',
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
  },
  emptyStateHint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
  },
  browseButton: {
    marginTop: 16,
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  sessionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  sessionTeacher: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  sessionDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  sessionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  sessionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  courseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  courseIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8FAF8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  courseInfo: {
    flex: 1,
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  courseTeacher: {
    fontSize: 13,
    color: '#6B7280',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteButtonDisabled: {
    backgroundColor: '#FCA5A5',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  bottomPadding: {
    height: 100,
  },
});
