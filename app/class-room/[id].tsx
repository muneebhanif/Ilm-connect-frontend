import { StyleSheet, View, TouchableOpacity, Alert, Platform, ActivityIndicator, TextInput, ScrollView, Animated, Dimensions, PermissionsAndroid, Linking } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/config';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { authFetch, authFetchJson } from '@/lib/auth-fetch';
import { LinearGradient } from 'expo-linear-gradient';
import { LingoBadge, LingoCard, LingoEmptyState, LingoScreenHeader } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';

const isWeb = Platform.OS === 'web';
const { width: SCREEN_W } = Dimensions.get('window');

/* ── Native Agora imports (only on Android/iOS) ── */
let createAgoraRtcEngine: any = null;
let RtcSurfaceView: any = null;
let ChannelProfileType: any = null;
let ClientRoleType: any = null;

if (!isWeb) {
  try {
    const agora = require('react-native-agora');
    createAgoraRtcEngine = agora.createAgoraRtcEngine;
    RtcSurfaceView = agora.RtcSurfaceView;
    ChannelProfileType = agora.ChannelProfileType;
    ClientRoleType = agora.ClientRoleType;
  } catch (e) {
    console.warn('react-native-agora not available:', e);
  }
}

interface ClassDetails {
  id: string;
  teacher_name: string;
  subject: string;
  scheduled_time: string;
  duration_minutes: number;
  status?: string;
  live_status?: string;
  channel_name?: string;
  meeting_url?: string;
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
  const [remoteUids, setRemoteUids] = useState<number[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [participantCount, setParticipantCount] = useState(1);

  // Web-only refs
  const rtcClientRef = useRef<any>(null);
  const AgoraRTCRef = useRef<any>(null);
  const localTracksRef = useRef<{ audioTrack?: any; videoTrack?: any }>({});
  const dataStreamIdRef = useRef<number | null>(null);

  // Native-only ref
  const nativeEngineRef = useRef<any>(null);

  const hasEndedRef = useRef(false);
  const joinedRef = useRef(false);
  const joiningRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const chatScrollRef = useRef<ScrollView>(null);

  // ─── Animations & Timers ─────────────────────────────────
  useEffect(() => {
    if (!joined) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [joined]);

  useEffect(() => {
    if (!joined) return;
    const interval = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, [joined]);

  const formatElapsed = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ─── Auth/Lifecycle ──────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'teacher' && user.role !== 'student') {
      setError('Only teachers and students can join live classes.');
      setLoading(false);
      return;
    }
    loadClassDetails();
  }, [user, authLoading, id]);

  useEffect(() => { return () => { void cleanup(); }; }, []);

  // Web-only: play local video
  useEffect(() => {
    if (!isWeb || !joined) return;
    const vt = localTracksRef.current.videoTrack;
    if (!vt) return;
    const t = setTimeout(() => {
      const el = document.getElementById('local-player');
      if (el) vt.play(el);
    }, 0);
    return () => clearTimeout(t);
  }, [joined]);

  // Web-only: play remote video
  useEffect(() => {
    if (!isWeb || !joined || remoteUids.length === 0) return;
    const t = setTimeout(() => remoteUids.forEach((uid) => renderRemoteVideo(String(uid))), 0);
    return () => clearTimeout(t);
  }, [remoteUids, joined]);

  useEffect(() => {
    setParticipantCount(1 + remoteUids.length);
  }, [remoteUids]);

  // ─── Load Class Details ──────────────────────────────────
  const loadClassDetails = async () => {
    if (!id) { setError('No class ID provided'); setLoading(false); return; }
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
          channel_name: data.session.channel_name,
          meeting_url: data.session.meeting_url,
        });
      } else { setError(data?.error || 'Failed to load class details'); }
    } catch (e) { console.error('Load class failed:', e); setError('Failed to load class details'); }
    finally { setLoading(false); }
  };

  // ─── Cleanup ─────────────────────────────────────────────
  const cleanup = async () => {
    if (isWeb) await cleanupWebAgora();
    else await cleanupNativeAgora();
  };

  const cleanupWebAgora = async () => {
    try {
      joinedRef.current = false; joiningRef.current = false;
      if (localTracksRef.current.audioTrack) { localTracksRef.current.audioTrack.stop(); localTracksRef.current.audioTrack.close(); }
      if (localTracksRef.current.videoTrack) { localTracksRef.current.videoTrack.stop(); localTracksRef.current.videoTrack.close(); }
      localTracksRef.current = {};
      if (rtcClientRef.current) {
        if (typeof rtcClientRef.current.removeAllListeners === 'function') rtcClientRef.current.removeAllListeners();
        await rtcClientRef.current.leave();
      }
    } catch (e) { console.warn('Web cleanup warning:', e); }
    finally { rtcClientRef.current = null; dataStreamIdRef.current = null; setJoined(false); setRemoteUids([]); }
  };

  const cleanupNativeAgora = async () => {
    try {
      joinedRef.current = false; joiningRef.current = false;
      const engine = nativeEngineRef.current;
      if (engine) {
        engine.leaveChannel();
        engine.release();
      }
    } catch (e) { console.warn('Native cleanup warning:', e); }
    finally { nativeEngineRef.current = null; setJoined(false); setRemoteUids([]); }
  };

  // ─── Token Renewal ───────────────────────────────────────
  const renewToken = async () => {
    if (!id || !user?.id) return;
    const role = user.role === 'teacher' ? 'HOST' : 'STUDENT';
    const nativeAgoraUid = !isWeb ? hashStringToUid(user.id) : undefined;
    const tr = await authFetchJson<any>(api.agoraToken(id, user.id, role, nativeAgoraUid));
    if (tr.error || !tr.data?.token) return;
    if (isWeb && rtcClientRef.current) {
      await rtcClientRef.current.renewToken(tr.data.token);
    } else if (!isWeb && nativeEngineRef.current) {
      nativeEngineRef.current.renewToken(tr.data.token);
    }
  };

  // ─── Web-only helpers ────────────────────────────────────
  const renderRemoteVideo = (uid: string) => {
    const client = rtcClientRef.current;
    if (!client || !isWeb) return;
    const ru = client.remoteUsers?.find((u: any) => String(u.uid) === String(uid));
    if (!ru?.videoTrack) return;
    const el = document.getElementById(`remote-player-${uid}`);
    if (el) ru.videoTrack.play(el);
  };

  const addRemoteUid = (uid: number) => {
    setRemoteUids((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
    if (isWeb) setTimeout(() => renderRemoteVideo(String(uid)), 0);
  };
  const removeRemoteUid = (uid: number) => setRemoteUids((prev) => prev.filter((x) => x !== uid));

  const ensureClassroomPermissions = async () => {
    if (Platform.OS !== 'android') return true;

    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);

    const denied = Object.values(result).some((value) => value !== PermissionsAndroid.RESULTS.GRANTED);
    if (!denied) return true;

    Alert.alert(
      'Permissions required',
      'Camera and microphone permissions are required for live classes.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );

    return false;
  };

  const setupDataStream = async () => {
    const client = rtcClientRef.current;
    if (!client || dataStreamIdRef.current !== null) return;
    try {
      const streamId = await client.createDataStream({ ordered: true, reliable: true });
      dataStreamIdRef.current = streamId;
    } catch (e) { console.warn('Failed to create data stream:', e); }
  };

  // ═══════════════════════════════════════════════════════════
  //  JOIN CLASS
  // ═══════════════════════════════════════════════════════════
  const joinClass = async () => {
    if (!id || !user?.id) return;
    setJoining(true); joiningRef.current = true; setError(null);

    try {
      const hasPermissions = await ensureClassroomPermissions();
      if (!hasPermissions) {
        throw new Error('Camera/Microphone permission denied.');
      }

      if (user.role === 'teacher') {
        const sr = await authFetch(api.startClass(id), { method: 'POST' });
        const sd = await sr.json().catch(() => ({}));
        if (!sr.ok) throw new Error(sd?.error || 'Unable to start class');
      }

      const role = user.role === 'teacher' ? 'HOST' : 'STUDENT';
      const nativeAgoraUid = !isWeb ? hashStringToUid(user.id) : undefined;
      const tr = await authFetchJson<any>(api.agoraToken(id, user.id, role, nativeAgoraUid));
      if (tr.error || !tr.data?.token) throw new Error(tr.error || 'Failed to get Agora token');
      const { token, appId, channel } = tr.data;

      if (isWeb) {
        await joinWeb(appId, channel, token);
      } else {
        await joinNative(appId, channel, token);
      }

      joinedRef.current = true;
      setJoined(true);
    } catch (e: any) {
      console.error('Join failed:', e);
      setError(String(e?.message || '').toLowerCase().includes('permission')
        ? 'Camera/Microphone permission denied.'
        : e?.message || 'Failed to join class');
      await cleanup();
    } finally { setJoining(false); joiningRef.current = false; }
  };

  // ─── Native Agora Join ───────────────────────────────────
  const joinNative = async (appId: string, channel: string, token: string) => {
    if (!createAgoraRtcEngine) throw new Error('Native Agora SDK not available. Please rebuild the app.');

    const engine = createAgoraRtcEngine();
    nativeEngineRef.current = engine;

    engine.initialize({
      appId,
      channelProfile: ChannelProfileType.ChannelProfileCommunication,
    });

    engine.addListener('onUserJoined', (_connection: any, remoteUid: number) => {
      addRemoteUid(remoteUid);
    });
    engine.addListener('onUserOffline', (_connection: any, remoteUid: number) => {
      removeRemoteUid(remoteUid);
    });
    engine.addListener('onTokenPrivilegeWillExpire', () => { void renewToken(); });

    engine.enableVideo();
    engine.enableAudio();
    engine.startPreview();

    const numericUid = hashStringToUid(user!.id);
    engine.joinChannel(token, channel, numericUid, {
      clientRoleType: ClientRoleType.ClientRoleBroadcaster,
    });

    setMicOn(true);
    setCameraOn(true);
  };

  // ─── Web Agora Join ──────────────────────────────────────
  const joinWeb = async (appId: string, channel: string, token: string) => {
    const AgoraModule = await import('agora-rtc-sdk-ng');
    const AgoraRTC: any = (AgoraModule as any).default || AgoraModule;
    AgoraRTCRef.current = AgoraRTC;
    try { if (typeof AgoraRTC.disableLogUpload === 'function') AgoraRTC.disableLogUpload(); } catch {}
    try { if (typeof AgoraRTC.setLogLevel === 'function') AgoraRTC.setLogLevel(4); } catch {}

    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    rtcClientRef.current = client;
    await client.join(appId, String(channel), token, String(user!.id));

    client.on('stream-message', (_uid: any, data: any) => {
      try {
        let decoded = '';
        if (typeof data === 'string') decoded = data;
        else if (data instanceof Uint8Array) decoded = new TextDecoder().decode(data);
        else if (data instanceof ArrayBuffer) decoded = new TextDecoder().decode(new Uint8Array(data));
        else if (data?.buffer instanceof ArrayBuffer) decoded = new TextDecoder().decode(new Uint8Array(data.buffer));
        else decoded = String(data ?? '');
        if (!decoded) return;
        const msg = JSON.parse(decoded);
        if (msg.type === 'chat') {
          setChatMessages((prev) => [...prev, {
            id: `${Date.now()}-${Math.random()}`,
            senderName: msg.senderName || 'Participant',
            text: msg.text,
            at: msg.at || new Date().toISOString(),
            mine: false,
          }]);
          setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
      } catch (e) { console.warn('Failed to parse stream message:', e); }
    });

    const handleUserPublished = async (remoteUser: any, mediaType: string) => {
      try {
        if (!joinedRef.current || client.connectionState !== 'CONNECTED') return;
        await client.subscribe(remoteUser, mediaType);
        if (mediaType === 'audio') remoteUser.audioTrack?.play();
        if (mediaType === 'video') addRemoteUid(Number(remoteUser.uid) || remoteUser.uid);
      } catch (subErr: any) {
        if (!String(subErr?.message || '').includes('not joined')) console.warn('Subscribe:', subErr);
      }
    };
    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', (ru: any, mt: string) => { if (mt === 'video') removeRemoteUid(Number(ru.uid) || ru.uid); });
    client.on('user-left', (ru: any) => removeRemoteUid(Number(ru.uid) || ru.uid));
    client.on('token-privilege-will-expire', () => void renewToken());
    client.on('token-privilege-did-expire', () => void renewToken());

    for (const ru of client.remoteUsers || []) {
      if (ru.hasVideo) await handleUserPublished(ru, 'video');
      if (ru.hasAudio) await handleUserPublished(ru, 'audio');
    }

    const canMedia = typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
    if (!canMedia) { setMicOn(false); setCameraOn(false); }
    else {
      try {
        const [at, vt] = await AgoraRTC.createMicrophoneAndCameraTracks();
        localTracksRef.current = { audioTrack: at, videoTrack: vt };
        await client.publish([at, vt]);
        setMicOn(true); setCameraOn(true);
      } catch { setMicOn(false); setCameraOn(false); }
    }

    await setupDataStream();
  };

  /** Hash a UUID string to a positive 32-bit integer for Agora native UID */
  const hashStringToUid = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 1000000000 || 1;
  };

  const goBackWithoutEnding = async () => {
    await cleanup();
    router.replace(user?.role === 'teacher' ? '/(teacher)/schedule' : '/(student)/classes');
  };

  const endOrLeaveClass = async () => {
    if (!id || !user) return;
    if (user.role === 'teacher' && !hasEndedRef.current) {
      hasEndedRef.current = true;
      try { await authFetch(api.endClass(id), { method: 'POST' }); } catch {}
    }
    await cleanup();
    router.replace(user.role === 'teacher' ? '/(teacher)/schedule' : '/(student)/classes');
  };

  const handleEndClass = () => {
    if (user?.role !== 'teacher') { void goBackWithoutEnding(); return; }
    if (Platform.OS === 'web') {
      if (window.confirm('End this class for everyone?')) void endOrLeaveClass();
      return;
    }
    Alert.alert('End Class', 'End this class for everyone?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End Class', style: 'destructive', onPress: () => void endOrLeaveClass() },
    ]);
  };

  const toggleMic = async () => {
    if (isWeb) {
      try { const t = localTracksRef.current.audioTrack; if (!t) return; await t.setEnabled(!micOn); setMicOn((v) => !v); } catch {}
    } else {
      const engine = nativeEngineRef.current;
      if (!engine) return;
      engine.muteLocalAudioStream(micOn);
      setMicOn((v) => !v);
    }
  };

  const toggleCamera = async () => {
    if (isWeb) {
      try { const t = localTracksRef.current.videoTrack; if (!t) return; await t.setEnabled(!cameraOn); setCameraOn((v) => !v); } catch {}
    } else {
      const engine = nativeEngineRef.current;
      if (!engine) return;
      engine.muteLocalVideoStream(cameraOn);
      setCameraOn((v) => !v);
    }
  };

  const switchCamera = async () => {
    if (isWeb) {
      try {
        const AgoraRTC = AgoraRTCRef.current;
        const vt = localTracksRef.current.videoTrack;
        if (!AgoraRTC || !vt) return;
        const cams = await AgoraRTC.getCameras();
        if (!cams || cams.length < 2) return;
        const cur = vt.getTrackLabel ? vt.getTrackLabel() : '';
        const idx = cams.findIndex((c: any) => String(cur).includes(String(c.label)));
        await vt.setDevice(cams[(idx + 1) % cams.length].deviceId);
      } catch {}
    } else {
      const engine = nativeEngineRef.current;
      if (engine) engine.switchCamera();
    }
  };

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text) return;
    const senderName = user?.full_name || (user?.role === 'teacher' ? 'Teacher' : 'Student');
    const now = new Date().toISOString();
    setChatMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, senderName, text, at: now, mine: true }]);
    setChatInput('');
    setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    const client = rtcClientRef.current;
    if (client && isWeb) {
      try {
        if (dataStreamIdRef.current === null) await setupDataStream();
        if (dataStreamIdRef.current === null) throw new Error('Chat stream not ready');
        const payload = JSON.stringify({ type: 'chat', senderName, text, at: now });
        try { await client.sendStreamMessage(dataStreamIdRef.current, payload); }
        catch { if (typeof TextEncoder !== 'undefined') await client.sendStreamMessage(dataStreamIdRef.current, new TextEncoder().encode(payload)); }
      } catch (e) { console.warn('Failed to send stream message:', e); }
    }
  };

  // ─── RENDER ──────────────────────────────────────────────

  if (loading || authLoading) {
    return (
      <View style={st.container}>
        <StatusBar style="light" />
        <View style={st.centered}>
          <LingoCard style={st.stateCard}>
            <View style={st.loadingRing}><ActivityIndicator size="large" color={LingoTheme.colors.primary} /></View>
            <ThemedText style={st.loadingTitle}>Preparing Classroom</ThemedText>
            <ThemedText style={st.loadingSub}>Setting up your live session…</ThemedText>
          </LingoCard>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={st.container}>
        <StatusBar style="light" />
        <View style={st.centered}>
          <LingoCard style={st.stateCard}>
            <LingoEmptyState icon="warning-outline" title="Something went wrong" subtitle={error} tone="danger" />
            <TouchableOpacity style={st.errorBtn} onPress={goBackWithoutEnding}>
              <Ionicons name="arrow-back" size={18} color="#FFF" />
              <ThemedText style={st.errorBtnText}>Go Back</ThemedText>
            </TouchableOpacity>
          </LingoCard>
        </View>
      </View>
    );
  }

  if (!joined) {
    return (
      <View style={st.container}>
        <StatusBar style="light" />
        <View style={st.lobbyHeaderWrap}>
          <LingoScreenHeader
            title="IlmConnect Classroom"
            subtitle={classDetails?.teacher_name ? `Get ready for ${classDetails.teacher_name}` : 'Get your camera and mic ready before joining.'}
            badge="Live lesson"
            icon="videocam-outline"
            onBack={goBackWithoutEnding}
          >
            <View style={st.lobbyMetaRow}>
              <LingoBadge label={classDetails?.subject || 'Class Session'} icon="book-outline" tone="teal" />
              {!!classDetails?.duration_minutes && (
                <LingoBadge label={`${classDetails.duration_minutes} min`} icon="time-outline" tone="gold" />
              )}
            </View>
          </LingoScreenHeader>
        </View>
        <View style={st.centered}>
          <View style={st.previewBox}>
            <LinearGradient colors={['#0F172A', '#1E293B']} style={st.previewInner}>
              <View style={st.previewAvatar}>
                <ThemedText style={st.previewInitial}>{user?.full_name?.charAt(0)?.toUpperCase() || '?'}</ThemedText>
              </View>
              <ThemedText style={st.previewName}>{user?.full_name || 'You'}</ThemedText>
              <ThemedText style={st.previewRole}>{user?.role === 'teacher' ? '🎓 Teacher' : '📖 Student'}</ThemedText>
            </LinearGradient>
            <View style={st.previewCtrls}>
              <TouchableOpacity style={[st.previewCtrl, !micOn && st.previewCtrlOff]} onPress={() => setMicOn(v => !v)}>
                <Ionicons name={micOn ? 'mic' : 'mic-off'} size={20} color={micOn ? '#FFF' : '#F87171'} />
              </TouchableOpacity>
              <TouchableOpacity style={[st.previewCtrl, !cameraOn && st.previewCtrlOff]} onPress={() => setCameraOn(v => !v)}>
                <Ionicons name={cameraOn ? 'videocam' : 'videocam-off'} size={20} color={cameraOn ? '#FFF' : '#F87171'} />
              </TouchableOpacity>
            </View>
          </View>
          <ThemedText style={st.lobbySubject}>{classDetails?.subject || 'Class Session'}</ThemedText>
          <ThemedText style={st.lobbyTeacher}>{user?.role === 'teacher' ? 'You are hosting' : `With ${classDetails?.teacher_name || 'Teacher'}`}</ThemedText>
          <TouchableOpacity style={[st.joinBtn, joining && { opacity: 0.6 }]} onPress={joinClass} disabled={joining} activeOpacity={0.85}>
            <LinearGradient colors={joining ? ['#475569', '#475569'] : ['#14B8A6', '#0D9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.joinGrad}>
              {joining ? <ActivityIndicator size="small" color="#FFF" /> : (
                <>
                  <Ionicons name="videocam" size={20} color="#FFF" style={{ marginRight: 10 }} />
                  <ThemedText style={st.joinText}>{user?.role === 'teacher' ? 'Start Class' : 'Join Now'}</ThemedText>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ═══════════════════════════════════════════════════════════
   *  IN-CALL VIEW
   * ═══════════════════════════════════════════════════════════ */
  return (
    <View style={st.container}>
      <StatusBar style="light" />
      <View style={st.topBar}>
        <View style={st.topLeft}>
          <View style={st.liveChip}>
            <Animated.View style={[st.liveDot, { opacity: pulseAnim }]} />
            <ThemedText style={st.liveLabel}>LIVE</ThemedText>
          </View>
          <ThemedText style={st.topTimer}>{formatElapsed(elapsed)}</ThemedText>
        </View>
        <ThemedText style={st.topTitle} numberOfLines={1}>{classDetails?.subject || 'Live Class'}</ThemedText>
        <View style={st.topRight}>
          <View style={st.participantChip}>
            <Ionicons name="people" size={14} color="#94A3B8" />
            <ThemedText style={st.participantText}>{participantCount}</ThemedText>
          </View>
        </View>
      </View>

      <View style={st.videoArea}>
        {isWeb ? (
          <>
            <div id="remote-grid" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0B1120' }}>
              {remoteUids.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column' as any, alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 88, height: 88, borderRadius: 44, background: 'linear-gradient(135deg, #1E293B, #334155)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ fontSize: 36, color: 'rgba(255,255,255,0.25)' }}>👤</span>
                  </div>
                  <span style={{ color: '#475569', fontSize: 15, fontWeight: '500' }}>Waiting for participant…</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, background: 'rgba(78,205,196,0.08)', border: '1px solid rgba(78,205,196,0.15)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: '#4ECDC4' }} />
                    <span style={{ color: '#4ECDC4', fontSize: 12, fontWeight: '600' }}>Connected</span>
                  </div>
                </div>
              ) : (
                remoteUids.map((uid) => (
                  <div key={uid} id={`remote-player-${uid}`} style={{
                    position: 'absolute', inset: 0,
                    ...(remoteUids.length === 1 ? {} : { position: 'relative' as any, width: remoteUids.length <= 2 ? '100%' : '50%', height: '50%', flex: '1 1 auto' }),
                    background: '#111827', borderRadius: remoteUids.length > 1 ? 4 : 0, overflow: 'hidden',
                  }} />
                ))
              )}
            </div>
            <div id="local-player" style={{
              position: 'absolute', bottom: 100, right: 16, width: 120, height: 160, borderRadius: 14, overflow: 'hidden',
              border: '2px solid rgba(78,205,196,0.5)', background: '#0F172A', zIndex: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 8px', background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', zIndex: 10 }}>
                <span style={{ color: '#FFF', fontSize: 10, fontWeight: '600' }}>You</span>
              </div>
            </div>
          </>
        ) : RtcSurfaceView ? (
          <View style={st.nativeVideoContainer}>
            {remoteUids.length > 0 ? (
              <View style={st.nativeRemoteGrid}>
                {remoteUids.map((remoteUid) => (
                  <View
                    key={remoteUid}
                    style={[
                      st.nativeRemoteTile,
                      remoteUids.length === 1 ? st.nativeRemoteTileSingle : st.nativeRemoteTileSplit,
                    ]}
                  >
                    <RtcSurfaceView style={st.nativeRemoteVideo} canvas={{ uid: remoteUid }} />
                  </View>
                ))}
              </View>
            ) : (
              <View style={st.nativeWaiting}>
                <View style={st.nativeWaitingCircle}>
                  <Ionicons name="person" size={40} color="rgba(255,255,255,0.2)" />
                </View>
                <ThemedText style={st.nativeWaitingText}>Waiting for participant…</ThemedText>
                <View style={st.nativeConnectedBadge}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ECDC4' }} />
                  <ThemedText style={{ color: '#4ECDC4', fontSize: 12, fontWeight: '600' }}>Connected</ThemedText>
                </View>
              </View>
            )}
            <View style={st.nativeLocalPip}>
              <RtcSurfaceView style={st.nativeLocalVideo} canvas={{ uid: 0 }} zOrderMediaOverlay />
              <View style={st.nativeLocalLabel}>
                <ThemedText style={{ color: '#FFF', fontSize: 10, fontWeight: '600' }}>You</ThemedText>
              </View>
            </View>
          </View>
        ) : (
          <View style={st.centered}>
            <ThemedText style={st.webHint}>Agora SDK not available. Rebuild the app with native modules.</ThemedText>
          </View>
        )}
      </View>

      <View style={st.bottomBar}>
        <TouchableOpacity onPress={toggleMic} style={[st.ctrlBtn, !micOn && st.ctrlBtnRed]} activeOpacity={0.7}>
          <Ionicons name={micOn ? 'mic' : 'mic-off'} size={24} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleCamera} style={[st.ctrlBtn, !cameraOn && st.ctrlBtnRed]} activeOpacity={0.7}>
          <Ionicons name={cameraOn ? 'videocam' : 'videocam-off'} size={24} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={switchCamera} style={st.ctrlBtn} activeOpacity={0.7}>
          <Ionicons name="camera-reverse-outline" size={24} color="#FFF" />
        </TouchableOpacity>
        {isWeb && (
          <TouchableOpacity onPress={() => setChatOpen((v) => !v)} style={[st.ctrlBtn, chatOpen && st.ctrlBtnTeal]} activeOpacity={0.7}>
            <Ionicons name="chatbubble-ellipses" size={22} color="#FFF" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={user?.role === 'teacher' ? handleEndClass : goBackWithoutEnding} style={st.endBtn} activeOpacity={0.8}>
          <Ionicons name={user?.role === 'teacher' ? 'call' : 'exit-outline'} size={24} color="#FFF"
            style={user?.role === 'teacher' ? { transform: [{ rotate: '135deg' }] } : undefined} />
        </TouchableOpacity>
      </View>

      {isWeb && chatOpen && (
        <View style={st.chatPanel}>
          <View style={st.chatHeader}>
            <ThemedText style={st.chatTitle}>Chat</ThemedText>
            <TouchableOpacity onPress={() => setChatOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>
          <ScrollView ref={chatScrollRef} style={st.chatList} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
            {chatMessages.length === 0 && (
              <LingoCard style={st.emptyChatCard}>
                <LingoEmptyState icon="chatbubbles-outline" title="No messages yet" subtitle="Messages shared during the lesson will appear here." tone="teal" />
              </LingoCard>
            )}
            {chatMessages.map((m) => (
              <View key={m.id} style={[st.bubble, m.mine ? st.bubbleMine : st.bubbleOther]}>
                {!m.mine && <ThemedText style={st.bubbleSender}>{m.senderName}</ThemedText>}
                <ThemedText style={[st.bubbleText, m.mine && { color: '#FFF' }]}>{m.text}</ThemedText>
                <ThemedText style={[st.bubbleTime, m.mine && { color: 'rgba(255,255,255,0.5)' }]}>
                  {new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </ThemedText>
              </View>
            ))}
          </ScrollView>
          <View style={st.chatInputRow}>
            <TextInput style={st.chatInput} placeholder="Type a message…" placeholderTextColor="#64748B" value={chatInput} onChangeText={setChatInput} onSubmitEditing={sendChatMessage} returnKeyType="send" />
            <TouchableOpacity onPress={sendChatMessage} activeOpacity={0.8}>
              <LinearGradient colors={['#14B8A6', '#0D9488']} style={st.sendBtn}>
                <Ionicons name="send" size={16} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  stateCard: { width: '100%', maxWidth: 420, alignItems: 'center' },
  loadingRing: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(78,205,196,0.08)', borderWidth: 2, borderColor: 'rgba(78,205,196,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  loadingTitle: { color: '#F1F5F9', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  loadingSub: { color: '#64748B', fontSize: 14 },
  errorBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  errorBtnText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
  lobbyHeaderWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  lobbyMetaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  previewBox: { width: Math.min(SCREEN_W - 80, 300), height: 220, borderRadius: 20, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  previewInner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  previewAvatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(78,205,196,0.12)', borderWidth: 2, borderColor: 'rgba(78,205,196,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  previewInitial: { color: '#4ECDC4', fontSize: 28, fontWeight: '800' },
  previewName: { color: '#F1F5F9', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  previewRole: { color: '#94A3B8', fontSize: 13 },
  previewCtrls: { position: 'absolute', bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 12 },
  previewCtrl: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  previewCtrlOff: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.25)' },
  lobbySubject: { color: '#F1F5F9', fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  lobbyTeacher: { color: '#94A3B8', fontSize: 14, textAlign: 'center', marginBottom: 14 },
  joinBtn: { borderRadius: 16, overflow: 'hidden', shadowColor: '#14B8A6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 8 },
  joinGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, paddingHorizontal: 44 },
  joinText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  webHint: { color: '#475569', fontSize: 12, marginTop: 16, textAlign: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 14, paddingBottom: 8, backgroundColor: 'rgba(11,17,32,0.92)' },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveLabel: { color: '#FCA5A5', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  topTimer: { color: '#64748B', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  topTitle: { color: '#E2E8F0', fontSize: 14, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  topRight: { flexDirection: 'row', alignItems: 'center' },
  participantChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  participantText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  videoArea: { flex: 1, position: 'relative' },
  nativeVideoContainer: { flex: 1, backgroundColor: '#0B1120' },
  nativeRemoteGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  nativeRemoteTile: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  nativeRemoteTileSingle: { width: '100%', height: '100%' },
  nativeRemoteTileSplit: { width: '50%', height: '50%' },
  nativeRemoteVideo: { flex: 1 },
  nativeWaiting: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B1120' },
  nativeWaitingCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  nativeWaitingText: { color: '#475569', fontSize: 15, fontWeight: '500', marginBottom: 12 },
  nativeConnectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(78,205,196,0.08)', borderWidth: 1, borderColor: 'rgba(78,205,196,0.15)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  nativeLocalPip: { position: 'absolute', bottom: 16, right: 16, width: 120, height: 160, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(78,205,196,0.5)', backgroundColor: '#0F172A', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10 },
  nativeLocalVideo: { flex: 1 },
  nativeLocalLabel: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 2, paddingHorizontal: 8, backgroundColor: 'rgba(0,0,0,0.5)' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 32 : 16, backgroundColor: 'rgba(15,23,42,0.95)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  ctrlBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  ctrlBtnRed: { backgroundColor: 'rgba(239,68,68,0.2)' },
  ctrlBtnTeal: { backgroundColor: 'rgba(78,205,196,0.2)' },
  endBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', shadowColor: '#DC2626', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  chatPanel: { position: 'absolute', right: 0, top: 0, bottom: 0, width: Math.min(SCREEN_W * 0.85, 340), backgroundColor: 'rgba(15,23,42,0.98)', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.06)', zIndex: 50 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  chatTitle: { color: '#F1F5F9', fontWeight: '700', fontSize: 17 },
  chatList: { flex: 1, paddingHorizontal: 14, paddingTop: 10 },
  emptyChatCard: { marginTop: 16 },
  bubble: { marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, maxWidth: '85%' },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#0D9488', borderBottomRightRadius: 4 },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: '#1E293B', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderBottomLeftRadius: 4 },
  bubbleSender: { color: '#4ECDC4', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  bubbleText: { color: '#E2E8F0', fontSize: 14, lineHeight: 19 },
  bubbleTime: { fontSize: 10, color: '#475569', marginTop: 3, textAlign: 'right' },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, paddingBottom: Platform.OS === 'ios' ? 30 : 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  chatInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', color: '#F1F5F9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  sendBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
