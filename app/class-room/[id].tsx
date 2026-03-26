import { StyleSheet, View, TouchableOpacity, Alert, Platform, ActivityIndicator, Linking } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect } from 'react';
import { API_URL } from '@/lib/config';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';

const isWeb = Platform.OS === 'web';

interface ClassDetails {
  id: string;
  teacher_name: string;
  subject: string;
  scheduled_time: string;
  duration_minutes: number;
  status?: string;
  live_status?: string;
}

export default function ClassRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.replace('/login');
      return;
    }
    
    loadClassDetails();
  }, [user, authLoading]);

  const loadClassDetails = async () => {
    if (!id) {
      setError('No class ID provided');
      setLoading(false);
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/class-session/${id}`);
      const data = await res.json();
      
      if (res.ok && data.session) {
        setClassDetails({
          id: data.session.id,
          teacher_name: data.session.teacher_name || 'Teacher',
          subject: data.session.subject || 'Class Session',
          scheduled_time: data.session.scheduled_time,
          duration_minutes: data.session.duration_minutes || 60,
          status: data.session.status,
          live_status: data.session.live_status,
        });
      } else {
        setError('Failed to load class details');
      }
    } catch (e) {
      console.error('Failed to load class details:', e);
      setError('Failed to load class details');
    } finally {
      setLoading(false);
    }
  };

  const joinClass = () => {
    setJoining(true);
    
    // Create room URL - same room for both teacher and student
    const roomName = `IlmConnect${id?.replace(/-/g, '').substring(0, 20)}`;
    const displayName = encodeURIComponent(user?.full_name || (user?.role === 'teacher' ? 'Teacher' : 'Student'));
    
    // Jitsi URL
    const jitsiUrl = `https://meet.jit.si/${roomName}#userInfo.displayName="${displayName}"&config.prejoinPageEnabled=false`;

    if (isWeb) {
      // For web, open in new tab
      window.open(jitsiUrl, '_blank');
      setJoining(false);
    } else {
      // For mobile, open in-app browser
      WebBrowser.openBrowserAsync(jitsiUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        controlsColor: '#4ECDC4',
        toolbarColor: '#1a1a2e',
      }).finally(() => {
        setJoining(false);
      });
    }
  };

  const handleBack = () => {
    if (user?.role === 'teacher') {
      router.replace('/(teacher)/schedule');
    } else {
      router.replace('/(parent)/classes');
    }
  };

  // Loading state
  if (loading || authLoading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#4ECDC4" />
          <ThemedText style={styles.loadingText}>Loading classroom...</ThemedText>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.content}>
          <Ionicons name="alert-circle" size={64} color="#EF4444" />
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <ThemedText style={styles.backBtnText}>Go Back</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Main screen - show join button
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerBackBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Classroom</ThemedText>
        <View style={{ width: 40 }} />
      </View>
      
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="videocam" size={80} color="#4ECDC4" />
        </View>
        
        <ThemedText style={styles.subject}>{classDetails?.subject || 'Class Session'}</ThemedText>
        <ThemedText style={styles.teacher}>
          {user?.role === 'teacher' ? 'You are the teacher' : `with ${classDetails?.teacher_name}`}
        </ThemedText>
        
        <TouchableOpacity
          style={[styles.joinButton, joining && styles.joinButtonDisabled]}
          onPress={joinClass}
          disabled={joining}
          activeOpacity={0.8}
        >
          {joining ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="videocam" size={24} color="#FFF" style={{ marginRight: 10 }} />
              <ThemedText style={styles.joinButtonText}>
                {user?.role === 'teacher' ? 'Start Class' : 'Join Class'}
              </ThemedText>
            </>
          )}
        </TouchableOpacity>
        
        <ThemedText style={styles.hint}>
          Click the button above to {user?.role === 'teacher' ? 'start' : 'join'} the video call
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#FFF',
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  backBtn: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  backBtnText: {
    color: '#FFF',
    fontSize: 16,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  subject: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  teacher: {
    color: '#9CA3AF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
  },
  joinButton: {
    flexDirection: 'row',
    backgroundColor: '#4ECDC4',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 200,
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
  joinButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  hint: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
  },
});
