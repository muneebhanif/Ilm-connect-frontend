import { StyleSheet, View, ScrollView, TouchableOpacity, TextInput, Image, ActivityIndicator, Modal, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AttendanceRecord {
  sessionId: string;
  date: string;
  courseName: string;
  status: string;
  attended: boolean;
}

interface AttendanceStats {
  total: number;
  attended: number;
  percentage: number;
}

const sanitizeText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  if (lowered === 'null' || lowered === 'undefined' || lowered === 'nan') return null;
  return trimmed;
};

const formatProgressValue = (value: unknown): string => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return '—';
  return `${Math.min(100, Math.round(numeric))}%`;
};

const getSessionUiStatus = (session: AttendanceRecord): 'completed' | 'upcoming' => {
  const rawStatus = sanitizeText(session.status)?.toLowerCase();
  if (rawStatus === 'completed') return 'completed';

  const sessionMs = new Date(session.date).getTime();
  if (Number.isFinite(sessionMs) && sessionMs <= Date.now()) {
    return 'completed';
  }

  return 'upcoming';
};

const formatSessionDate = (value: string): string => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
};

export default function StudentsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All'); // All, Active, Paused
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState<{
    attendance: AttendanceRecord[];
    stats: AttendanceStats;
  } | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    fetchStudents();
  }, [user]);

  const fetchStudents = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(api.teacherById(user.id) + '/students');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch students');
      setStudents(data.students || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  const openAttendanceModal = async (student: any) => {
    setSelectedStudent(student);
    setAttendanceModalVisible(true);
    setLoadingAttendance(true);
    
    try {
      const accessToken = await AsyncStorage.getItem('access_token');
      const res = await fetch(
        `${api.teacherById(user!.id)}/students/${student.id}/attendance`,
        {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch attendance');
      setAttendanceData(data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to fetch attendance');
    } finally {
      setLoadingAttendance(false);
    }
  };

  const markAttendance = async (sessionId: string, present: boolean) => {
    if (!selectedStudent || !user?.id) return;
    
    try {
      const accessToken = await AsyncStorage.getItem('access_token');
      const res = await fetch(
        `${api.teacherById(user.id)}/students/${selectedStudent.id}/attendance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ sessionId, present }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark attendance');
      
      // Update local state
      if (attendanceData) {
        const updated = attendanceData.attendance.map(a => 
          a.sessionId === sessionId ? { ...a, attended: present } : a
        );
        const attendedCount = updated.filter(a => a.attended && getSessionUiStatus(a) === 'completed').length;
        const completedCount = updated.filter(a => getSessionUiStatus(a) === 'completed').length;
        setAttendanceData({
          attendance: updated,
          stats: {
            total: completedCount,
            attended: attendedCount,
            percentage: completedCount > 0 ? Math.round((attendedCount / completedCount) * 100) : 0
          }
        });
      }
      
      Alert.alert('Success', `Attendance marked as ${present ? 'present' : 'absent'}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to mark attendance');
    }
  };

  const filteredStudents = students.filter(student =>
    (activeTab === 'All' || student.status === activeTab) &&
    (sanitizeText(student.name)?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const renderStudentCard = (student: any) => {
    const studentDisplayName = sanitizeText(student?.name) || 'Student';

    return (
    <TouchableOpacity 
      key={student.id} 
      style={styles.studentCard}
      activeOpacity={0.7}
      // onPress={() => router.push(`/student-details/${student.id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatarContainer}>
          <Image 
            source={{ uri: `https://ui-avatars.com/api/?name=${student.name || 'Student'}&background=E0F2FE&color=0284C7` }} 
            style={styles.avatar} 
          />
          <View style={[styles.statusDot, { backgroundColor: student.status === 'Active' ? '#10B981' : '#9CA3AF' }]} />
        </View>
        
        <View style={styles.headerInfo}>
          <ThemedText style={styles.studentName}>{studentDisplayName}</ThemedText>
          <ThemedText style={styles.courseName}>
            {sanitizeText(student.course) || '—'}
            {typeof student.age === 'number' && Number.isFinite(student.age) && student.age > 0 ? ` • ${student.age} y/o` : ''}
          </ThemedText>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>Attendance</ThemedText>
          <ThemedText style={styles.statValue}>{sanitizeText(student.attendance) || '—'}</ThemedText>
        </View>
        <View style={styles.verticalDivider} />
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>Progress</ThemedText>
          <ThemedText style={styles.statValue}>{formatProgressValue(student.progress)}</ThemedText>
        </View>
        <View style={styles.verticalDivider} />
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>Next Class</ThemedText>
          <ThemedText style={[styles.statValue, { fontSize: 13 }]}>{sanitizeText(student.nextClass) || '—'}</ThemedText>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => openAttendanceModal(student)}
          accessibilityRole="button"
          accessibilityLabel={`Mark attendance for ${studentDisplayName}`}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color="#4ECDC4" />
          <ThemedText style={[styles.actionText, { color: '#4ECDC4' }]}>Attendance</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.primaryAction]}
          onPress={() => {
            const parentId = sanitizeText(student?.parent_id) || String(student?.parent_id || '').trim();
            if (!parentId) {
              Alert.alert('Unavailable', 'Parent is not linked for this student yet.');
              return;
            }

            const parentName = sanitizeText(student?.parent_name) || 'Parent';
            router.push({
              pathname: '/chat/[id]' as any,
              params: { id: parentId, name: parentName, avatar: '' }
            });
          }}
          accessibilityRole="button"
          accessibilityLabel={`Message ${sanitizeText(student?.parent_name) || 'parent'} of ${studentDisplayName}`}
        >
          <ThemedText style={styles.primaryActionText}>Message Parent</ThemedText>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color="#FFF" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <ThemedText style={styles.headerTitle}>My Students</ThemedText>
          {/* Add button hidden - students are added via course enrollment */}
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search students..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabsContainer}>
          {['All', 'Active', 'Paused'].map((tab) => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <ThemedText style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 }}>
          <ActivityIndicator size="large" color="#FF6B6B" />
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="alert-circle-outline" size={32} color="#EF4444" />
          </View>
          <ThemedText style={styles.emptyTitle}>Error</ThemedText>
          <ThemedText style={styles.emptySubtitle}>{error}</ThemedText>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredStudents.length > 0 ? (
            filteredStudents.map(renderStudentCard)
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="people-outline" size={32} color="#9CA3AF" />
              </View>
              <ThemedText style={styles.emptyTitle}>No students found</ThemedText>
              <ThemedText style={styles.emptySubtitle}>
                Try adjusting your search or add a new student.
              </ThemedText>
            </View>
          )}
        </ScrollView>
      )}

      {/* Attendance Modal */}
      <Modal
        visible={attendanceModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAttendanceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                {(sanitizeText(selectedStudent?.name) || 'Student')}'s Attendance
              </ThemedText>
              <TouchableOpacity onPress={() => setAttendanceModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {loadingAttendance ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#4ECDC4" />
              </View>
            ) : attendanceData ? (
              <>
                {/* Stats Row */}
                <View style={styles.attendanceStatsRow}>
                  <View style={styles.attendanceStat}>
                    <ThemedText style={styles.attendanceStatValue}>
                      {attendanceData.stats.attended}/{attendanceData.stats.total}
                    </ThemedText>
                    <ThemedText style={styles.attendanceStatLabel}>Classes</ThemedText>
                  </View>
                  <View style={[styles.attendanceStat, styles.attendanceStatHighlight]}>
                    <ThemedText style={styles.attendanceStatValueHighlight}>
                      {attendanceData.stats.percentage}%
                    </ThemedText>
                    <ThemedText style={styles.attendanceStatLabelHighlight}>Rate</ThemedText>
                  </View>
                </View>

                {/* Sessions List */}
                <ScrollView style={styles.sessionsList} showsVerticalScrollIndicator={false}>
                  {attendanceData.attendance.length === 0 ? (
                    <ThemedText style={styles.noSessionsText}>No sessions yet</ThemedText>
                  ) : (
                    attendanceData.attendance.map((session) => {
                      const uiStatus = getSessionUiStatus(session);
                      return (
                      <View key={session.sessionId} style={styles.sessionItem}>
                        <View style={styles.sessionInfo}>
                          <ThemedText style={styles.sessionDate}>{formatSessionDate(session.date)}</ThemedText>
                          <ThemedText style={styles.sessionCourse}>{sanitizeText(session.courseName) || 'Class'}</ThemedText>
                          <ThemedText style={[
                            styles.sessionStatus,
                            uiStatus === 'completed' ? styles.statusCompleted : styles.statusUpcoming
                          ]}>
                            {uiStatus}
                          </ThemedText>
                        </View>
                        
                        {uiStatus === 'completed' && (
                          <TouchableOpacity
                            style={[
                              styles.attendanceToggle,
                              session.attended ? styles.attendancePresent : styles.attendanceAbsent
                            ]}
                            onPress={() => markAttendance(session.sessionId, !session.attended)}
                          >
                            <Ionicons 
                              name={session.attended ? "checkmark-circle" : "close-circle"} 
                              size={22} 
                              color={session.attended ? "#10B981" : "#EF4444"} 
                            />
                            <ThemedText style={[
                              styles.attendanceToggleText,
                              session.attended ? styles.presentText : styles.absentText
                            ]}>
                              {session.attended ? 'Present' : 'Absent'}
                            </ThemedText>
                          </TouchableOpacity>
                        )}
                        
                        {uiStatus === 'upcoming' && (
                          <View style={styles.upcomingBadge}>
                            <ThemedText style={styles.upcomingText}>Upcoming</ThemedText>
                          </View>
                        )}
                      </View>
                    )})
                  )}
                </ScrollView>
              </>
            ) : (
              <ThemedText style={styles.noSessionsText}>Failed to load attendance</ThemedText>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  
  /* Header & Search */
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: Fonts.rounded,
    fontWeight: '700',
    color: '#111827',
  },
  addButton: {
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    height: '100%',
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  activeTab: {
    backgroundColor: '#111827', // Black/Dark for active state
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FFFFFF',
  },

  /* List Area */
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  /* Student Card */
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  headerInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  courseName: {
    fontSize: 13,
    color: '#6B7280',
  },
  moreButton: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  verticalDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#F3F4F6',
    alignSelf: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  primaryAction: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  primaryActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  /* Empty State */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },

  /* Attendance Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalLoading: {
    padding: 40,
    alignItems: 'center',
  },
  attendanceStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  attendanceStat: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  attendanceStatHighlight: {
    backgroundColor: '#D1FAE5',
  },
  attendanceStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  attendanceStatValueHighlight: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10B981',
  },
  attendanceStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  attendanceStatLabelHighlight: {
    fontSize: 12,
    color: '#059669',
    marginTop: 4,
  },
  sessionsList: {
    maxHeight: 400,
  },
  noSessionsText: {
    textAlign: 'center',
    color: '#9CA3AF',
    padding: 20,
  },
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  sessionCourse: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  sessionStatus: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  statusCompleted: {
    color: '#10B981',
  },
  statusUpcoming: {
    color: '#F59E0B',
  },
  attendanceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  attendancePresent: {
    backgroundColor: '#D1FAE5',
  },
  attendanceAbsent: {
    backgroundColor: '#FEE2E2',
  },
  attendanceToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  presentText: {
    color: '#10B981',
  },
  absentText: {
    color: '#EF4444',
  },
  upcomingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  upcomingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },
});