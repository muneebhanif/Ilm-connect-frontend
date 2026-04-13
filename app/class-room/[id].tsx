import { StyleSheet, View, TouchableOpacity, Alert, Platform, ActivityIndicator, TextInput, ScrollView, Animated, Dimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/config';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { authFetch, authFetchJson } from '@/lib/auth-fetch';
import { LinearGradient } from 'expo-linear-gradient';

const isWeb = Platform.OS === 'web';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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
  const [elapsed, setElapsed] = useState(0);
  const [participantCount, setParticipantCount] = useState(1);

  const rtcClientRef = useRef<any>(null);
  const AgoraRTCRef = useRef<any>(null);
  const localTracksRef = useRef<{ audioTrack?: any; videoTrack?: any }>({});
  const hasEndedRef = useRef(false);
  const joinedRef = useRef(false);
  const joiningRef = useRef(false);
  const dataStreamIdRef = useRef<number | null>(null);
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

  useEffect(() => { return () => { void cleanupAgora(); }; }, []);

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

  useEffect(() => {
    if (!isWeb || !joined || remoteUids.length === 0) return;
    const t = setTimeout(() => remoteUids.forEach((uid) => renderRemoteVideo(uid)), 0);
    return () => clearTimeout(t);
  }, [remoteUids, joined]);

  // Update participant count
  useEffect(() => {
    setParticipantCount(1 + remoteUids.length);
  }, [remoteUids]);

  // ─── Agora Logic ─────────────────────────────────────────
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
        });
      } else { setError(data?.error || 'Failed to load class details'); }
    } catch (e) { console.error('Load class failed:', e); setError('Failed to load class details'); }
    finally { setLoading(false); }
  };

  const cleanupAgora = async () => {
    try {
      joinedRef.current = false; joiningRef.current = false;
      if (localTracksRef.current.audioTrack) { localTracksRef.current.audioTrack.stop(); localTracksRef.current.audioTrack.close(); }
      if (localTracksRef.current.videoTrack) { localTracksRef.current.videoTrack.stop(); localTracksRef.current.videoTrack.close(); }
      localTracksRef.current = {};
      if (rtcClientRef.current) {
        if (typeof rtcClientRef.current.removeAllListeners === 'function') rtcClientRef.current.removeAllListeners();
        await rtcClientRef.current.leave();
      }
    } catch (e) { console.warn('Cleanup warning:', e); }
    finally { rtcClientRef.current = null; dataStreamIdRef.current = null; setJoined(false); setRemoteUids([]); }
  };

  const renewToken = async () => {
    if (!id || !user?.id || !rtcClientRef.current) return;
    const role = user.role === 'teacher' ? 'HOST' : 'STUDENT';
    const tr = await authFetchJson<any>(api.agoraToken(id, user.id, role));
    if (tr.error || !tr.data?.token) return;
    await rtcClientRef.current.renewToken(tr.data.token);
  };

  const renderRemoteVideo = (uid: string) => {
    const client = rtcClientRef.current;
    if (!client) return;
    const ru = client.remoteUsers?.find((u: any) => String(u.uid) === String(uid));
    if (!ru?.videoTrack || !isWeb) return;
    const el = document.getElementById(`remote-player-${uid}`);
    if (el) ru.videoTrack.play(el);
  };

  const addRemoteUid = (uid: string) => {
    setRemoteUids((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
    setTimeout(() => renderRemoteVideo(uid), 0);
  };
  const removeRemoteUid = (uid: string) => setRemoteUids((prev) => prev.filter((x) => x !== uid));

  // ── Data Stream for Chat ──
  const setupDataStream = async () => {
    const client = rtcClientRef.current;
    if (!client || dataStreamIdRef.current !== null) return;
    try {
      const streamId = await client.createDataStream({ ordered: true, reliable: true });
      dataStreamIdRef.current = streamId;
    } catch (e) {
      console.warn('Failed to create data stream:', e);
    }
  };

  const joinClass = async () => {
    if (!id || !user?.id) return;
    if (!isWeb) { Alert.alert('Web only', 'Live class is web-enabled in this build.'); return; }
    setJoining(true); joiningRef.current = true; setError(null);
    try {
      if (user.role === 'teacher') {
        const sr = await authFetch(api.startClass(id), { method: 'POST' });
        const sd = await sr.json().catch(() => ({}));
        if (!sr.ok) throw new Error(sd?.error || 'Unable to start class');
      }
      const AgoraModule = await import('agora-rtc-sdk-ng');
      const AgoraRTC: any = (AgoraModule as any).default || AgoraModule;
      AgoraRTCRef.current = AgoraRTC;
      try { if (typeof AgoraRTC.disableLogUpload === 'function') AgoraRTC.disableLogUpload(); } catch {}
      try { if (typeof AgoraRTC.setLogLevel === 'function') AgoraRTC.setLogLevel(4); } catch {}

      const role = user.role === 'teacher' ? 'HOST' : 'STUDENT';
      const tr = await authFetchJson<any>(api.agoraToken(id, user.id, role));
      if (tr.error || !tr.data?.token) throw new Error(tr.error || 'Failed to get Agora token');
      const { token, appId, channel } = tr.data;

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      rtcClientRef.current = client;
      await client.join(appId, String(channel), token, String(user.id));
      joinedRef.current = true;

      // ── Chat: Listen for incoming data stream messages ──
      client.on('stream-message', (_uid: any, data: Uint8Array) => {
        try {
          const decoded = new TextDecoder().decode(data);
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
          if (mediaType === 'video') addRemoteUid(String(remoteUser.uid));
        } catch (subErr: any) {
          if (!String(subErr?.message || '').includes('not joined')) console.warn('Subscribe:', subErr);
        }
      };
      client.on('user-published', handleUserPublished);
      client.on('user-unpublished', (ru: any, mt: string) => { if (mt === 'video') removeRemoteUid(String(ru.uid)); });
      client.on('user-left', (ru: any) => removeRemoteUid(String(ru.uid)));
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

      // Setup data stream for chat after joining
      await setupDataStream();

      setJoined(true);
    } catch (e: any) {
      console.error('Join failed:', e);
      setError(String(e?.message || '').toLowerCase().includes('permission')
        ? 'Camera/Microphone permission denied.'
        : e?.message || 'Failed to join class');
      await cleanupAgora();
    } finally { setJoining(false); joiningRef.current = false; }
  };

  const goBackWithoutEnding = async () => {
    await cleanupAgora();
    router.replace(user?.role === 'teacher' ? '/(teacher)/schedule' : '/(student)/classes');
  };

  const endOrLeaveClass = async () => {
    if (!id || !user) return;
    if (user.role === 'teacher' && !hasEndedRef.current) {
      hasEndedRef.current = true;
      try { await authFetch(api.endClass(id), { method: 'POST' }); } catch {}
    }
    await cleanupAgora();
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
    try { const t = localTracksRef.current.audioTrack; if (!t) return; await t.setEnabled(!micOn); setMicOn((v) => !v); } catch {}
  };
  const toggleCamera = async () => {
    try { const t = localTracksRef.current.videoTrack; if (!t) return; await t.setEnabled(!cameraOn); setCameraOn((v) => !v); } catch {}
  };
  const switchCamera = async () => {
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
  };

  // ── Send chat via Agora data stream ──
  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text) return;

    const senderName = user?.full_name || (user?.role === 'teacher' ? 'Teacher' : 'Student');
    const now = new Date().toISOString();

    // Add to local messages
    setChatMessages((prev) => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      senderName, text, at: now, mine: true,
    }]);
    setChatInput('');
    setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);

    // Send to other participants via Agora data stream
    const client = rtcClientRef.current;
    if (client && dataStreamIdRef.current !== null) {
      try {
        const payload = JSON.stringify({ type: 'chat', senderName, text, at: now });
        const encoded = new TextEncoder().encode(payload);
        await client.sendStreamMessage(dataStreamIdRef.current, encoded);
      } catch (e) {
        console.warn('Failed to send stream message:', e);
      }
    }
  };

  // ─── RENDER ──────────────────────────────────────────────

  if (loading || authLoading) {
    return (
      <View style={st.container}>
        <StatusBar style="light" />
        <View style={st.centered}>
          <View style={st.loadingRing}>
            <ActivityIndicator size="large" color="#4ECDC4" />
          </View>
          <ThemedText style={st.loadingTitle}>Preparing Classroom</ThemedText>
          <ThemedText style={st.loadingSub}>Setting up your live session…</ThemedText>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={st.container}>
        <StatusBar style="light" />
        <View style={st.centered}>
          <View style={st.errorCircle}>
            <Ionicons name="warning" size={36} color="#FCA5A5" />
          </View>
          <ThemedText style={st.errorTitle}>Something went wrong</ThemedText>
          <ThemedText style={st.errorMsg}>{error}</ThemedText>
          <TouchableOpacity style={st.errorBtn} onPress={goBackWithoutEnding}>
            <Ionicons name="arrow-back" size={18} color="#FFF" />
            <ThemedText style={st.errorBtnText}>Go Back</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /** ── Pre-Join Lobby ── */
  if (!joined) {
    return (
      <View style={st.container}>
        <StatusBar style="light" />
        <View style={st.lobbyHeader}>
          <TouchableOpacity onPress={goBackWithoutEnding} style={st.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#E2E8F0" />
          </TouchableOpacity>
          <ThemedText style={st.lobbyTitle}>IlmConnect Classroom</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <View style={st.centered}>
          <View style={st.previewBox}>
            <LinearGradient colors={['#0F172A', '#1E293B']} style={st.previewInner}>
              <View style={st.previewAvatar}>
                <ThemedText style={st.previewInitial}>
                  {user?.full_name?.charAt(0)?.toUpperCase() || '?'}
                </ThemedText>
              </View>
              <ThemedText style={st.previewName}>{user?.full_name || 'You'}</ThemedText>
              <ThemedText style={st.previewRole}>
                {user?.role === 'teacher' ? '🎓 Teacher' : '📖 Student'}
              </ThemedText>
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
          <ThemedText style={st.lobbyTeacher}>
            {user?.role === 'teacher' ? 'You are hosting' : `With ${classDetails?.teacher_name || 'Teacher'}`}
          </ThemedText>

          {classDetails?.duration_minutes && (
            <View style={st.durationBadge}>
              <Ionicons name="time-outline" size={14} color="#94A3B8" />
              <ThemedText style={st.durationText}>{classDetails.duration_minutes} min</ThemedText>
            </View>
          )}

          <TouchableOpacity
            style={[st.joinBtn, joining && { opacity: 0.6 }]}
            onPress={joinClass}
            disabled={joining}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={joining ? ['#475569', '#475569'] : ['#14B8A6', '#0D9488']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={st.joinGrad}
            >
              {joining ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="videocam" size={20} color="#FFF" style={{ marginRight: 10 }} />
                  <ThemedText style={st.joinText}>
                    {user?.role === 'teacher' ? 'Start Class' : 'Join Now'}
                  </ThemedText>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {!isWeb && <ThemedText style={st.webHint}>Live classes available on web</ThemedText>}
        </View>
      </View>
    );
  }

  /* ═══════════════════════════════════════════════════════════
   *  IN-CALL VIEW — Zoom-like layout
   * ═══════════════════════════════════════════════════════════ */
  return (
    <View style={st.container}>
      <StatusBar style="light" />

      {/* ── Top Bar ── */}
      <View style={st.topBar}>
        <View style={st.topLeft}>
          <View style={st.liveChip}>
            <Animated.View style={[st.liveDot, { opacity: pulseAnim }]} />
            <ThemedText style={st.liveLabel}>LIVE</ThemedText>
          </View>
          <ThemedText style={st.topTimer}>{formatElapsed(elapsed)}</ThemedText>
        </View>

        <ThemedText style={st.topTitle} numberOfLines={1}>
          {classDetails?.subject || 'Live Class'}
        </ThemedText>

        <View style={st.topRight}>
          <View style={st.participantChip}>
            <Ionicons name="people" size={14} color="#94A3B8" />
            <ThemedText style={st.participantText}>{participantCount}</ThemedText>
          </View>
        </View>
      </View>

      {/* ── Full-Screen Video Area ── */}
      <View style={st.videoArea}>
        {isWeb ? (
          <>
            {/* Remote video fills entire area */}
            <div id="remote-grid" style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#0B1120',
            }}>
              {remoteUids.length === 0 ? (
                <div style={{
                  display: 'flex', flexDirection: 'column' as any,
                  alignItems: 'center', gap: 16,
                }}>
                  <div style={{
                    width: 88, height: 88, borderRadius: 44,
                    background: 'linear-gradient(135deg, #1E293B, #334155)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid rgba(255,255,255,0.08)',
                  }}>
                    <span style={{ fontSize: 36, color: 'rgba(255,255,255,0.25)' }}>👤</span>
                  </div>
                  <span style={{ color: '#475569', fontSize: 15, fontWeight: '500' }}>
                    Waiting for participant…
                  </span>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 14px', borderRadius: 20,
                    background: 'rgba(78,205,196,0.08)', border: '1px solid rgba(78,205,196,0.15)',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: '#4ECDC4' }} />
                    <span style={{ color: '#4ECDC4', fontSize: 12, fontWeight: '600' }}>Connected</span>
                  </div>
                </div>
              ) : (
                remoteUids.map((uid, i) => (
                  <div key={uid} id={`remote-player-${uid}`} style={{
                    position: 'absolute', inset: 0,
                    // If multiple remotes, tile them; single = fullscreen
                    ...(remoteUids.length === 1
                      ? {}
                      : {
                          position: 'relative' as any,
                          width: remoteUids.length <= 2 ? '100%' : '50%',
                          height: remoteUids.length <= 2 ? '50%' : '50%',
                          flex: '1 1 auto',
                        }),
                    background: '#111827',
                    borderRadius: remoteUids.length > 1 ? 4 : 0,
                    overflow: 'hidden',
                  }} />
                ))
              )}
            </div>

            {/* Local PiP — small, bottom-right */}
            <div id="local-player" style={{
              position: 'absolute',
              bottom: 100, right: 16,
              width: 120, height: 160,
              borderRadius: 14, overflow: 'hidden',
              border: '2px solid rgba(78,205,196,0.5)',
              background: '#0F172A',
              zIndex: 20,
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}>
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '4px 8px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                zIndex: 10,
              }}>
                <span style={{ color: '#FFF', fontSize: 10, fontWeight: '600' }}>You</span>
              </div>
            </div>
          </>
        ) : (
          <View style={st.centered}>
            <ThemedText style={st.webHint}>Web-only in this build</ThemedText>
          </View>
        )}
      </View>

      {/* ── Bottom Controls — Single Row, Zoom-like ── */}
      <View style={st.bottomBar}>
        {/* Mic */}
        <TouchableOpacity
          onPress={toggleMic}
          style={[st.ctrlBtn, !micOn && st.ctrlBtnRed]}
          activeOpacity={0.7}
        >
          <Ionicons name={micOn ? 'mic' : 'mic-off'} size={24} color="#FFF" />
        </TouchableOpacity>

        {/* Camera */}
        <TouchableOpacity
          onPress={toggleCamera}
          style={[st.ctrlBtn, !cameraOn && st.ctrlBtnRed]}
          activeOpacity={0.7}
        >
          <Ionicons name={cameraOn ? 'videocam' : 'videocam-off'} size={24} color="#FFF" />
        </TouchableOpacity>

        {/* Flip Camera */}
        <TouchableOpacity onPress={switchCamera} style={st.ctrlBtn} activeOpacity={0.7}>
          <Ionicons name="camera-reverse-outline" size={24} color="#FFF" />
        </TouchableOpacity>

        {/* Chat */}
        <TouchableOpacity
          onPress={() => setChatOpen((v) => !v)}
          style={[st.ctrlBtn, chatOpen && st.ctrlBtnTeal]}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-ellipses" size={22} color="#FFF" />
        </TouchableOpacity>

        {/* End / Leave */}
        <TouchableOpacity
          onPress={user?.role === 'teacher' ? handleEndClass : goBackWithoutEnding}
          style={st.endBtn}
          activeOpacity={0.8}
        >
          <Ionicons
            name={user?.role === 'teacher' ? 'call' : 'exit-outline'}
            size={24}
            color="#FFF"
            style={user?.role === 'teacher' ? { transform: [{ rotate: '135deg' }] } : undefined}
          />
        </TouchableOpacity>
      </View>

      {/* ── Chat Panel — Slide from right ── */}
      {chatOpen && (
        <View style={st.chatPanel}>
          <View style={st.chatHeader}>
            <ThemedText style={st.chatTitle}>Chat</ThemedText>
            <TouchableOpacity onPress={() => setChatOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={chatScrollRef}
            style={st.chatList}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {chatMessages.length === 0 && (
              <View style={st.emptyChat}>
                <Ionicons name="chatbubbles-outline" size={24} color="#334155" />
                <ThemedText style={st.emptyChatText}>No messages yet</ThemedText>
              </View>
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
            <TextInput
              style={st.chatInput}
              placeholder="Type a message…"
              placeholderTextColor="#64748B"
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={sendChatMessage}
              returnKeyType="send"
            />
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

/* ─── Styles ────────────────────────────────────────────── */
const BOTTOM_BAR_H = Platform.OS === 'ios' ? 90 : 72;

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  /* Loading */
  loadingRing: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(78,205,196,0.08)',
    borderWidth: 2, borderColor: 'rgba(78,205,196,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  loadingTitle: { color: '#F1F5F9', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  loadingSub: { color: '#64748B', fontSize: 14 },

  /* Error */
  errorCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 2, borderColor: 'rgba(239,68,68,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  errorTitle: { color: '#F1F5F9', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  errorMsg: { color: '#94A3B8', fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20, paddingHorizontal: 20 },
  errorBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  errorBtnText: { color: '#FFF', fontWeight: '600', fontSize: 15 },

  /* Lobby */
  lobbyHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 54, paddingHorizontal: 20, paddingBottom: 12,
  },
  lobbyTitle: { color: '#94A3B8', fontSize: 15, fontWeight: '600' },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  previewBox: {
    width: Math.min(SCREEN_W - 80, 300), height: 220,
    borderRadius: 20, overflow: 'hidden', marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  previewInner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  previewAvatar: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: 'rgba(78,205,196,0.12)',
    borderWidth: 2, borderColor: 'rgba(78,205,196,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  previewInitial: { color: '#4ECDC4', fontSize: 28, fontWeight: '800' },
  previewName: { color: '#F1F5F9', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  previewRole: { color: '#94A3B8', fontSize: 13 },
  previewCtrls: {
    position: 'absolute', bottom: 14, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 12,
  },
  previewCtrl: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  previewCtrlOff: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.25)' },
  lobbySubject: { color: '#F1F5F9', fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  lobbyTeacher: { color: '#94A3B8', fontSize: 14, textAlign: 'center', marginBottom: 14 },
  durationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(148,163,184,0.08)',
    paddingVertical: 5, paddingHorizontal: 14, borderRadius: 20, marginBottom: 24,
  },
  durationText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  joinBtn: { borderRadius: 16, overflow: 'hidden',
    shadowColor: '#14B8A6', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 14, elevation: 8,
  },
  joinGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, paddingHorizontal: 44 },
  joinText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  webHint: { color: '#475569', fontSize: 12, marginTop: 16, textAlign: 'center' },

  /* ── In-Call Top Bar ── */
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingHorizontal: 14, paddingBottom: 8,
    backgroundColor: 'rgba(11,17,32,0.92)',
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveLabel: { color: '#FCA5A5', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  topTimer: { color: '#64748B', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  topTitle: { color: '#E2E8F0', fontSize: 14, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  topRight: { flexDirection: 'row', alignItems: 'center' },
  participantChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  participantText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },

  /* ── Video Area ── */
  videoArea: { flex: 1, position: 'relative' },

  /* ── Bottom Bar — Zoom-like single row ── */
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  ctrlBtn: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  ctrlBtnRed: {
    backgroundColor: 'rgba(239,68,68,0.2)',
  },
  ctrlBtnTeal: {
    backgroundColor: 'rgba(78,205,196,0.2)',
  },
  endBtn: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: '#DC2626',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#DC2626', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },

  /* ── Chat Panel ── */
  chatPanel: {
    position: 'absolute',
    right: 0, top: 0, bottom: 0,
    width: Math.min(SCREEN_W * 0.85, 340),
    backgroundColor: 'rgba(15,23,42,0.98)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.06)',
    zIndex: 50,
  },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  chatTitle: { color: '#F1F5F9', fontWeight: '700', fontSize: 17 },
  chatList: { flex: 1, paddingHorizontal: 14, paddingTop: 10 },
  emptyChat: { alignItems: 'center', paddingVertical: 40, gap: 6 },
  emptyChatText: { color: '#475569', fontWeight: '600', fontSize: 13 },
  bubble: { marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, maxWidth: '85%' },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#0D9488', borderBottomRightRadius: 4 },
  bubbleOther: {
    alignSelf: 'flex-start', backgroundColor: '#1E293B',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderBottomLeftRadius: 4,
  },
  bubbleSender: { color: '#4ECDC4', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  bubbleText: { color: '#E2E8F0', fontSize: 14, lineHeight: 19 },
  bubbleTime: { fontSize: 10, color: '#475569', marginTop: 3, textAlign: 'right' },
  chatInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, paddingBottom: Platform.OS === 'ios' ? 30 : 14,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  chatInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', color: '#F1F5F9',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  sendBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
