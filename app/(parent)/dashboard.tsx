import { StyleSheet, View, ScrollView, TouchableOpacity, Image, Platform, Modal, RefreshControl, useWindowDimensions, ActivityIndicator } from 'react-native';
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
import { useSafePadding } from '@/hooks/use-safe-padding';
import { LingoBadge, LingoCard, LingoEmptyState, LingoScreenHeader, LingoStatPill } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';

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
  const { topPadding, bottomPadding } = useSafePadding();
  const { width: screenWidth } = useWindowDimensions();
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
  const headerInitial = (parentName || user?.full_name || 'P').trim().charAt(0).toUpperCase();
  const childCardWidth = Math.max(screenWidth - 48, 280);

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
      const allClasses = classesData.classes || [];
      const serverNowIso = typeof classesData.server_now === 'string' ? classesData.server_now : '';
      const parsedServerNowMs = serverNowIso ? new Date(serverNowIso).getTime() : NaN;
      const nowMs = Number.isFinite(parsedServerNowMs) ? parsedServerNowMs : Date.now();
      const graceMs = 30 * 60 * 1000;
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

  const getUserTimezone = () => {
    const offsetMinutes = new Date().getTimezoneOffset();
    const offsetHours = -offsetMinutes / 60;
    const tzMap: Record<number, string> = {
      5: 'Asia/Karachi',
      5.5: 'Asia/Kolkata',
      0: 'UTC',
      1: 'Europe/London',
      '-5': 'America/New_York',
      '-8': 'America/Los_Angeles',
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={LingoTheme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 28 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDashboardData('refresh')}
            tintColor={LingoTheme.colors.primary}
          />
        }
      >
        <View style={[styles.headerWrap, { paddingTop: topPadding }]}> 
          <LingoScreenHeader
            title={parentName}
            subtitle={`${getGreeting()} — keep classes, children, and messages on track.`}
            badge="Parent hub"
            icon="people-outline"
          >
            <View style={styles.headerStatsRow}>
              <LingoStatPill label="Children" value={String(stats.children)} icon="happy-outline" tone="teal" />
              <LingoStatPill label="Active" value={String(stats.activeClasses)} icon="calendar-outline" tone="gold" />
              <LingoStatPill label="Teachers" value={String(stats.teachers)} icon="school-outline" tone="primary" />
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => {
                  setHasUnreadNotifications(false);
                  router.push('/(parent)/notifications');
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="notifications-outline" size={20} color={LingoTheme.colors.ink} />
                {hasUnreadNotifications && <View style={styles.notificationDot} />}
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.profileButton}
                onPress={() => router.push('/(parent)/profile')}
                activeOpacity={0.8}
              >
                {user?.avatar_url ? (
                  <Image 
                    source={{ uri: user.avatar_url }} 
                    style={styles.profileImage} 
                  />
                ) : (
                  <LinearGradient
                    colors={[LingoTheme.colors.primary, LingoTheme.colors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.profileFallback}
                  >
                    <ThemedText style={styles.profileFallbackText}>{headerInitial}</ThemedText>
                  </LinearGradient>
                )}
              </TouchableOpacity>
            </View>
          </LingoScreenHeader>
        </View>

        {/* Child Progress Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
             <ThemedText style={styles.sectionTitle}>My Child</ThemedText>
             {children.length > 0 && (
               <TouchableOpacity onPress={() => setShowChildrenModal(true)} activeOpacity={0.8}>
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
                  style={[styles.childCardWrapper, { width: childCardWidth }]}
                >
                  <LinearGradient
                    colors={[LingoTheme.colors.teal, '#2BCBBA']}
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
                      <Ionicons name="chevron-forward" size={24} color={LingoTheme.colors.textInverse} style={{ opacity: 0.8 }} />
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
                colors={[LingoTheme.colors.teal, '#2BCBBA']}
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
                   <Ionicons name="chevron-forward" size={24} color={LingoTheme.colors.textInverse} style={{ opacity: 0.8 }} />
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
              <LingoEmptyState icon="person-add-outline" title="Add Child Profile" subtitle="Track progress and manage classes from one place." tone="teal" />
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
                        router.push({ pathname: '/child-profile/[id]', params: { id: child.id } });
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.childRowAvatar}>
                        <ThemedText style={styles.childAvatarTextSmall}>{child.name.charAt(0)}</ThemedText>
                      </View>
                      <ThemedText style={styles.childRowName}>{child.name}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalButton} onPress={() => { setShowChildrenModal(false); setShowAddChildModal(true); }} activeOpacity={0.8}>
                    <ThemedText style={styles.modalButtonText}>Add Child</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalButton, styles.modalClose]} onPress={() => setShowChildrenModal(false)} activeOpacity={0.8}>
                    <ThemedText style={[styles.modalButtonText, styles.modalCloseText]}>Close</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={styles.sectionTitle}>Quick Actions</ThemedText>
          </View>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(parent)/browse-courses')} activeOpacity={0.8}>
              <View style={[styles.quickActionIcon, { backgroundColor: LingoTheme.colors.softTeal }]}>  
                <Ionicons name="book-outline" size={22} color={LingoTheme.colors.teal} />
              </View>
              <ThemedText style={styles.quickActionLabel}>Courses</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(parent)/messages')} activeOpacity={0.8}>
              <View style={[styles.quickActionIcon, { backgroundColor: LingoTheme.colors.softPurple }]}>  
                <Ionicons name="chatbubbles-outline" size={22} color={LingoTheme.colors.secondary} />
              </View>
              <ThemedText style={styles.quickActionLabel}>Messages</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => setShowAddChildModal(true)} activeOpacity={0.8}>
              <View style={[styles.quickActionIcon, { backgroundColor: LingoTheme.colors.softGold }]}>  
                <Ionicons name="person-add-outline" size={22} color={LingoTheme.colors.gold} />
              </View>
              <ThemedText style={styles.quickActionLabel}>Add Child</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(parent)/profile')} activeOpacity={0.8}>
              <View style={[styles.quickActionIcon, { backgroundColor: LingoTheme.colors.softDanger }]}>  
                <Ionicons name="settings-outline" size={22} color={LingoTheme.colors.danger} />
              </View>
              <ThemedText style={styles.quickActionLabel}>Settings</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Upcoming Classes Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
             <ThemedText style={styles.sectionTitle}>Upcoming Classes</ThemedText>
             <TouchableOpacity onPress={() => router.push('/(parent)/browse-courses')} activeOpacity={0.8}>
               <ThemedText style={styles.seeAllText}>Browse</ThemedText>
             </TouchableOpacity>
          </View>
          {upcomingClasses.length === 0 ? (
            <LingoCard style={styles.emptyStateContainer}>
              <LingoEmptyState icon="calendar-outline" title="No upcoming classes" subtitle="Book a class to get started." tone="gold" />
            </LingoCard>
          ) : (
            upcomingClasses.slice(0, 2).map((classItem) => {
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
                         <Ionicons name="time-outline" size={14} color={LingoTheme.colors.textSecondary} />
                         <ThemedText style={styles.timeText}>{formatTime(classItem.scheduled_date)}</ThemedText>
                      </View>
                   </View>
                   <View style={styles.classCardRight}>
                      {joinable ? (
                        <View style={styles.statusBadgeLive}>
                          <View style={styles.liveDot} />
                          <ThemedText style={styles.statusBadgeLiveText}>Live Now</ThemedText>
                        </View>
                      ) : diffMinutes > 0 && diffMinutes <= 60 ? (
                        <View style={styles.statusBadgeSoon}>
                          <ThemedText style={styles.statusBadgeSoonText}>{Math.ceil(diffMinutes)}m</ThemedText>
                        </View>
                      ) : (
                        <View style={styles.statusBadgeScheduled}>
                          <ThemedText style={styles.statusBadgeScheduledText}>Scheduled</ThemedText>
                        </View>
                      )}
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
            <LingoCard style={styles.emptyStateContainer}>
              <LingoEmptyState icon="time-outline" title="No class history" subtitle="Completed or closed classes will appear here." tone="primary" />
            </LingoCard>
          ) : (
            pastClasses.slice(0, 2).map((classItem) => {
              const classDateTime = new Date(classItem.scheduled_date);
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
                         <Ionicons name="time-outline" size={14} color={LingoTheme.colors.textSecondary} />
                         <ThemedText style={styles.timeText}>{formatTime(classItem.scheduled_date)}</ThemedText>
                      </View>
                   </View>
                   <View style={styles.classCardRight}>
                      <View style={styles.statusBadgeClosed}>
                        <ThemedText style={styles.statusBadgeClosedText}>{statusLabel}</ThemedText>
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
             <LingoCard style={styles.emptyStateContainerCompact}>
               <LingoEmptyState icon="chatbubble-ellipses-outline" title="No new messages" subtitle="Fresh updates from teachers will appear here." tone="teal" />
             </LingoCard>
           ) : (
             messages.map((msg) => (
               <TouchableOpacity key={msg.id} style={styles.messageRow} onPress={() => router.push('/(parent)/messages')} activeOpacity={0.8}>
                  <View style={styles.messageAvatar}>
                     <Ionicons name="person" size={20} color={LingoTheme.colors.textTertiary} />
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
             <LingoCard style={styles.emptyStateContainerCompact}>
               <LingoEmptyState icon="wallet-outline" title="No recent transactions" subtitle="Recent payments will show up here." tone="primary" />
             </LingoCard>
           ) : (
             payments.map((pay) => (
               <View key={pay.id} style={styles.paymentRow}>
                  <View style={styles.paymentIcon}>
                     <Ionicons name="receipt-outline" size={20} color={LingoTheme.colors.teal} />
                  </View>
                  <View style={styles.paymentBody}>
                     <ThemedText style={styles.payDesc}>{pay.description}</ThemedText>
                     <ThemedText style={styles.payDate}>{pay.date}</ThemedText>
                  </View>
                  <View style={styles.paymentEnd}>
                     <ThemedText style={styles.payAmount}>${pay.amount.toFixed(2)}</ThemedText>
                     <ThemedText style={[styles.payStatus, { color: pay.status === 'Paid' ? LingoTheme.colors.success : LingoTheme.colors.warning }]}>
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
    backgroundColor: LingoTheme.colors.background,
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
  headerWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: LingoTheme.radius.pill,
    backgroundColor: LingoTheme.colors.surface,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: LingoTheme.radius.pill,
    backgroundColor: LingoTheme.colors.danger,
    borderWidth: 1.5,
    borderColor: LingoTheme.colors.surface,
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: LingoTheme.radius.pill,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    ...LingoTheme.shadow.card,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: LingoTheme.radius.pill,
  },
  profileFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileFallbackText: {
    fontSize: 20,
    fontWeight: '700',
    color: LingoTheme.colors.textInverse,
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
    color: LingoTheme.colors.text,
  },
  seeAllText: {
    fontSize: 14,
    color: LingoTheme.colors.teal,
    fontWeight: '600',
  },

  /* Child Card - Lingo Style */
  childCard: {
    borderRadius: LingoTheme.radius.lg,
    padding: 20,
    ...LingoTheme.shadow.elevated,
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
    borderRadius: LingoTheme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  childAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: LingoTheme.colors.textInverse,
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 20,
    fontWeight: '700',
    color: LingoTheme.colors.textInverse,
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
    borderRadius: LingoTheme.radius.md,
    padding: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: LingoTheme.colors.textInverse,
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

  /* Add Child Card - Lingo Style */
  addChildCard: {
    borderRadius: LingoTheme.radius.lg,
    padding: 32,
    backgroundColor: LingoTheme.colors.surface,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
  },

  /* Upcoming Classes - Lingo Style */
  classCard: {
    flexDirection: 'row',
    backgroundColor: LingoTheme.colors.surface,
    borderRadius: LingoTheme.radius.md,
    padding: 16,
    marginBottom: 12,
    ...LingoTheme.shadow.card,
    alignItems: 'center',
  },
  classCardLeft: {
    marginRight: 16,
  },
  dateBox: {
    width: 50,
    height: 54,
    borderRadius: LingoTheme.radius.sm,
    backgroundColor: LingoTheme.colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateDay: {
    fontSize: 18,
    fontWeight: '700',
    color: LingoTheme.colors.text,
  },
  dateMonth: {
    fontSize: 11,
    color: LingoTheme.colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  classCardMiddle: {
    flex: 1,
  },
  classTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: LingoTheme.colors.text,
    marginBottom: 2,
  },
  teacherName: {
    fontSize: 13,
    color: LingoTheme.colors.textSecondary,
    marginBottom: 6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: LingoTheme.colors.textSecondary,
    fontWeight: '500',
  },
  classCardRight: {
    marginLeft: 12,
  },

  /* Empty States - Lingo Style */
  emptyStateContainer: {
    padding: 32,
    borderRadius: LingoTheme.radius.md,
  },
  emptyStateContainerCompact: {
    padding: 20,
    borderRadius: LingoTheme.radius.md,
  },

  /* Quick Actions - Lingo Style */
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAction: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: LingoTheme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    ...LingoTheme.shadow.card,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: LingoTheme.colors.text,
  },

  /* Status Badges - Lingo Style */
  statusBadgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LingoTheme.colors.softPrimary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: LingoTheme.radius.sm,
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: LingoTheme.radius.pill,
    backgroundColor: LingoTheme.colors.success,
  },
  statusBadgeLiveText: {
    color: LingoTheme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadgeSoon: {
    backgroundColor: LingoTheme.colors.softGold,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: LingoTheme.radius.sm,
  },
  statusBadgeSoonText: {
    color: LingoTheme.colors.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadgeScheduled: {
    backgroundColor: LingoTheme.colors.softPurple,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: LingoTheme.radius.sm,
  },
  statusBadgeScheduledText: {
    color: LingoTheme.colors.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadgeClosed: {
    backgroundColor: LingoTheme.colors.softGold,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: LingoTheme.radius.sm,
  },
  statusBadgeClosedText: {
    color: LingoTheme.colors.gold,
    fontSize: 12,
    fontWeight: '700',
  },

  /* Messages List - Lingo Style */
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: LingoTheme.colors.surface,
    borderRadius: LingoTheme.radius.md,
    marginBottom: 10,
    ...LingoTheme.shadow.card,
  },
  messageAvatar: {
    width: 44,
    height: 44,
    borderRadius: LingoTheme.radius.pill,
    backgroundColor: LingoTheme.colors.borderLight,
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
    color: LingoTheme.colors.text,
  },
  msgTime: {
    fontSize: 12,
    color: LingoTheme.colors.textTertiary,
  },
  msgPreview: {
    fontSize: 13,
    color: LingoTheme.colors.textSecondary,
  },

  /* Payment List - Lingo Style */
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: LingoTheme.colors.surface,
    borderRadius: LingoTheme.radius.md,
    marginBottom: 10,
    ...LingoTheme.shadow.card,
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: LingoTheme.radius.sm,
    backgroundColor: LingoTheme.colors.softTeal,
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
    color: LingoTheme.colors.text,
    marginBottom: 2,
  },
  payDate: {
    fontSize: 12,
    color: LingoTheme.colors.textTertiary,
  },
  paymentEnd: {
    alignItems: 'flex-end',
  },
  payAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: LingoTheme.colors.text,
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
    paddingHorizontal: 4,
  },
  childCardWrapper: {
    marginRight: 12,
  },
  childCardCarousel: {
    width: '100%',
  },

  /* Modal - Lingo Style */
  modalOverlay: {
    flex: 1,
    backgroundColor: LingoTheme.colors.scrim,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: LingoTheme.colors.surface,
    padding: 20,
    borderTopLeftRadius: LingoTheme.radius.lg,
    borderTopRightRadius: LingoTheme.radius.lg,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: LingoTheme.colors.text,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: LingoTheme.colors.borderLight,
  },
  childRowAvatar: {
    width: 40,
    height: 40,
    borderRadius: LingoTheme.radius.pill,
    backgroundColor: LingoTheme.colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  childAvatarTextSmall: {
    fontSize: 16,
    fontWeight: '700',
    color: LingoTheme.colors.text,
  },
  childRowName: {
    fontSize: 16,
    color: LingoTheme.colors.text,
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
    borderRadius: LingoTheme.radius.md,
    backgroundColor: LingoTheme.colors.teal,
    alignItems: 'center',
    marginRight: 8,
  },
  modalButtonText: {
    color: LingoTheme.colors.textInverse,
    fontWeight: '700',
  },
  modalClose: {
    backgroundColor: LingoTheme.colors.borderLight,
    marginRight: 0,
  },
  modalCloseText: {
    color: LingoTheme.colors.text,
  },
});