import { StyleSheet, View, ScrollView, TouchableOpacity, Image, Platform, Modal, Alert, RefreshControl } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/lib/auth-context';
import { AddChildModal } from '@/components/add-child-modal';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Fonts } from '@/constants/theme';
import { ParentDashboardSkeleton } from '@/components/ui/dashboard-skeletons';

// Interfaces remain untouched
interface Child {
  id: string;
  name: string;
  age: number;
  subjects_interested: string[];
  surahs_memorized?: number;
  tajweed_mastery?: number;
  total_classes_attended?: number;
  total_stars_earned?: number;
  current_streak?: number;
  avatar_url?: string;
}

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
    teachers: {
      profiles: { full_name: string };
    };
  };
}

interface Message {
  id: string;
  teacher_name: string;
  teacher_avatar?: string;
  preview: string;
  time: string;
}

interface Payment {
  id: string;
  live_status?: string;
  description: string;
  date: string;
  amount: number;
  status: string;
}

export default function ParentDashboard() {
  const router = useRouter();
  const { user, signOut, refreshSession } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true);
  const [children, setChildren] = useState<Child[]>([]);
  const [upcomingClasses, setUpcomingClasses] = useState<ClassSession[]>([]);
  const [pastClasses, setPastClasses] = useState<ClassSession[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState({ children: 0, activeClasses: 0, teachers: 0 });
  const [parentName, setParentName] = useState('Parent');
  const [parentId, setParentId] = useState<string | null>(null);
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [showChildrenModal, setShowChildrenModal] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const authFailedRef = useRef(false);
  const didInitialLoadRef = useRef(false);

  // Data fetching logic remains identical
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (!user?.id) return;
    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;
    loadDashboardData('initial');
  }, [isReady, user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user?.role === 'teacher') {
        router.replace('/(teacher)/teacher-dashboard');
        return;
      }
      if (isReady) {
        if (authFailedRef.current) return;
        loadDashboardData('background');
        const intervalId = setInterval(() => {
          if (!authFailedRef.current) loadDashboardData('background');
        }, 20000);

        return () => clearInterval(intervalId);
      }
      return;
    }, [isReady, user?.id, user?.role])
  );

  const loadDashboardData = async (
    mode: 'initial' | 'refresh' | 'background' = 'background',
    allowRefresh: boolean = true
  ) => {
    try {
      if (authFailedRef.current) return;
      if (!user?.id) {
        if (isReady) router.replace('/login');
        return;
      }

      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      setParentId(user.id);

      const accessToken = await AsyncStorage.getItem('access_token');
      if (!accessToken) {
        authFailedRef.current = true;
        await signOut();
        return;
      }
      const authHeaders = { Authorization: `Bearer ${accessToken}` };

      const profileRes = await fetch(api.parentProfile(user.id), { headers: authHeaders });
      if (profileRes.status === 401) {
        if (allowRefresh) {
          try {
            await refreshSession();
            return loadDashboardData(mode, false);
          } catch {
            // fall through
          }
        }
        authFailedRef.current = true;
        await signOut();
        return;
      }
      const profileData = await profileRes.json();
      
      if (profileData.profile) {
        setParentName(profileData.profile.full_name);
        setStats(profileData.stats);
      }

      const childrenRes = await fetch(api.parentChildren(user.id), { headers: authHeaders });
      if (childrenRes.status === 401) {
        if (allowRefresh) {
          try {
            await refreshSession();
            return loadDashboardData(mode, false);
          } catch {
            // fall through
          }
        }
        authFailedRef.current = true;
        await signOut();
        return;
      }
      const childrenData = await childrenRes.json();
      const childrenList = childrenData.children || [];
      setChildren(childrenList);
      if (childrenList.length > 0) {
        setSelectedChild(childrenList[0]);
      }

      const classesRes = await fetch(api.parentClasses(user.id), { headers: authHeaders });
      if (classesRes.status === 401) {
        if (allowRefresh) {
          try {
            await refreshSession();
            return loadDashboardData(mode, false);
          } catch {
            // fall through
          }
        }
        authFailedRef.current = true;
        await signOut();
        return;
      }
      const classesData = await classesRes.json();
      // Split classes into upcoming and past (closed)
      const allClasses = classesData.classes || [];
      const serverNowIso = typeof classesData.server_now === 'string' ? classesData.server_now : '';
      const parsedServerNowMs = serverNowIso ? new Date(serverNowIso).getTime() : NaN;
      // Use server time when available; avoids incorrect device clock.
      const nowMs = Number.isFinite(parsedServerNowMs) ? parsedServerNowMs : Date.now();
      const graceMs = 30 * 60 * 1000; // keep a missed class visible for 30 minutes after start
      const upcoming = allClasses.filter((c: ClassSession) => {
        const classDate = new Date(c.scheduled_date);
        const liveStatus = String(c.live_status || '').toLowerCase();
        if (liveStatus === 'live') return true;
        const status = String(c.status || '').toLowerCase();
        if (status === 'completed' || status === 'cancelled') return false;
        return nowMs <= classDate.getTime() + graceMs;
      });
      const past = allClasses.filter((c: ClassSession) => {
        const classDate = new Date(c.scheduled_date);
        const liveStatus = String(c.live_status || '').toLowerCase();
        if (liveStatus === 'live') return false;
        const status = String(c.status || '').toLowerCase();
        if (status === 'completed' || status === 'cancelled') return true;
        return nowMs > classDate.getTime() + graceMs;
      });
      setUpcomingClasses(upcoming);
      setPastClasses(past);

      setMessages([]);
      setPayments([]);

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      if (mode !== 'refresh') setLoading(false);
      if (mode === 'refresh') setRefreshing(false);
    }
  };

  if (loading) {
    return <ParentDashboardSkeleton />;
  }

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
    const tz = getUserTimezone();
    return utcDate.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      timeZone: tz
    });
  };

  const formatTime = (dateStr: string) => {
    const utcDate = new Date(dateStr);
    const tz = getUserTimezone();
    return utcDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      timeZone: tz
    });
  };

  // Helper for greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDashboardData('refresh')}
          />
        }
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View>
              <ThemedText style={styles.greetingText}>{getGreeting()},</ThemedText>
              <ThemedText style={styles.userNameText}>{parentName}</ThemedText>
            </View>
            <View style={styles.headerActions}>
               <TouchableOpacity
                 style={styles.iconButton}
                 onPress={() => {
                   setHasUnreadNotifications(false);
                   router.push('/(parent)/notifications');
                 }}
               >
                 <Ionicons name="notifications-outline" size={24} color="#1F2937" />
                 {hasUnreadNotifications && <View style={styles.notificationDot} />}
               </TouchableOpacity>
               <TouchableOpacity 
                 style={styles.profileButton}
                 onPress={() => router.push('/(parent)/profile')}
               >
                 <Image 
                   source={{ uri: 'https://ui-avatars.com/api/?name=' + parentName + '&background=4ECDC4&color=fff' }} 
                   style={styles.profileImage} 
                 />
               </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Child Progress Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
             <ThemedText style={styles.sectionTitle}>My Child</ThemedText>
             {children.length > 0 && (
               <TouchableOpacity onPress={() => setShowChildrenModal(true)}>
                  <ThemedText style={styles.seeAllText}>More Children</ThemedText>
               </TouchableOpacity>
             )}
          </View>
          
          {children.length > 1 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.childCarousel}
            >
              {children.map((child) => (
                <TouchableOpacity
                  key={child.id}
                  activeOpacity={0.9}
                  onPress={() => router.push({ pathname: '/child-profile/[id]', params: { id: child.id, name: child.name } })}
                  style={styles.childCardWrapper}
                >
                  <LinearGradient
                    colors={['#4ECDC4', '#2BCBBA']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.childCard, styles.childCardCarousel]}
                  >
                    <View style={styles.childCardTop}>
                      <View style={styles.childAvatarContainer}>
                        <View style={styles.childAvatar}>
                          <ThemedText style={styles.childAvatarText}>{child.name.charAt(0)}</ThemedText>
                        </View>
                      </View>
                      <View style={styles.childInfo}>
                        <ThemedText style={styles.childName}>{child.name}</ThemedText>
                        <ThemedText style={styles.childAge}>{child.age} years old</ThemedText>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color="#FFF" style={{ opacity: 0.8 }} />
                    </View>

                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <ThemedText style={styles.statValue}>{child.surahs_memorized || 0}</ThemedText>
                        <ThemedText style={styles.statLabel}>Surahs</ThemedText>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statItem}>
                        <ThemedText style={styles.statValue}>{child.total_classes_attended || 0}</ThemedText>
                        <ThemedText style={styles.statLabel}>Classes</ThemedText>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statItem}>
                        <ThemedText style={styles.statValue}>{child.tajweed_mastery || 0}%</ThemedText>
                        <ThemedText style={styles.statLabel}>Tajweed</ThemedText>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : selectedChild ? (
            <TouchableOpacity 
              activeOpacity={0.9}
              onPress={() => router.push({ pathname: '/child-profile/[id]', params: { id: selectedChild.id, name: selectedChild.name } })}
            >
              <LinearGradient
                colors={['#4ECDC4', '#2BCBBA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.childCard}
              >
                <View style={styles.childCardTop}>
                   <View style={styles.childAvatarContainer}>
                      <View style={styles.childAvatar}>
                        <ThemedText style={styles.childAvatarText}>{selectedChild.name.charAt(0)}</ThemedText>
                      </View>
                   </View>
                   <View style={styles.childInfo}>
                      <ThemedText style={styles.childName}>{selectedChild.name}</ThemedText>
                      <ThemedText style={styles.childAge}>{selectedChild.age} years old</ThemedText>
                   </View>
                   <Ionicons name="chevron-forward" size={24} color="#FFF" style={{ opacity: 0.8 }} />
                </View>

                <View style={styles.statsRow}>
                   <View style={styles.statItem}>
                      <ThemedText style={styles.statValue}>{selectedChild.surahs_memorized || 0}</ThemedText>
                      <ThemedText style={styles.statLabel}>Surahs</ThemedText>
                   </View>
                   <View style={styles.statDivider} />
                   <View style={styles.statItem}>
                      <ThemedText style={styles.statValue}>{selectedChild.total_classes_attended || 0}</ThemedText>
                      <ThemedText style={styles.statLabel}>Classes</ThemedText>
                   </View>
                   <View style={styles.statDivider} />
                   <View style={styles.statItem}>
                      <ThemedText style={styles.statValue}>{selectedChild.tajweed_mastery || 0}%</ThemedText>
                      <ThemedText style={styles.statLabel}>Tajweed</ThemedText>
                   </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.addChildCard}
              onPress={() => setShowAddChildModal(true)}
              activeOpacity={0.8}
            >
              <View style={styles.addChildIconCircle}>
                 <Ionicons name="add" size={32} color="#4ECDC4" />
              </View>
              <ThemedText style={styles.addChildTitle}>Add Child Profile</ThemedText>
              <ThemedText style={styles.addChildSubtitle}>Track progress and manage classes</ThemedText>
            </TouchableOpacity>
          )}
          {/* Children selector modal */}
          <Modal
            visible={showChildrenModal}
            animationType="slide"
            transparent
            onRequestClose={() => setShowChildrenModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <ThemedText style={styles.modalTitle}>My Children</ThemedText>
                <ScrollView style={{ maxHeight: 300 }}>
                  {children.map((child) => (
                    <TouchableOpacity
                      key={child.id}
                      style={styles.childRow}
                      onPress={() => {
                        setShowChildrenModal(false);
                        setSelectedChild(child);
                        // navigate to the child's profile
                        router.push({ pathname: '/child-profile/[id]', params: { id: child.id } });
                      }}
                    >
                      <View style={styles.childRowAvatar}>
                        <ThemedText style={styles.childAvatarTextSmall}>{child.name.charAt(0)}</ThemedText>
                      </View>
                      <ThemedText style={styles.childRowName}>{child.name}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalButton} onPress={() => { setShowChildrenModal(false); setShowAddChildModal(true); }}>
                    <ThemedText style={styles.modalButtonText}>Add Child</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalButton, styles.modalClose]} onPress={() => setShowChildrenModal(false)}>
                    <ThemedText style={[styles.modalButtonText, styles.modalCloseText]}>Close</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>

        {/* Upcoming Classes Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
             <ThemedText style={styles.sectionTitle}>Upcoming Classes</ThemedText>
             <TouchableOpacity>
               <ThemedText style={styles.seeAllText}>See Schedule</ThemedText>
             </TouchableOpacity>
          </View>
          {upcomingClasses.length === 0 ? (
            <View style={styles.emptyStateContainer}>
               <View style={styles.emptyIconBg}>
                  <Ionicons name="calendar-outline" size={28} color="#9CA3AF" />
               </View>
               <ThemedText style={styles.emptyStateTitle}>No upcoming classes</ThemedText>
               <ThemedText style={styles.emptyStateDesc}>Book a class to get started</ThemedText>
            </View>
          ) : (
            upcomingClasses.slice(0, 2).map((classItem) => {
              // Join button logic: only enabled 15 min before to 60 min after start, and status confirmed
              const classDateTime = new Date(classItem.scheduled_date);
              const now = new Date();
              const diffMinutes = (classDateTime.getTime() - now.getTime()) / (1000 * 60);
              const status = String(classItem.status || '').toLowerCase();
              const isScheduled = status === 'upcoming' || status === 'confirmed';
              const joinable = isScheduled && diffMinutes <= 15 && diffMinutes >= -60;
              return (
                <View key={classItem.id} style={styles.classCard}>
                   <View style={styles.classCardLeft}>
                      <View style={styles.dateBox}>
                         <ThemedText style={styles.dateDay}>{classDateTime.getDate()}</ThemedText>
                         <ThemedText style={styles.dateMonth}>
                           {classDateTime.toLocaleDateString('en-US', { month: 'short' })}
                         </ThemedText>
                      </View>
                   </View>
                   <View style={styles.classCardMiddle}>
                      <ThemedText style={styles.classTitle} numberOfLines={1}>
                        {classItem.courses?.title || 'Private Tutoring'}
                      </ThemedText>
                      <ThemedText style={styles.teacherName}>
                        w/ {classItem.courses?.teachers?.profiles?.full_name || 'Ustadh'}
                      </ThemedText>
                      <View style={styles.timeRow}>
                         <Ionicons name="time-outline" size={14} color="#6B7280" />
                         <ThemedText style={styles.timeText}>{formatTime(classItem.scheduled_date)}</ThemedText>
                      </View>
                   </View>
                   <View style={styles.classCardRight}>
                      <TouchableOpacity 
                        style={[styles.joinBtn, !joinable && { opacity: 0.5 }]}
                        disabled={!joinable}
                        onPress={() => joinable && router.push({
                          pathname: '/class-room/[id]',
                          params: { id: classItem.id }
                        })}
                      >
                        <ThemedText style={styles.joinBtnText}>{joinable ? 'Join' : 'Wait'}</ThemedText>
                      </TouchableOpacity>
                   </View>
                </View>
              );
            })
          )}
        </View>

        {/* Past/Closed Classes Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
             <ThemedText style={styles.sectionTitle}>History</ThemedText>
          </View>
          {pastClasses.length === 0 ? (
            <View style={styles.emptyStateContainer}>
               <View style={styles.emptyIconBg}>
                  <Ionicons name="time-outline" size={28} color="#9CA3AF" />
               </View>
               <ThemedText style={styles.emptyStateTitle}>No class history</ThemedText>
               <ThemedText style={styles.emptyStateDesc}>Completed or closed classes will appear here.</ThemedText>
            </View>
          ) : (
            pastClasses.slice(0, 2).map((classItem) => {
              const classDateTime = new Date(classItem.scheduled_date);
              // Show status as 'Closed' if ended, otherwise show real status
              const now = new Date();
              const ended = classDateTime < now;
              const statusLabel = ended ? 'Closed' : (classItem.status.charAt(0).toUpperCase() + classItem.status.slice(1));
              return (
                <View key={classItem.id} style={styles.classCard}>
                   <View style={styles.classCardLeft}>
                      <View style={styles.dateBox}>
                         <ThemedText style={styles.dateDay}>{classDateTime.getDate()}</ThemedText>
                         <ThemedText style={styles.dateMonth}>
                           {classDateTime.toLocaleDateString('en-US', { month: 'short' })}
                         </ThemedText>
                      </View>
                   </View>
                   <View style={styles.classCardMiddle}>
                      <ThemedText style={styles.classTitle} numberOfLines={1}>
                        {classItem.courses?.title || 'Quran Class'}
                      </ThemedText>
                      <ThemedText style={styles.teacherName}>
                        w/ {classItem.courses?.teachers?.profiles?.full_name || 'Ustadh'}
                      </ThemedText>
                      <View style={styles.timeRow}>
                         <Ionicons name="time-outline" size={14} color="#6B7280" />
                         <ThemedText style={styles.timeText}>{formatTime(classItem.scheduled_date)}</ThemedText>
                      </View>
                   </View>
                   <View style={styles.classCardRight}>
                      <View style={[{ backgroundColor: '#F59E0B', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }]}> 
                        <ThemedText style={{ color: '#FFF', fontWeight: 'bold', fontSize: 12 }}>{statusLabel}</ThemedText>
                      </View>
                   </View>
                </View>
              );
            })
          )}
        </View>

        {/* Recent Messages */}
        <View style={styles.sectionContainer}>
           <View style={styles.sectionHeaderRow}>
             <ThemedText style={styles.sectionTitle}>Messages</ThemedText>
           </View>

           {messages.length === 0 ? (
             <View style={styles.emptyStateContainerCompact}>
               <ThemedText style={styles.emptyStateTextCompact}>No new messages</ThemedText>
             </View>
           ) : (
             messages.map((msg) => (
               <TouchableOpacity key={msg.id} style={styles.messageRow}>
                  <View style={styles.messageAvatar}>
                     <Ionicons name="person" size={20} color="#9CA3AF" />
                  </View>
                  <View style={styles.messageBody}>
                     <View style={styles.messageTop}>
                        <ThemedText style={styles.msgName}>{msg.teacher_name}</ThemedText>
                        <ThemedText style={styles.msgTime}>{msg.time}</ThemedText>
                     </View>
                     <ThemedText style={styles.msgPreview} numberOfLines={1}>{msg.preview}</ThemedText>
                  </View>
               </TouchableOpacity>
             ))
           )}
        </View>

        {/* Recent Payments */}
        <View style={styles.sectionContainer}>
           <View style={styles.sectionHeaderRow}>
             <ThemedText style={styles.sectionTitle}>Recent Payments</ThemedText>
           </View>
           
           {payments.length === 0 ? (
             <View style={styles.emptyStateContainerCompact}>
               <ThemedText style={styles.emptyStateTextCompact}>No recent transactions</ThemedText>
             </View>
           ) : (
             payments.map((pay) => (
               <View key={pay.id} style={styles.paymentRow}>
                  <View style={styles.paymentIcon}>
                     <Ionicons name="receipt-outline" size={20} color="#4ECDC4" />
                  </View>
                  <View style={styles.paymentBody}>
                     <ThemedText style={styles.payDesc}>{pay.description}</ThemedText>
                     <ThemedText style={styles.payDate}>{pay.date}</ThemedText>
                  </View>
                  <View style={styles.paymentEnd}>
                     <ThemedText style={styles.payAmount}>${pay.amount.toFixed(2)}</ThemedText>
                     <ThemedText style={[styles.payStatus, { color: pay.status === 'Paid' ? '#10B981' : '#F59E0B' }]}>
                        {pay.status}
                     </ThemedText>
                  </View>
               </View>
             ))
           )}
        </View>
        
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <AddChildModal
        visible={showAddChildModal}
        onClose={() => setShowAddChildModal(false)}
        onSuccess={loadDashboardData}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB', // Light gray background for the whole screen
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  /* Header */
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
    fontWeight: '500',
  },
  userNameText: {
    fontSize: 22,
    fontFamily: Fonts.rounded,
    fontWeight: '700',
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },

  /* Sections */
  sectionContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  seeAllText: {
    fontSize: 14,
    color: '#4ECDC4',
    fontWeight: '600',
  },

  /* Child Card */
  childCard: {
    borderRadius: 24,
    padding: 20,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  childCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  childAvatarContainer: {
    marginRight: 16,
  },
  childAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  childAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 6,
  },
  childAge: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  /* Add Child Card */
  addChildCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  addChildIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E6FFFA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  addChildTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  addChildSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },

  /* Upcoming Classes */
  classCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'center',
  },
  classCardLeft: {
    marginRight: 16,
  },
  dateBox: {
    width: 50,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateDay: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  dateMonth: {
    fontSize: 11,
    color: '#6B7280',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  classCardMiddle: {
    flex: 1,
  },
  classTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  teacherName: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  classCardRight: {
    marginLeft: 12,
  },
  joinBtn: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  joinBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Empty States */
  emptyStateContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  emptyIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  emptyStateDesc: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  emptyStateContainerCompact: {
    padding: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  emptyStateTextCompact: {
    fontSize: 14,
    color: '#9CA3AF',
  },

  /* Messages List */
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  messageAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  messageBody: {
    flex: 1,
  },
  messageTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  msgName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  msgTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  msgPreview: {
    fontSize: 13,
    color: '#6B7280',
  },

  /* Payment List */
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E6FFFA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  paymentBody: {
    flex: 1,
  },
  payDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  payDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  paymentEnd: {
    alignItems: 'flex-end',
  },
  payAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  payStatus: {
    fontSize: 11,
    fontWeight: '600',
  },
  
  bottomSpacer: {
    height: 40,
  },
  childCarousel: {
    paddingHorizontal: 12,
  },
  childCardWrapper: {
    width: 320,
    marginRight: 12,
  },
  childCardCarousel: {
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  childRowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  childAvatarTextSmall: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  childRowName: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
    marginRight: 8,
  },
  modalButtonText: {
    color: '#FFF',
    fontWeight: '700',
  },
  modalClose: {
    backgroundColor: '#F3F4F6',
    marginRight: 0,
  },
  modalCloseText: {
    color: '#111827',
  },
});