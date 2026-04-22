import { StyleSheet, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { SkeletonScreen } from '@/components/ui/skeleton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/lib/auth-context';
import { LingoBadge, LingoButton, LingoCard, LingoEmptyState, LingoScreenHeader, LingoStatPill } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';

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

interface AttendanceSummary {
  totalClasses: number;
  attendedClasses: number;
  missedClasses: number;
  attendancePercentage: number;
  recentAttendance: Array<{
    session_id: string;
    session_date: string;
    status: string;
    attended: boolean;
    course_title: string;
  }>;
}

export default function ChildProfileScreen() {
  const { id, name } = useLocalSearchParams();
  const router = useRouter();
  const { user, refreshSession, signOut } = useAuth();
  const { topPadding, bottomPadding } = useSafePadding();
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [childData, setChildData] = useState<any>(null);
  const [progress, setProgress] = useState({
    completedClasses: 0,
    enrollments: [] as Enrollment[],
    upcomingSessions: [] as Session[],
    attendanceSummary: {
      totalClasses: 0,
      attendedClasses: 0,
      missedClasses: 0,
      attendancePercentage: 0,
      recentAttendance: [],
    } as AttendanceSummary,
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
        attendanceSummary: data.progress?.attendanceSummary || {
          totalClasses: 0,
          attendedClasses: 0,
          missedClasses: 0,
          attendancePercentage: 0,
          recentAttendance: [],
        },
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
        <LingoCard style={styles.errorCard}>
          <LingoEmptyState icon="alert-circle-outline" title="Child not found" subtitle={error || 'This child profile could not be loaded.'} tone="danger" />
          <LingoButton label="Go back" variant="secondary" onPress={() => router.back()} style={styles.retryButton} />
        </LingoCard>
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
      <View style={[styles.header, { paddingTop: topPadding }]}>
        <LingoScreenHeader
          title={`${displayName}'s profile`}
          subtitle="View learning progress, classes, and portal access for this child account."
          badge="Child profile"
          icon="happy-outline"
          onBack={() => router.back()}
        >
          <View style={styles.headerStats}>
            <LingoStatPill icon="✅" value={String(progress.completedClasses)} label="Completed" tone="primary" />
            <LingoStatPill icon="📚" value={String(progress.enrollments.length)} label="Courses" tone="teal" />
            <LingoStatPill icon="🎯" value={`${progress.attendanceSummary.attendancePercentage}%`} label="Attendance" tone="gold" />
          </View>
        </LingoScreenHeader>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPadding + 24 }}>
        <View style={styles.section}>
          <LingoCard style={styles.profileCard}>
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
                    <LingoBadge key={index} label={subject} icon="book-outline" tone="teal" />
                  ))}
                </View>
              )}
            </View>
          </LingoCard>
        </View>

        <View style={styles.section}>
          <View style={styles.statsRow}>
            <LingoCard style={styles.statItem}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <ThemedText style={styles.statValue}>{progress.completedClasses}</ThemedText>
              <ThemedText style={styles.statLabel}>Classes Completed</ThemedText>
            </LingoCard>
            <LingoCard style={styles.statItem}>
              <Ionicons name="book" size={24} color="#4ECDC4" />
              <ThemedText style={styles.statValue}>{progress.enrollments.length}</ThemedText>
              <ThemedText style={styles.statLabel}>Active Courses</ThemedText>
            </LingoCard>
            <LingoCard style={styles.statItem}>
              <Ionicons name="calendar" size={24} color="#F59E0B" />
              <ThemedText style={styles.statValue}>{progress.attendanceSummary.attendedClasses}/{progress.attendanceSummary.totalClasses}</ThemedText>
              <ThemedText style={styles.statLabel}>Attendance</ThemedText>
            </LingoCard>
          </View>
        </View>

        <View style={styles.section}>
          <LingoCard style={styles.attendanceCard}>
            <View style={styles.attendanceHeader}>
              <View>
                <ThemedText style={styles.sectionTitle}>Attendance snapshot</ThemedText>
                <ThemedText style={styles.attendanceHint}>Parents can quickly check how many classes this child attended.</ThemedText>
              </View>
              <LingoBadge label={`${progress.attendanceSummary.attendancePercentage}%`} icon="analytics-outline" tone="gold" />
            </View>

            <View style={styles.attendanceSummaryRow}>
              <View style={styles.attendanceSummaryItem}>
                <ThemedText style={styles.attendanceSummaryValue}>{progress.attendanceSummary.attendedClasses}</ThemedText>
                <ThemedText style={styles.attendanceSummaryLabel}>Taken</ThemedText>
              </View>
              <View style={styles.attendanceSummaryItem}>
                <ThemedText style={styles.attendanceSummaryValue}>{progress.attendanceSummary.missedClasses}</ThemedText>
                <ThemedText style={styles.attendanceSummaryLabel}>Missed</ThemedText>
              </View>
              <View style={styles.attendanceSummaryItem}>
                <ThemedText style={styles.attendanceSummaryValue}>{progress.attendanceSummary.totalClasses}</ThemedText>
                <ThemedText style={styles.attendanceSummaryLabel}>Total</ThemedText>
              </View>
            </View>

            {progress.attendanceSummary.recentAttendance.length > 0 ? (
              <View style={styles.attendanceList}>
                {progress.attendanceSummary.recentAttendance.slice(0, 4).map((item) => (
                  <View key={item.session_id} style={styles.attendanceRow}>
                    <View style={styles.attendanceRowInfo}>
                      <ThemedText style={styles.attendanceCourse}>{cleanDisplayText(item.course_title) || 'Class'}</ThemedText>
                      <ThemedText style={styles.attendanceDate}>
                        {new Date(item.session_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </ThemedText>
                    </View>
                    <LingoBadge
                      label={item.attended ? 'Present' : 'Absent'}
                      icon={item.attended ? 'checkmark-circle-outline' : 'close-circle-outline'}
                      tone={item.attended ? 'teal' : 'gold'}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <LingoEmptyState icon="analytics-outline" title="No attendance records yet" subtitle="Attendance will appear after completed classes." tone="primary" />
            )}
          </LingoCard>
        </View>

        <View style={styles.section}>
          <LingoCard style={styles.studentPortalCard}>
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
          </LingoCard>
        </View>

        {/* Upcoming Classes */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Upcoming Classes</ThemedText>
          
          {progress.upcomingSessions.length > 0 ? (
            progress.upcomingSessions.map((session) => (
              <LingoCard key={session.id} style={styles.sessionCard}>
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
              </LingoCard>
            ))
          ) : (
            <LingoCard>
              <LingoEmptyState icon="calendar-outline" title="No upcoming classes" subtitle="Book a teacher to schedule the next lesson for this child." tone="gold" />
              <LingoButton label="Book a teacher" onPress={() => router.push('/(parent)/browse-teachers')} style={styles.browseButton} />
            </LingoCard>
          )}
        </View>

        {/* Enrolled Courses */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Enrolled Courses</ThemedText>
          
          {progress.enrollments.length > 0 ? (
            progress.enrollments.map((enrollment) => (
              <LingoCard key={enrollment.id} style={styles.courseCard}>
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
              </LingoCard>
            ))
          ) : (
            <LingoCard>
              <LingoEmptyState icon="school-outline" title="No courses yet" subtitle="Book a teacher to start learning and track course progress here." tone="teal" />
            </LingoCard>
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
    backgroundColor: LingoTheme.colors.background,
  },
  errorCard: { width: '100%', maxWidth: 340 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    flexWrap: 'wrap',
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
    padding: 20,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: LingoTheme.colors.primary,
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
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    marginBottom: 4,
  },
  profileAge: {
    fontSize: 14,
    color: LingoTheme.colors.muted,
    marginBottom: 8,
  },
  subjectTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: LingoTheme.colors.muted,
    textAlign: 'center',
  },
  studentPortalCard: {
    padding: 16,
  },
  studentPortalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  studentPortalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
  },
  studentPortalText: {
    fontSize: 13,
    color: LingoTheme.colors.muted,
    lineHeight: 20,
  },
  studentPortalButton: {
    marginTop: 12,
    backgroundColor: LingoTheme.colors.primary,
    paddingVertical: 10,
    borderRadius: 14,
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
  browseButton: { marginTop: 16 },
  attendanceCard: {
    padding: 16,
  },
  attendanceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  attendanceHint: {
    fontSize: 13,
    color: LingoTheme.colors.muted,
    lineHeight: 19,
    marginTop: 4,
  },
  attendanceSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  attendanceSummaryItem: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    backgroundColor: LingoTheme.colors.surfaceAlt,
    paddingVertical: 14,
    alignItems: 'center',
  },
  attendanceSummaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
  },
  attendanceSummaryLabel: {
    fontSize: 11,
    marginTop: 4,
    color: LingoTheme.colors.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  attendanceList: {
    gap: 10,
  },
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  attendanceRowInfo: {
    flex: 1,
  },
  attendanceCourse: {
    fontSize: 14,
    fontWeight: '700',
    color: LingoTheme.colors.ink,
  },
  attendanceDate: {
    fontSize: 12,
    color: LingoTheme.colors.muted,
    marginTop: 2,
  },
  sessionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: LingoTheme.colors.ink,
    marginBottom: 4,
  },
  sessionTeacher: {
    fontSize: 13,
    color: LingoTheme.colors.muted,
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
    padding: 16,
    marginBottom: 12,
  },
  courseIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LingoTheme.colors.softTeal,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  courseInfo: {
    flex: 1,
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: LingoTheme.colors.ink,
    marginBottom: 2,
  },
  courseTeacher: {
    fontSize: 13,
    color: LingoTheme.colors.muted,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: LingoTheme.colors.muted,
    marginBottom: 16,
  },
  retryButton: { marginTop: 20 },
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
