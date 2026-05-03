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
import { useSafePadding } from '@/hooks/use-safe-padding';
import { LingoEmptyState, LingoScreenHeader } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { ParentDashboardSkeleton } from '@/components/ui/dashboard-skeletons';

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
  const { topPadding } = useSafePadding();
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
  
  const childCardWidth = Math.max(screenWidth - 48, 280);

  // Format Name safely
  const formatName = (name: string) => {
    if (!name) return 'Parent';
    const trimmed = name.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  };
  const displayName = formatName(parentName || user?.full_name || 'Parent');
  const headerInitial = displayName.charAt(0);

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
          } catch { }
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
          } catch { }
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
          } catch { }
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
    return <ParentDashboardSkeleton />;
  }

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
            tintColor={LingoTheme.colors.primary}
          />
        }
      >
        <View style={[styles.headerWrap, { paddingTop: topPadding + 10 }]}> 
          {/* 1. Top Bar */}
          <View style={styles.topBar}>
            <View style={styles.userInfo}>
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
                    colors={['#ce82ff', '#a855f7']}
                    style={styles.profileFallback}
                  >
                    <ThemedText style={styles.profileFallbackText}>{headerInitial}</ThemedText>
                  </LinearGradient>
                )}
              </TouchableOpacity>
              <View style={styles.welcomeText}>
                <ThemedText style={styles.greetingText}>{getGreeting()},</ThemedText>
                <ThemedText style={styles.nameText}>{displayName}!</ThemedText>
                <ThemedText style={styles.motivationalText}>Let's keep your little learners growing every day 🌱</ThemedText>
              </View>
            </View>

            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                setHasUnreadNotifications(false);
                router.push('/(parent)/notifications');
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="notifications" size={24} color="#AFAFAF" />
              {hasUnreadNotifications && <View style={styles.notificationDot} />}
            </TouchableOpacity>
          </View>

          {/* 2. Parent Hub Card */}
          <LinearGradient
            colors={['#ECFCD8', '#FFFFFF', '#F2E8FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.parentHubCard}
          >
            <View style={styles.hubAvatarContainer}>
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.hubAvatar} />
              ) : (
                <View style={[styles.hubAvatar, styles.hubAvatarFallback]}>
                  <ThemedText style={styles.hubAvatarInitial}>
                    {displayName.charAt(0).toUpperCase()}
                  </ThemedText>
                </View>
              )}
            </View>
            <ThemedText style={styles.hubTitle}>{displayName}</ThemedText>
            <ThemedText style={styles.hubSubtitle}>Stay updated with your children's learning and class activity.</ThemedText>
          </LinearGradient>

          {/* 3. Stats Row */}
          <View style={styles.horizontalStatsRow}>
            <TouchableOpacity style={styles.metricPill} activeOpacity={0.8}>
               <Ionicons name="people" size={24} color="#58cc02" />
               <ThemedText style={styles.metricValue}>{stats.children}</ThemedText>
               <ThemedText style={styles.metricLabel}>CHILDREN</ThemedText>
               <View style={styles.metricArrow}>
                 <Ionicons name="arrow-forward" size={14} color="#58cc02" />
               </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.metricPill} activeOpacity={0.8}>
               <Ionicons name="calendar" size={24} color="#ffc800" />
               <ThemedText style={styles.metricValue}>{stats.activeClasses}</ThemedText>
               <ThemedText style={styles.metricLabel}>ACTIVE</ThemedText>
               <View style={[styles.metricArrow, { backgroundColor: '#FFF7D6' }]}>
                 <Ionicons name="arrow-forward" size={14} color="#ffc800" />
               </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.metricPill} activeOpacity={0.8}>
               <Ionicons name="school" size={24} color="#ce82ff" />
               <ThemedText style={styles.metricValue}>{stats.teachers}</ThemedText>
               <ThemedText style={styles.metricLabel}>TEACHERS</ThemedText>
               <View style={[styles.metricArrow, { backgroundColor: '#F2E8FF' }]}>
                 <Ionicons name="arrow-forward" size={14} color="#ce82ff" />
               </View>
            </TouchableOpacity>
          </View>

          {/* 4. Small circular arrow button below */}
          <View style={styles.arrowContainer}>
             <TouchableOpacity style={styles.arrowButton} activeOpacity={0.8}>
                <Ionicons name="chevron-down" size={20} color="#AFAFAF" />
             </TouchableOpacity>
          </View>

          {/* 5. Today's Overview tactile card */}
          <View style={styles.overviewCard}>
             <View style={styles.overviewTitleRow}>
               <Ionicons name="star" size={20} color="#ffc800" />
               <ThemedText style={styles.overviewTitle}>Today's Overview</ThemedText>
             </View>
             <View style={styles.overviewItem}>
               <View style={styles.overviewItemLeft}>
                 <View style={[styles.overviewItemIcon, { backgroundColor: '#ECFCD8' }]}>
                   <Ionicons name="checkmark-circle" size={20} color="#58cc02" />
                 </View>
                 <ThemedText style={styles.overviewItemText}>Classes attended</ThemedText>
                 <TouchableOpacity activeOpacity={0.6}>
                   <Ionicons name="information-circle-outline" size={16} color="#AFAFAF" />
                 </TouchableOpacity>
               </View>
               <ThemedText style={styles.overviewItemValue}>{stats.activeClasses || 0}</ThemedText>
             </View>
             <View style={styles.overviewItemDivider} />
             <View style={styles.overviewItem}>
               <View style={styles.overviewItemLeft}>
                 <View style={[styles.overviewItemIcon, { backgroundColor: '#FFF7D6' }]}>
                   <Ionicons name="time" size={20} color="#ffc800" />
                 </View>
                 <ThemedText style={styles.overviewItemText}>Time spent learning</ThemedText>
                 <TouchableOpacity activeOpacity={0.6}>
                   <Ionicons name="information-circle-outline" size={16} color="#AFAFAF" />
                 </TouchableOpacity>
               </View>
               <ThemedText style={styles.overviewItemValue}>0m</ThemedText>
             </View>
             <View style={styles.overviewItemDivider} />
             <View style={styles.overviewItem}>
               <View style={styles.overviewItemLeft}>
                 <View style={[styles.overviewItemIcon, { backgroundColor: '#ECFCD8' }]}>
                   <Ionicons name="chatbubble-ellipses" size={20} color="#58cc02" />
                 </View>
                 <ThemedText style={styles.overviewItemText}>Messages</ThemedText>
                 <TouchableOpacity activeOpacity={0.6}>
                   <Ionicons name="information-circle-outline" size={16} color="#AFAFAF" />
                 </TouchableOpacity>
               </View>
               <ThemedText style={styles.overviewItemValue}>{messages.length}</ThemedText>
             </View>
          </View>

          {/* 6. Keep it up banner */}
          <View style={styles.keepItUpBanner}>
             <View style={styles.lanternBg}>
               <Ionicons name="flame" size={32} color="#ffc800" />
             </View>
             <View style={styles.bannerTextContainer}>
               <View style={styles.bannerTitleRow}>
                 <Ionicons name="bulb" size={18} color="#ffc800" />
                 <ThemedText style={styles.bannerTitle}>Keep it up!</ThemedText>
               </View>
               <ThemedText style={styles.bannerSubtitle}>Encourage daily learning to build consistency and confidence.</ThemedText>
             </View>
          </View>
        </View>

        {/* Child Progress Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
             <ThemedText style={styles.sectionTitle}>My Child</ThemedText>
             {children.length > 0 && (
               <TouchableOpacity onPress={() => setShowChildrenModal(true)} activeOpacity={0.8}>
                 <ThemedText style={styles.seeAllText}>Manage</ThemedText>
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
              <LingoEmptyState icon="person-add" title="Add Child Profile" subtitle="Track progress and manage classes from one place." tone="teal" />
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
              <View style={[styles.quickActionIcon, { backgroundColor: '#E5F6FF', borderColor: '#3B82F6' }]}>  
                <Ionicons name="book" size={28} color="#3B82F6" />
              </View>
              <ThemedText style={styles.quickActionLabel}>Courses</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(parent)/messages')} activeOpacity={0.8}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#F3E8FF', borderColor: '#A855F7' }]}>  
                <Ionicons name="chatbubbles" size={28} color="#A855F7" />
              </View>
              <ThemedText style={styles.quickActionLabel}>Messages</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => setShowAddChildModal(true)} activeOpacity={0.8}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#FFF8E5', borderColor: '#D4AF37' }]}>  
                <Ionicons name="person-add" size={28} color="#D4AF37" />
              </View>
              <ThemedText style={styles.quickActionLabel}>Add Child</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(parent)/profile')} activeOpacity={0.8}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#FFE5E5', borderColor: '#EF4444' }]}>  
                <Ionicons name="settings" size={28} color="#EF4444" />
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
            <View style={styles.tactileCard}>
              <LingoEmptyState icon="calendar" title="No upcoming classes" subtitle="Book a class to get started." tone="gold" />
            </View>
          ) : (
            upcomingClasses.slice(0, 2).map((classItem) => {
              const classDateTime = new Date(classItem.scheduled_date);
              const now = new Date();
              const diffMinutes = (classDateTime.getTime() - now.getTime()) / (1000 * 60);
              const status = String(classItem.status || '').toLowerCase();
              const isScheduled = status === 'upcoming' || status === 'confirmed';
              const joinable = isScheduled && diffMinutes <= 15 && diffMinutes >= -60;
              return (
                <View key={classItem.id} style={styles.tactileCardRow}>
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
                         <Ionicons name="time" size={16} color="#AFAFAF" />
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
            <View style={styles.tactileCard}>
              <LingoEmptyState icon="time" title="No class history" subtitle="Completed or closed classes will appear here." tone="primary" />
            </View>
          ) : (
            pastClasses.slice(0, 2).map((classItem) => {
              const classDateTime = new Date(classItem.scheduled_date);
              const now = new Date();
              const ended = classDateTime < now;
              const statusLabel = ended ? 'Closed' : (classItem.status.charAt(0).toUpperCase() + classItem.status.slice(1));
              return (
                <View key={classItem.id} style={styles.tactileCardRow}>
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
                         <Ionicons name="time" size={16} color="#AFAFAF" />
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
             <View style={styles.tactileCard}>
               <LingoEmptyState icon="chatbubble-ellipses" title="No new messages" subtitle="Fresh updates from teachers will appear here." tone="teal" />
             </View>
           ) : (
             messages.map((msg) => (
               <TouchableOpacity key={msg.id} style={styles.tactileCardRow} onPress={() => router.push('/(parent)/messages')} activeOpacity={0.8}>
                  <View style={styles.messageAvatar}>
                     <Ionicons name="person" size={24} color="#AFAFAF" />
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
             <View style={styles.tactileCard}>
               <LingoEmptyState icon="wallet" title="No recent transactions" subtitle="Recent payments will show up here." tone="primary" />
             </View>
           ) : (
             payments.map((pay) => (
               <View key={pay.id} style={styles.tactileCardRow}>
                  <View style={styles.paymentIcon}>
                     <Ionicons name="receipt" size={24} color="#58cc02" />
                  </View>
                  <View style={styles.paymentBody}>
                     <ThemedText style={styles.payDesc}>{pay.description}</ThemedText>
                     <ThemedText style={styles.payDate}>{pay.date}</ThemedText>
                  </View>
                  <View style={styles.paymentEnd}>
                     <ThemedText style={styles.payAmount}>${pay.amount.toFixed(2)}</ThemedText>
                     <ThemedText style={[styles.payStatus, { color: pay.status === 'Paid' ? '#58cc02' : '#ffc800' }]}>
                        {pay.status}
                     </ThemedText>
                  </View>
               </View>
             ))
           )}
        </View>
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
    backgroundColor: '#F7F7F7', // Lingo brand background
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Platform.OS === 'ios' ? 140 : 120, // MASSIVE padding to clear floating nav bars entirely
  },

  /* Header Restyle */
  headerWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  welcomeText: {
    justifyContent: 'center',
  },
  greetingText: {
    fontSize: 14,
    color: '#AFAFAF',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  nameText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#3C3C3C',
  },
  motivationalText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#AFAFAF',
    marginTop: 4,
  },
  
  parentHubCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    marginBottom: 16,
    overflow: 'hidden',
  },
  hubTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#3C3C3C',
    marginTop: 8,
    marginBottom: 6,
  },
  hubSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  hubAvatarContainer: {
    marginBottom: 4,
  },
  hubAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#A8E063',
  },
  hubAvatarFallback: {
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hubAvatarInitial: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  horizontalStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  metricPill: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#3C3C3C',
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#AFAFAF',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  metricArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ECFCD8',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },

  arrowContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  arrowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
  },

  overviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    marginBottom: 16,
  },
  overviewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  overviewTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#3C3C3C',
  },
  overviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  overviewItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  overviewItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overviewItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3C3C3C',
  },
  overviewItemValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#58cc02',
  },
  overviewItemDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },

  keepItUpBanner: {
    backgroundColor: '#FAFAFA',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    marginBottom: 16,
    gap: 16,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#3C3C3C',
  },
  bannerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    lineHeight: 20,
  },
  lanternBg: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#FFF7D6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F4D778',
  },

  /* Bug-free, tactile floating notification button */
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF4B4B',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    overflow: 'hidden',
    backgroundColor: '#FFF',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileFallbackText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* Sections */
  sectionContainer: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#3C3C3C',
  },
  seeAllText: {
    fontSize: 15,
    color: '#3B82F6',
    fontWeight: '800',
  },

  /* Child Cards */
  childCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.1)',
    borderBottomWidth: 4, // Keeps 3D effect even with gradient
  },
  childCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  childAvatarContainer: {
    marginRight: 16,
  },
  childAvatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  childAvatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  childAge: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    padding: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 2,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
  },
  childCarousel: {
    paddingHorizontal: 4,
  },
  childCardWrapper: {
    marginRight: 16,
  },
  childCardCarousel: {
    width: '100%',
  },

  /* Base Tactile Cards for everything else */
  tactileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    padding: 24,
  },
  tactileCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    padding: 16,
    marginBottom: 12,
  },
  addChildCard: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
  },

  /* Quick Actions - 3D Icons */
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickAction: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderBottomWidth: 4,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#777777',
  },

  /* Class Specific List Styles */
  classCardLeft: {
    marginRight: 16,
  },
  dateBox: {
    width: 56,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#F7F7F7',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateDay: {
    fontSize: 20,
    fontWeight: '800',
    color: '#3C3C3C',
  },
  dateMonth: {
    fontSize: 12,
    color: '#777777',
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  classCardMiddle: {
    flex: 1,
  },
  classTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#3C3C3C',
    marginBottom: 4,
  },
  teacherName: {
    fontSize: 14,
    color: '#777777',
    fontWeight: '600',
    marginBottom: 6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 13,
    color: '#AFAFAF',
    fontWeight: '700',
  },
  classCardRight: {
    marginLeft: 12,
  },

  /* Status Badges */
  statusBadgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5F6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  statusBadgeLiveText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '800',
  },
  statusBadgeSoon: {
    backgroundColor: '#FFF8E5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D4AF37',
  },
  statusBadgeSoonText: {
    color: '#D4AF37',
    fontSize: 13,
    fontWeight: '800',
  },
  statusBadgeScheduled: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeScheduledText: {
    color: '#A855F7',
    fontSize: 12,
    fontWeight: '800',
  },
  statusBadgeClosed: {
    backgroundColor: '#F7F7F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeClosedText: {
    color: '#AFAFAF',
    fontSize: 12,
    fontWeight: '800',
  },

  /* Messages Specific */
  messageAvatar: {
    width: 52,
    height: 52,
    borderRadius: 20,
    backgroundColor: '#F7F7F7',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  messageBody: {
    flex: 1,
  },
  messageTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  msgName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#3C3C3C',
  },
  msgTime: {
    fontSize: 13,
    color: '#AFAFAF',
    fontWeight: '700',
  },
  msgPreview: {
    fontSize: 14,
    color: '#777777',
    fontWeight: '600',
  },

  /* Payments Specific */
  paymentIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#E5F6FF', // Changed to soft blue since it looks better
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  paymentBody: {
    flex: 1,
  },
  payDesc: {
    fontSize: 15,
    fontWeight: '800',
    color: '#3C3C3C',
    marginBottom: 4,
  },
  payDate: {
    fontSize: 13,
    color: '#AFAFAF',
    fontWeight: '700',
  },
  paymentEnd: {
    alignItems: 'flex-end',
  },
  payAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#3C3C3C',
    marginBottom: 4,
  },
  payStatus: {
    fontSize: 12,
    fontWeight: '800',
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
    color: '#3C3C3C',
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E5E5',
  },
  childRowAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F7F7F7',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  childAvatarTextSmall: {
    fontSize: 20,
    fontWeight: '800',
    color: '#3C3C3C',
  },
  childRowName: {
    fontSize: 18,
    color: '#3C3C3C',
    fontWeight: '800',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: '#58cc02',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  modalClose: {
    backgroundColor: '#FFFFFF',
  },
  modalCloseText: {
    color: '#AFAFAF',
  },
});