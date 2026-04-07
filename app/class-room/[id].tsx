import { StyleSheet, View, TouchableOpacity, Alert, Platform, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/config';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { authFetch, authFetchJson } from '@/lib/auth-fetch';

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

interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  at: string;
  mine: boolean;
}

export default function ClassRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [remoteUids, setRemoteUids] = useState<string[]>([]);

  const rtcClientRef = useRef<any>(null);
  const AgoraRTCRef = useRef<any>(null);
  const localTracksRef = useRef<{ audioTrack?: any; videoTrack?: any }>({});
  const hasEndedRef = useRef(false);
  const joinedRef = useRef(false);
  const joiningRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (user.role !== 'teacher' && user.role !== 'student') {
      setError('Only teachers and students can join live classes.');
      setLoading(false);
      return;
    }

    loadClassDetails();
  }, [user, authLoading, id]);

  useEffect(() => {
    return () => {
      void cleanupAgora();
    };
  }, []);

  // Ensure local video starts only after the local container is mounted in DOM.
  useEffect(() => {
    if (!isWeb || !joined) return;
    const videoTrack = localTracksRef.current.videoTrack;
    if (!videoTrack) return;

    const timer = setTimeout(() => {
      const localContainer = document.getElementById('local-player');
      if (localContainer) {
        videoTrack.play(localContainer);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [joined]);

  // Ensure remote videos are re-attached after remote containers render.
  useEffect(() => {
    if (!isWeb || !joined || remoteUids.length === 0) return;
    const timer = setTimeout(() => {
      remoteUids.forEach((uid) => renderRemoteVideo(uid));
    }, 0);
    return () => clearTimeout(timer);
  }, [remoteUids, joined]);

  const loadClassDetails = async () => {
    if (!id) {
      setError('No class ID provided');
      setLoading(false);
      return;
    }

    try {
      const res = await authFetch(api.classSession(id));
      const data = await res.json().catch(() => ({}));

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
        setError(data?.error || 'Failed to load class details');
      }
    } catch (e) {
      console.error('Failed to load class details:', e);
      setError('Failed to load class details');
    } finally {
      setLoading(false);
    }
  };

  const cleanupAgora = async () => {
    try {
      joinedRef.current = false;
      joiningRef.current = false;

      if (localTracksRef.current.audioTrack) {
        localTracksRef.current.audioTrack.stop();
        localTracksRef.current.audioTrack.close();
      }
      if (localTracksRef.current.videoTrack) {
        localTracksRef.current.videoTrack.stop();
        localTracksRef.current.videoTrack.close();
      }
      localTracksRef.current = {};

      if (rtcClientRef.current) {
        if (typeof rtcClientRef.current.removeAllListeners === 'function') {
          rtcClientRef.current.removeAllListeners();
        }
        await rtcClientRef.current.leave();
      }
    } catch (e) {
      console.warn('Agora cleanup warning:', e);
    } finally {
      rtcClientRef.current = null;
      setJoined(false);
      setRemoteUids([]);
    }
  };

  const renewToken = async () => {
    if (!id || !user?.id || !rtcClientRef.current) return;
    const role = user.role === 'teacher' ? 'HOST' : 'STUDENT';
    const tokenResponse = await authFetchJson<any>(api.agoraToken(id, user.id, role));
    if (tokenResponse.error || !tokenResponse.data?.token) return;
    await rtcClientRef.current.renewToken(tokenResponse.data.token);
  };

  const renderRemoteVideo = (uid: string) => {
    const client = rtcClientRef.current;
    if (!client) return;
    const remoteUser = client.remoteUsers?.find((u: any) => String(u.uid) === String(uid));
    if (!remoteUser?.videoTrack || !isWeb) return;

    const container = document.getElementById(`remote-player-${uid}`);
    if (container) {
      remoteUser.videoTrack.play(container);
    }
  };

  const addRemoteUid = (uid: string) => {
    setRemoteUids((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
    setTimeout(() => renderRemoteVideo(uid), 0);
  };

  const removeRemoteUid = (uid: string) => {
    setRemoteUids((prev) => prev.filter((x) => x !== uid));
  };

  const joinClass = async () => {
    if (!id || !user?.id) return;

    if (!isWeb) {
      Alert.alert('Web only for now', 'Agora classroom is enabled on web in this build. Please test on localhost web.');
      return;
    }

    setJoining(true);
    joiningRef.current = true;
    setError(null);

    try {
      if (user.role === 'teacher') {
        const startRes = await authFetch(api.startClass(id), { method: 'POST' });
        const startData = await startRes.json().catch(() => ({}));
        if (!startRes.ok) {
          throw new Error(startData?.error || 'Unable to start class');
        }
      }

      const AgoraModule = await import('agora-rtc-sdk-ng');
      const AgoraRTC: any = (AgoraModule as any).default || AgoraModule;
      AgoraRTCRef.current = AgoraRTC;
      try {
        if (typeof AgoraRTC.disableLogUpload === 'function') {
          // Avoid SDK telemetry upload attempts where ad-blockers/proxies block them
          AgoraRTC.disableLogUpload();
        }
      } catch {}
      try {
        if (typeof AgoraRTC.setLogLevel === 'function') {
          // Keep SDK console output minimal in web testing
          AgoraRTC.setLogLevel(4);
        }
      } catch {}

      const role = user.role === 'teacher' ? 'HOST' : 'STUDENT';
      const tokenResponse = await authFetchJson<any>(api.agoraToken(id, user.id, role));
      if (tokenResponse.error || !tokenResponse.data?.token) {
        throw new Error(tokenResponse.error || 'Failed to get Agora token');
      }

      const { token, appId, channel } = tokenResponse.data;

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      rtcClientRef.current = client;

      await client.join(appId, String(channel), token, String(user.id));
      joinedRef.current = true;

      const handleUserPublished = async (remoteUser: any, mediaType: string) => {
        try {
          if (!joinedRef.current || client.connectionState !== 'CONNECTED') return;
          await client.subscribe(remoteUser, mediaType);
          if (mediaType === 'audio') {
            remoteUser.audioTrack?.play();
          }
          if (mediaType === 'video') {
            addRemoteUid(String(remoteUser.uid));
          }
        } catch (subErr: any) {
          // Race-safe: ignore subscribe calls while not fully joined/reconnecting.
          if (!String(subErr?.message || '').includes('not joined')) {
            console.warn('Subscribe warning:', subErr);
          }
        }
      };

      client.on('user-published', handleUserPublished);
      client.on('user-unpublished', (remoteUser: any, mediaType: string) => {
        if (mediaType === 'video') {
          removeRemoteUid(String(remoteUser.uid));
        }
      });
      client.on('user-left', (remoteUser: any) => {
        removeRemoteUid(String(remoteUser.uid));
      });
      client.on('token-privilege-will-expire', () => {
        void renewToken();
      });
      client.on('token-privilege-did-expire', () => {
        void renewToken();
      });

      // Subscribe already-published users (if any) after join.
      for (const remoteUser of client.remoteUsers || []) {
        if (remoteUser.hasVideo) {
          await handleUserPublished(remoteUser, 'video');
        }
        if (remoteUser.hasAudio) {
          await handleUserPublished(remoteUser, 'audio');
        }
      }

      const canUseMedia =
        typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function';

      if (!canUseMedia) {
        // Fallback: join without publishing local media when getUserMedia is unavailable.
        setMicOn(false);
        setCameraOn(false);
        Alert.alert('Limited mode', 'Camera/microphone is not available in this browser. Joined without local media.');
      } else {
        try {
          const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
          localTracksRef.current = { audioTrack, videoTrack };
          await client.publish([audioTrack, videoTrack]);

          setMicOn(true);
          setCameraOn(true);
        } catch (trackErr: any) {
          // Fallback if permissions blocked or media unavailable.
          console.warn('Local tracks unavailable, continuing without publish:', trackErr);
          setMicOn(false);
          setCameraOn(false);
          Alert.alert('Limited mode', 'Could not access camera/microphone. Joined without publishing local media.');
        }
      }

      setJoined(true);
    } catch (e: any) {
      console.error('Join class failed:', e);
      if (String(e?.message || '').toLowerCase().includes('permission')) {
        setError('Camera/Microphone permission denied. Please allow media access and try again.');
      } else {
        setError(e?.message || 'Failed to join class');
      }
      await cleanupAgora();
    } finally {
      setJoining(false);
      joiningRef.current = false;
    }
  };

  const goBackWithoutEnding = async () => {
    await cleanupAgora();
    if (user?.role === 'teacher') {
      router.replace('/(teacher)/schedule');
    } else {
      router.replace('/(student)/classes');
    }
  };

  const endOrLeaveClass = async () => {
    if (!id || !user) return;

    if (user.role === 'teacher' && !hasEndedRef.current) {
      hasEndedRef.current = true;
      try {
        await authFetch(api.endClass(id), { method: 'POST' });
      } catch (e) {
        console.warn('End class warning:', e);
      }
    }

    await cleanupAgora();

    if (user.role === 'teacher') {
      router.replace('/(teacher)/schedule');
    } else {
      router.replace('/(student)/classes');
    }
  };

  const handleEndClass = () => {
    if (user?.role !== 'teacher') {
      void goBackWithoutEnding();
      return;
    }

    if (Platform.OS === 'web') {
      if (window.confirm('End this class for everyone? This action cannot be undone.')) {
        void endOrLeaveClass();
      }
      return;
    }

    Alert.alert(
      'End Class',
      'End this class for everyone? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Class', style: 'destructive', onPress: () => void endOrLeaveClass() },
      ]
    );
  };

  const toggleMic = async () => {
    try {
      const track = localTracksRef.current.audioTrack;
      if (!track) return;
      await track.setEnabled(!micOn);
      setMicOn((v) => !v);
    } catch (e) {
      console.warn('Toggle mic failed:', e);
    }
  };

  const toggleCamera = async () => {
    try {
      const track = localTracksRef.current.videoTrack;
      if (!track) return;
      await track.setEnabled(!cameraOn);
      setCameraOn((v) => !v);
    } catch (e) {
      console.warn('Toggle camera failed:', e);
    }
  };

  const switchCamera = async () => {
    try {
      const AgoraRTC = AgoraRTCRef.current;
      const videoTrack = localTracksRef.current.videoTrack;
      if (!AgoraRTC || !videoTrack) return;

      const cameras = await AgoraRTC.getCameras();
      if (!cameras || cameras.length < 2) {
        Alert.alert('Camera', 'No secondary camera found.');
        return;
      }

      const currentDevice = videoTrack.getTrackLabel ? videoTrack.getTrackLabel() : '';
      const idx = cameras.findIndex((c: any) => String(currentDevice).includes(String(c.label)));
      const next = cameras[(idx + 1) % cameras.length];
      await videoTrack.setDevice(next.deviceId);
    } catch (e) {
      console.warn('Switch camera failed:', e);
      Alert.alert('Camera', 'Unable to switch camera.');
    }
  };

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text) return;

    // Local class notes chat UI (safe fallback for web SDK where stream data APIs are unavailable)
    setChatMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        senderName: user?.full_name || (user?.role === 'teacher' ? 'Teacher' : 'Student'),
        text,
        at: new Date().toISOString(),
        mine: true,
      },
    ]);
    setChatInput('');
  };

  if (loading || authLoading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color="#4ECDC4" />
          <ThemedText style={styles.loadingText}>Loading classroom...</ThemedText>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.centeredContent}>
          <Ionicons name="alert-circle" size={56} color="#EF4444" />
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity style={styles.primaryButton} onPress={goBackWithoutEnding}>
            <ThemedText style={styles.primaryButtonText}>Go Back</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity onPress={goBackWithoutEnding} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={20} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <ThemedText style={styles.headerTitle}>{classDetails?.subject || 'Live Class'}</ThemedText>
          <ThemedText style={styles.headerSubTitle}>
            {user?.role === 'teacher' ? 'Teaching now' : `with ${classDetails?.teacher_name || 'Teacher'}`}
          </ThemedText>
        </View>
        <TouchableOpacity onPress={() => setChatOpen((v) => !v)} style={styles.iconButton}>
          <Ionicons name="chatbubble-ellipses-outline" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {joined && (
        <View style={styles.liveBadgeWrap}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <ThemedText style={styles.liveBadgeText}>
              {user?.role === 'teacher' ? 'Live as Teacher' : 'Connected as Student'}
            </ThemedText>
          </View>
        </View>
      )}

      {!joined ? (
        <View style={styles.centeredContent}>
          <View style={styles.iconContainer}>
            <Ionicons name="videocam" size={64} color="#4ECDC4" />
          </View>
          <ThemedText style={styles.subject}>{classDetails?.subject || 'Class Session'}</ThemedText>
          <ThemedText style={styles.teacher}>
            {user?.role === 'teacher' ? 'You are the teacher' : `You are joining as student`}
          </ThemedText>

          <TouchableOpacity
            style={[styles.primaryButton, joining && styles.disabledButton]}
            onPress={joinClass}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="videocam" size={20} color="#FFF" style={{ marginRight: 8 }} />
                <ThemedText style={styles.primaryButtonText}>
                  {user?.role === 'teacher' ? 'Start Class' : 'Join Class'}
                </ThemedText>
              </>
            )}
          </TouchableOpacity>

          {!isWeb && (
            <ThemedText style={styles.hint}>
              For local testing use web: http://localhost:8081
            </ThemedText>
          )}
        </View>
      ) : (
        <View style={styles.callArea}>
          {isWeb ? (
            <>
              <div id="remote-grid" style={{ width: '100%', height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 12, paddingBottom: 150 }}>
                {remoteUids.length === 0 ? (
                  <div style={{ gridColumn: '1 / span 2', alignSelf: 'center', justifySelf: 'center', color: '#9CA3AF' }}>
                    Waiting for the other participant...
                  </div>
                ) : (
                  remoteUids.map((uid) => (
                    <div key={uid} id={`remote-player-${uid}`} style={{ background: '#111827', borderRadius: 12, minHeight: 180 }} />
                  ))
                )}
              </div>
              <div id="local-player" style={{ position: 'absolute', right: 16, top: 106, width: 210, height: 125, borderRadius: 12, overflow: 'hidden', border: '2px solid #4ECDC4', background: '#0F172A', zIndex: 20, boxShadow: '0 8px 20px rgba(0,0,0,0.35)' }} />
            </>
          ) : (
            <View style={styles.centeredContent}>
              <ThemedText style={styles.hint}>Agora UI is currently web-enabled in this build.</ThemedText>
            </View>
          )}

          <View style={styles.controlsBar}>
            <TouchableOpacity style={styles.controlButton} onPress={toggleMic}>
              <Ionicons name={micOn ? 'mic' : 'mic-off'} size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
              <Ionicons name={cameraOn ? 'videocam' : 'videocam-off'} size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
              <Ionicons name="camera-reverse" size={20} color="#FFF" />
            </TouchableOpacity>
            {user?.role === 'teacher' ? (
              <TouchableOpacity style={styles.endButton} onPress={handleEndClass}>
                <Ionicons name="call" size={20} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.leaveButton} onPress={goBackWithoutEnding}>
                <Ionicons name="exit-outline" size={20} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.actionLabelRow}>
            <ThemedText style={styles.actionLabel}>{micOn ? 'Mic On' : 'Mic Off'}</ThemedText>
            <ThemedText style={styles.actionLabel}>{cameraOn ? 'Camera On' : 'Camera Off'}</ThemedText>
            <ThemedText style={styles.actionLabel}>Switch</ThemedText>
            <ThemedText style={[styles.actionLabel, user?.role === 'teacher' ? styles.endLabel : styles.leaveLabel]}>
              {user?.role === 'teacher' ? 'End Class' : 'Leave'}
            </ThemedText>
          </View>
        </View>
      )}

      {chatOpen && (
        <View style={styles.chatPanel}>
          <ThemedText style={styles.chatTitle}>Class Chat</ThemedText>
          <ScrollView style={styles.chatList} contentContainerStyle={{ paddingBottom: 10 }}>
            {chatMessages.map((m) => (
              <View key={m.id} style={[styles.chatBubble, m.mine ? styles.chatBubbleMine : styles.chatBubbleOther]}>
                {!m.mine && <ThemedText style={styles.chatSender}>{m.senderName}</ThemedText>}
                <ThemedText style={styles.chatText}>{m.text}</ThemedText>
              </View>
            ))}
            {chatMessages.length === 0 && <ThemedText style={styles.emptyChatText}>No messages yet</ThemedText>}
          </ScrollView>
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              placeholder="Type a message"
              placeholderTextColor="#9CA3AF"
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={sendChatMessage}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={sendChatMessage}>
              <Ionicons name="send" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 10,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubTitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#FFF',
    marginTop: 12,
  },
  errorText: {
    color: '#FCA5A5',
    marginTop: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(78,205,196,0.2)',
    marginBottom: 20,
  },
  subject: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  teacher: {
    color: '#94A3B8',
    marginTop: 8,
    marginBottom: 24,
  },
  primaryButton: {
    minWidth: 180,
    backgroundColor: '#4ECDC4',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  hint: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 14,
  },
  callArea: {
    flex: 1,
    position: 'relative',
  },
  liveBadgeWrap: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 2,
  },
  liveBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderColor: 'rgba(16,185,129,0.45)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  liveBadgeText: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '700',
  },
  controlsBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 38,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    zIndex: 30,
  },
  controlButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabelRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  actionLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
    minWidth: 52,
    textAlign: 'center',
  },
  endLabel: {
    color: '#FCA5A5',
  },
  leaveLabel: {
    color: '#BFDBFE',
  },
  chatPanel: {
    position: 'absolute',
    right: 10,
    top: 95,
    width: 300,
    maxHeight: 420,
    backgroundColor: 'rgba(15,23,42,0.96)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  chatTitle: {
    color: '#FFF',
    fontWeight: '700',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  chatList: {
    maxHeight: 290,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  chatBubble: {
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    maxWidth: '85%',
  },
  chatBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#2BCBBA',
  },
  chatBubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chatSender: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 2,
  },
  chatText: {
    color: '#FFF',
    fontSize: 13,
  },
  emptyChatText: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#111827',
    color: '#FFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sendBtn: {
    marginLeft: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
