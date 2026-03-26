import { StyleSheet, View, ScrollView, TouchableOpacity, Platform, Alert, RefreshControl } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { LinearGradient } from 'expo-linear-gradient';
import { Fonts } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SkeletonScreen } from '@/components/ui/skeleton';
import { RateTeacherModal } from '@/components/rate-teacher-modal';

interface ClassSession {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  status: string;
  live_status?: string;
  teacher_name?: string;
  subject?: string;
  students: { name: string };
  courses: {
    title: string;
    teacher_id: string;
    teachers: {
      profiles: { full_name: string };
    };
  };
}

export default function ClassesScreen() {
  const router = useRouter();
  const { user, signOut, refreshSession } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allClasses, setAllClasses] = useState<ClassSession[]>([]);
  const [upcomingClasses, setUpcomingClasses] = useState<ClassSession[]>([]);
  const [pastClasses, setPastClasses] = useState<ClassSession[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const authFailedRef = useRef(false);
  const [serverNowBaseMs, setServerNowBaseMs] = useState<number | null>(null);
  const [serverPerfBaseMs, setServerPerfBaseMs] = useState<number | null>(null);
  const [renderTick, setRenderTick] = useState(0);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedClassForRating, setSelectedClassForRating] = useState<{
    sessionId: string;
    teacherId: string;
    teacherName: string;
  } | null>(null);

  // Keep time-based UI (Upcoming/History) dynamic even on web where focus events
  // can be unreliable depending on navigation/container.
  useEffect(() => {
    const tickId = setInterval(() => {
      // Trigger re-render; actual "now" is computed from server_now + monotonic elapsed.
      setRenderTick((t) => (t + 1) % 1_000_000);
    }, 30000);
    return () => clearInterval(tickId);
  }, []);

  useEffect(() => {
    // Initial load (mount)
    loadClasses('initial');
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Reload on focus and keep it fresh while the user stays on this screen
      if (authFailedRef.current) return;
      loadClasses('background');
      const intervalId = setInterval(() => {
        if (!authFailedRef.current) loadClasses('background');
      }, 20000);

      return () => {
        clearInterval(intervalId);
      };
    }, [user?.id])
  );

  useEffect(() => {
    const graceMs = 30 * 60 * 1000;
    const perfNow = (globalThis as any)?.performance?.now?.();
    const hasServerClock = typeof serverNowBaseMs === 'number' && typeof serverPerfBaseMs === 'number' && typeof perfNow === 'number';
    const nowMs = hasServerClock
      ? (serverNowBaseMs as number) + (perfNow as number) - (serverPerfBaseMs as number)
      : Date.now();

    const upcoming = allClasses
      .filter((c) => {
        const status = String(c.status || '').toLowerCase();
        const liveStatus = String(c.live_status || '').toLowerCase();
        if (liveStatus === 'live') return true;
        if (status === 'completed' || status === 'cancelled') return false;
        const startMs = new Date(c.scheduled_date).getTime();
        if (!Number.isFinite(startMs)) return false;
        return nowMs <= startMs + graceMs;
      })
      .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

    const past = allClasses
      .filter((c) => {
        const status = String(c.status || '').toLowerCase();
        const liveStatus = String(c.live_status || '').toLowerCase();
        if (liveStatus === 'live') return false;
        if (status === 'completed' || status === 'cancelled') return true;
        const startMs = new Date(c.scheduled_date).getTime();
        if (!Number.isFinite(startMs)) return true;
        return nowMs > startMs + graceMs;
      })
      .sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime());

    setUpcomingClasses(upcoming);
    setPastClasses(past);
  }, [allClasses, serverNowBaseMs, serverPerfBaseMs, renderTick]);

  const loadClasses = async (
    mode: 'initial' | 'refresh' | 'background' = 'background',
    allowRefresh: boolean = true
  ) => {
    try {
      if (authFailedRef.current) return;
      if (!user?.id) return;

      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);

      const accessToken = await AsyncStorage.getItem('access_token');
      if (!accessToken) {
        authFailedRef.current = true;
        await signOut();
        return;
      }

      const response = await fetch(api.parentClasses(user.id), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          if (allowRefresh) {
            try {
              await refreshSession();
              return loadClasses(mode, false);
            } catch {
              // fall through
            }
          }
          authFailedRef.current = true;
          await signOut();
          return;
        }
        throw new Error(data?.error || `Failed to load classes (${response.status})`);
      }
      
      const allClasses = data.classes || [];
      setAllClasses(allClasses);
      const serverNowIso = typeof data.server_now === 'string' ? data.server_now : '';
      const parsed = serverNowIso ? new Date(serverNowIso).getTime() : NaN;
      if (Number.isFinite(parsed)) {
        const perfNow = (globalThis as any)?.performance?.now?.();
        setServerNowBaseMs(parsed);
        setServerPerfBaseMs(typeof perfNow === 'number' ? perfNow : null);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      if (mode === 'initial') setLoading(false);
      if (mode === 'refresh') setRefreshing(false);
    }
  };

  // Get user's actual timezone based on system offset (works even when browser spoofs Intl API)
  const getUserTimezone = () => {
    const offsetMinutes = new Date().getTimezoneOffset();
    const offsetHours = -offsetMinutes / 60;
    // Map common offsets to timezone names
    const tzMap: Record<number, string> = {
      5: 'Asia/Karachi',      // PKT
      5.5: 'Asia/Kolkata',    // IST
      0: 'UTC',
      1: 'Europe/London',     // BST
      '-5': 'America/New_York', // EST
      '-8': 'America/Los_Angeles', // PST
    };
    return tzMap[offsetHours] || Intl.DateTimeFormat().resolvedOptions().timeZone;
  };

  const formatDate = (dateStr: string) => {
    const utcDate = new Date(dateStr);
    // Use browser's local timezone
    return utcDate.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const utcDate = new Date(dateStr);
    // Use browser's local timezone - toLocaleTimeString automatically converts
    return utcDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true,
    });
  };

  const isClassJoinable = (classItem: ClassSession) => {
    // Check live_status first - if teacher marked it live, always joinable
    const liveStatus = String(classItem.live_status || '').toLowerCase();
    if (liveStatus === 'live') return true;
    
    const status = String(classItem.status || '').toLowerCase();
    if (status === 'completed' || status === 'cancelled' || liveStatus === 'ended') {
      return false;
    }
    
    // Allow joining within time window: 10 min before start to end of class + 30 min
    const now = Date.now();
    const classStart = new Date(classItem.scheduled_date).getTime();
    const duration = classItem.duration_minutes || 60;
    const classEnd = classStart + duration * 60 * 1000;
    const earliestJoin = classStart - 10 * 60 * 1000; // 10 min before
    const latestJoin = classEnd + 30 * 60 * 1000; // 30 min after end
    
    return now >= earliestJoin && now <= latestJoin;
  };

  const handleRateTeacher = (classItem: ClassSession) => {
    setSelectedClassForRating({
      sessionId: classItem.id,
      teacherId: classItem.courses?.teacher_id || '',
      teacherName: classItem.courses?.teachers?.profiles?.full_name || 'Teacher',
    });
    setRatingModalVisible(true);
  };

  const handleRatingSuccess = () => {
    // Reload classes to update any state if needed
    loadClasses('background');
  };

  const renderClassCard = (classItem: ClassSession, isPast: boolean = false) => {
    const joinable = !isPast && isClassJoinable(classItem);
    // Calculate minutes left until class starts
    const now = new Date();
    const classDateTime = new Date(classItem.scheduled_date);
    const diffMinutes = Math.floor((classDateTime.getTime() - now.getTime()) / (1000 * 60));
    let joinWarning = '';
    const status = String(classItem.status || '').toLowerCase();
    const isScheduled = status === 'upcoming' || status === 'confirmed';
    const isCompleted = status === 'completed';
    const isCancelled = status === 'cancelled';

    if (!isPast && !joinable && isScheduled) {
      if (diffMinutes > 0) {
        joinWarning = `Scheduled. You can join once the teacher starts.`;
      } else if (diffMinutes < -60) {
        joinWarning = `Class has ended.`;
      } else {
        joinWarning = `Waiting for teacher to start.`;
      }
    } else if (!isPast && !isScheduled) {
      joinWarning = `Class is not scheduled yet.`;
    }

    const statusLabel = isScheduled ? 'scheduled' : (isCompleted ? 'completed' : (isCancelled ? 'cancelled' : status));

    return (
      <View key={classItem.id} style={[styles.classCard, isPast && styles.classCardPast]}>
        <View style={styles.cardHeader}>
          <View style={styles.teacherInfo}>
             <View style={[styles.avatar, isPast && styles.avatarPast]}>
                <ThemedText style={styles.avatarText}>
                  {classItem.courses?.teachers?.profiles?.full_name?.charAt(0) || 'T'}
                </ThemedText>
             </View>
             <View>
                <ThemedText style={[styles.teacherName, isPast && styles.textPast]}>
                  {classItem.courses?.teachers?.profiles?.full_name || 'Teacher'}
                </ThemedText>
                <ThemedText style={[styles.subjectName, isPast && styles.textPast]}>
                  {classItem.courses?.title || 'Private Tutoring'}
                </ThemedText>
             </View>
          </View>
          <View style={[
            styles.statusBadge, 
            isScheduled ? styles.statusConfirmed :
            isCompleted ? styles.statusCompleted :
            styles.statusPending
          ]}>
            <ThemedText style={[
               styles.statusText,
               isScheduled ? styles.textConfirmed :
               isCompleted ? styles.textCompleted :
               styles.textPending
            ]}>
              {statusLabel}
            </ThemedText>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailsRow}>
           <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={16} color={isPast ? "#9CA3AF" : "#4ECDC4"} />
              <ThemedText style={[styles.detailText, isPast && styles.textPast]}>
                {formatDate(classItem.scheduled_date)}
              </ThemedText>
           </View>
           <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={16} color={isPast ? "#9CA3AF" : "#4ECDC4"} />
              <ThemedText style={[styles.detailText, isPast && styles.textPast]}>
                {formatTime(classItem.scheduled_date)}
              </ThemedText>
           </View>
           <View style={styles.detailItem}>
              <Ionicons name="hourglass-outline" size={16} color={isPast ? "#9CA3AF" : "#4ECDC4"} />
              <ThemedText style={[styles.detailText, isPast && styles.textPast]}>
                {classItem.duration_minutes} min
              </ThemedText>
           </View>
        </View>

        {!isPast && (
          <>
            <TouchableOpacity 
              style={[styles.joinButton, !joinable && styles.joinButtonDisabled]}
              disabled={!joinable}
              activeOpacity={0.8}
              onPress={() => router.push({
                pathname: '/class-room/[id]',
                params: { id: classItem.id }
              })}
            >
              <LinearGradient
                colors={joinable ? ['#4ECDC4', '#2BCBBA'] : ['#E5E7EB', '##E5E7EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.joinButtonGradient}
              >
                <ThemedText style={[styles.joinButtonText, !joinable && styles.joinButtonTextDisabled]}>
                  {joinable ? 'Join Class Now' : 'Join Not Available'}
                </ThemedText>
                {joinable && <Ionicons name="videocam" size={18} color="#FFF" />}
              </LinearGradient>
            </TouchableOpacity>
            {joinWarning !== '' && (
              <ThemedText style={{ color: '#F59E0B', marginTop: 6, textAlign: 'center', fontSize: 13 }}>
                {joinWarning}
              </ThemedText>
            )}
          </>
        )}
        
        {isPast && isCompleted && (
          <TouchableOpacity 
            style={styles.rateButton}
            activeOpacity={0.8}
            onPress={() => handleRateTeacher(classItem)}
          >
            <Ionicons name="star-outline" size={18} color="#4ECDC4" />
            <ThemedText style={styles.rateButtonText}>Rate This Class</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return <SkeletonScreen />;
  }

  const displayClasses = activeTab === 'upcoming' ? upcomingClasses : pastClasses;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>My Classes</ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          Manage your schedule and history
        </ThemedText>
      </View>

      {/* Custom Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'upcoming' && styles.tabActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
            Upcoming
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'past' && styles.tabActive]}
          onPress={() => setActiveTab('past')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
            History
          </ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadClasses('refresh')}
          />
        }
      >
        {displayClasses.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBg}>
               <Ionicons 
                 name={activeTab === 'upcoming' ? "calendar-clear-outline" : "time-outline"} 
                 size={40} 
                 color="#9CA3AF" 
               />
            </View>
            <ThemedText style={styles.emptyTitle}>
              {activeTab === 'upcoming' ? 'No Upcoming Classes' : 'No Class History'}
            </ThemedText>
            <ThemedText style={styles.emptyText}>
              {activeTab === 'upcoming' 
                ? 'Your scheduled classes will appear here.'
                : 'Classes you complete will be listed here.'
              }
            </ThemedText>
            {activeTab === 'upcoming' && (
               <TouchableOpacity 
                 style={styles.bookBtn}
                 onPress={() => router.push('/(parent)/browse-teachers')}
               >
                 <ThemedText style={styles.bookBtnText}>Book a Teacher</ThemedText>
               </TouchableOpacity>
            )}
          </View>
        ) : (
          displayClasses.map(item => renderClassCard(item, activeTab === 'past'))
        )}
      </ScrollView>

      {/* Rating Modal */}
      {selectedClassForRating && (
        <RateTeacherModal
          visible={ratingModalVisible}
          onClose={() => {
            setRatingModalVisible(false);
            setSelectedClassForRating(null);
          }}
          onSuccess={handleRatingSuccess}
          teacherId={selectedClassForRating.teacherId}
          teacherName={selectedClassForRating.teacherName}
          sessionId={selectedClassForRating.sessionId}
        />
      )}
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: Fonts.rounded,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },

  /* Tabs */
  tabContainer: {
    flexDirection: 'row',
    margin: 20,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#111827',
  },

  /* Scroll Content */
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  /* Class Card */
  classCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  classCardPast: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    shadowOpacity: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  teacherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPast: {
    backgroundColor: '#D1D5DB',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  teacherName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  subjectName: {
    fontSize: 13,
    color: '#6B7280',
  },
  textPast: {
    color: '#9CA3AF',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusConfirmed: {
    backgroundColor: '#D1FAE5',
  },
  statusCompleted: {
    backgroundColor: '#F3F4F6',
  },
  statusPending: {
    backgroundColor: '#FFF7ED',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  textConfirmed: { color: '#059669' },
  textCompleted: { color: '#6B7280' },
  textPending: { color: '#C2410C' },

  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },

  /* Join Button */
  joinButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  joinButtonDisabled: {
    opacity: 0.8,
  },
  joinButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  joinButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  joinButtonTextDisabled: {
    color: '#9CA3AF',
  },

  /* Rate Button */
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
    backgroundColor: '#F0FDFA',
    gap: 8,
  },
  rateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4ECDC4',
  },

  /* Empty State */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
  },
  bookBtn: {
    marginTop: 24,
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  bookBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
});