import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { LingoBadge, LingoButton, LingoCard, LingoEmptyState } from '@/components/ui/lingo-mobile';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/config';
import { useSafePadding } from '@/hooks/use-safe-padding';
import { LingoTheme } from '@/constants/theme';

interface TeacherSession {
  id: string;
  session_date: string;
  duration_minutes?: number;
  status?: 'upcoming' | 'completed' | 'cancelled';
  live_status?: 'scheduled' | 'live' | 'ended';
  delivery_mode?: 'live' | 'prerecorded';
  courses?: {
    title?: string;
  };
  students?: { name: string } | { name: string }[] | null;
}

interface TeacherStudent {
  id: string;
  name: string;
  parent_name?: string | null;
}

interface SelectedVideo {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number | null;
}

const formatSessionDate = (value?: string) => {
  const date = new Date(String(value || ''));
  if (!Number.isFinite(date.getTime())) return 'Scheduled class';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getStudentLabel = (session?: TeacherSession | null) => {
  if (!session?.students) return 'Booked students';
  if (Array.isArray(session.students)) {
    return session.students.map((student) => student?.name || 'Student').join(', ');
  }
  return session.students?.name || 'Booked students';
};

const toBase64Payload = async (file: SelectedVideo) => {
  if (Platform.OS === 'web') {
    const response = await fetch(file.uri);
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read selected video'));
      reader.readAsDataURL(blob);
    });
    return dataUrl;
  }

  const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
  const mime = file.mimeType || 'video/mp4';
  return `data:${mime};base64,${base64}`;
};

export default function UploadRecordingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string; sessionTitle?: string }>();
  const { user } = useAuth();
  const { topPadding, bottomPadding } = useSafePadding();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sessions, setSessions] = useState<TeacherSession[]>([]);
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(typeof params.sessionId === 'string' ? params.sessionId : '');
  const [title, setTitle] = useState(typeof params.sessionTitle === 'string' ? params.sessionTitle : '');
  const [description, setDescription] = useState('');
  const [durationSeconds, setDurationSeconds] = useState('');
  const [visibility, setVisibility] = useState<'paid' | 'free'>('paid');
  const [grantToBookedStudents, setGrantToBookedStudents] = useState(Boolean(params.sessionId));
  const [fulfillBooking, setFulfillBooking] = useState(Boolean(params.sessionId));
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | null>(null);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) || null,
    [sessions, selectedSessionId]
  );

  const loadData = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!user?.id) return;
    try {
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);

      const [scheduleResponse, studentsResponse] = await Promise.all([
        authFetch(api.teacherSchedule(user.id)),
        authFetch(api.teacherStudents(user.id)),
      ]);

      const [scheduleData, studentsData] = await Promise.all([
        scheduleResponse.json().catch(() => ({})),
        studentsResponse.json().catch(() => ({})),
      ]);

      if (!scheduleResponse.ok) {
        throw new Error(scheduleData?.error || 'Failed to load sessions');
      }

      if (!studentsResponse.ok) {
        throw new Error(studentsData?.error || 'Failed to load students');
      }

      setSessions((scheduleData.sessions || []).filter((session: TeacherSession) => session.status !== 'cancelled'));
      setStudents(studentsData.students || []);
    } catch (error: any) {
      Alert.alert('Error', String(error?.message || 'Unable to load recording form'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!selectedSession) {
      if (!params.sessionId) {
        setGrantToBookedStudents(false);
        setFulfillBooking(false);
      }
      return;
    }

    if (!title.trim()) {
      setTitle(selectedSession.courses?.title || 'Recorded Class');
    }
  }, [selectedSession?.id]);

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    );
  };

  const pickVideo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: ['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm'],
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const fileSize = typeof asset.size === 'number' ? asset.size : null;

      if (Platform.OS !== 'web') {
        const info = await FileSystem.getInfoAsync(asset.uri);
        const nativeSize = info.exists && typeof info.size === 'number' ? info.size : fileSize;
        if (nativeSize && nativeSize > 300 * 1024 * 1024) {
          Alert.alert('Video too large', 'Please select a video smaller than 300MB.');
          return;
        }
      }

      const nextVideo = {
        uri: asset.uri,
        name: asset.name || `recording-${Date.now()}.mp4`,
        mimeType: asset.mimeType,
        size: fileSize,
      };

      setSelectedVideo(nextVideo);
      if (!title.trim()) {
        setTitle(nextVideo.name.replace(/\.[^/.]+$/, ''));
      }
    } catch (error: any) {
      Alert.alert('Error', String(error?.message || 'Failed to pick video'));
    }
  };

  const submit = async () => {
    if (!user?.id) return;
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a title for this prerecorded class.');
      return;
    }
    if (!selectedVideo) {
      Alert.alert('Video required', 'Please choose a video to upload.');
      return;
    }
    const hasAutomaticRecipients = Boolean(selectedSessionId && grantToBookedStudents);
    if (visibility === 'paid' && !hasAutomaticRecipients && selectedStudentIds.length === 0) {
      Alert.alert('Choose recipients', 'Select at least one student or link this recording to a booked session.');
      return;
    }

    try {
      setUploading(true);

      const ext = selectedVideo.name.split('.').pop()?.toLowerCase() || 'mp4';
      const videoPayload = await toBase64Payload(selectedVideo);
      const response = await authFetch(api.uploadClassRecording(user.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: selectedSessionId || null,
          title: title.trim(),
          description: description.trim() || null,
          visibility,
          durationSeconds: durationSeconds.trim() ? Number(durationSeconds) : null,
          video: videoPayload,
          fileExtension: ext,
          studentIds: selectedStudentIds,
          grantToBookedStudents: Boolean(selectedSessionId && grantToBookedStudents),
          fulfillBooking: Boolean(selectedSessionId && fulfillBooking),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to upload recording');
      }

      Alert.alert(
        'Recording uploaded',
        data?.booking_fulfilled
          ? `The booking has been fulfilled with a prerecorded lesson and ${data?.granted_student_count || 0} student access grant(s) were created.`
          : `Upload completed successfully. ${data?.granted_student_count || 0} student access grant(s) were created.`
      );
      router.back();
    } catch (error: any) {
      Alert.alert('Upload failed', String(error?.message || 'Failed to upload recording'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding, paddingBottom: bottomPadding + (Platform.OS === 'ios' ? 120 : 100) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData('refresh')} tintColor={LingoTheme.colors.primary} />}
      >
        <View style={styles.header}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={22} color="#3C3C3C" />
            </TouchableOpacity>
            <View style={styles.topBarCenter}>
              <ThemedText style={styles.topBarTitle}>Upload Recording</ThemedText>
              <ThemedText style={styles.topBarSub}>Fulfill bookings with a video</ThemedText>
            </View>
            <View style={{ width: 44 }} />
          </View>
          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.metricPill}>
              <Ionicons name="film-outline" size={20} color="#F59E0B" />
              <ThemedText style={styles.pillValue}>{sessions.length}</ThemedText>
              <ThemedText style={styles.pillLabel}>Sessions</ThemedText>
            </View>
            <View style={styles.metricPill}>
              <Ionicons name="people-outline" size={20} color="#F59E0B" />
              <ThemedText style={styles.pillValue}>{students.length}</ThemedText>
              <ThemedText style={styles.pillLabel}>Students</ThemedText>
            </View>
            <View style={styles.metricPill}>
              <Ionicons name={selectedVideo ? 'cloud-done-outline' : 'cloud-upload-outline'} size={20} color={selectedVideo ? '#10B981' : '#AFAFAF'} />
              <ThemedText style={styles.pillValue}>{selectedVideo ? 'Ready' : 'No file'}</ThemedText>
              <ThemedText style={styles.pillLabel}>Video</ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {loading ? (
            <LingoCard style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={LingoTheme.colors.primary} />
              <ThemedText style={styles.loadingText}>Loading recording form...</ThemedText>
            </LingoCard>
          ) : (
            <>
              <LingoCard style={styles.card}>
                <ThemedText style={styles.sectionTitle}>Delivery mode</ThemedText>
                <ThemedText style={styles.sectionSubtitle}>Choose whether this upload fulfills a booked class or stays standalone.</ThemedText>

                <View style={styles.modeRow}>
                  <TouchableOpacity
                    style={[styles.modeCard, !selectedSessionId && styles.modeCardActive]}
                    onPress={() => {
                      setSelectedSessionId('');
                      setGrantToBookedStudents(false);
                      setFulfillBooking(false);
                    }}
                  >
                    <Ionicons name="albums-outline" size={20} color={!selectedSessionId ? '#0F766E' : '#6B7280'} />
                    <ThemedText style={[styles.modeTitle, !selectedSessionId && styles.modeTitleActive]}>Standalone</ThemedText>
                    <ThemedText style={styles.modeCopy}>Grant access directly without a live session.</ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modeCard, !!selectedSessionId && styles.modeCardActive]}
                    onPress={() => {
                      const firstAvailable = sessions.find((session) => session.status !== 'cancelled');
                      if (firstAvailable) {
                        setSelectedSessionId(firstAvailable.id);
                        setGrantToBookedStudents(true);
                        setFulfillBooking(true);
                      }
                    }}
                    disabled={sessions.length === 0}
                  >
                    <Ionicons name="calendar-outline" size={20} color={selectedSessionId ? '#0F766E' : '#6B7280'} />
                    <ThemedText style={[styles.modeTitle, !!selectedSessionId && styles.modeTitleActive]}>Booked class</ThemedText>
                    <ThemedText style={styles.modeCopy}>Use a recording to fulfill an existing booking.</ThemedText>
                  </TouchableOpacity>
                </View>

                {sessions.length > 0 ? (
                  <View style={styles.sessionList}>
                    {sessions.slice(0, 8).map((session) => {
                      const active = session.id === selectedSessionId;
                      return (
                        <TouchableOpacity
                          key={session.id}
                          style={[styles.sessionCard, active && styles.sessionCardActive]}
                          onPress={() => {
                            setSelectedSessionId(session.id);
                            setGrantToBookedStudents(true);
                            setFulfillBooking(true);
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <ThemedText style={[styles.sessionTitle, active && styles.sessionTitleActive]}>
                              {session.courses?.title || 'Private Tutoring'}
                            </ThemedText>
                            <ThemedText style={styles.sessionMeta}>{formatSessionDate(session.session_date)}</ThemedText>
                            <ThemedText style={styles.sessionMeta}>{getStudentLabel(session)}</ThemedText>
                          </View>
                          {session.delivery_mode === 'prerecorded' ? (
                            <View style={styles.smallBadge}>
                              <ThemedText style={styles.smallBadgeText}>Prerecorded</ThemedText>
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}

                {selectedSession ? (
                  <View style={styles.optionBox}>
                    <TouchableOpacity style={styles.optionRow} onPress={() => setGrantToBookedStudents((value) => !value)}>
                      <Ionicons name={grantToBookedStudents ? 'checkbox' : 'square-outline'} size={20} color="#0F766E" />
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.optionTitle}>Grant access to booked students</ThemedText>
                        <ThemedText style={styles.optionCopy}>{getStudentLabel(selectedSession)}</ThemedText>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.optionRow} onPress={() => setFulfillBooking((value) => !value)}>
                      <Ionicons name={fulfillBooking ? 'checkbox' : 'square-outline'} size={20} color="#0F766E" />
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.optionTitle}>Mark booking fulfilled as prerecorded</ThemedText>
                        <ThemedText style={styles.optionCopy}>This ends the booking and flags it as delivered by recording.</ThemedText>
                      </View>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </LingoCard>

              <LingoCard style={styles.card}>
                <ThemedText style={styles.sectionTitle}>Recording details</ThemedText>
                <View style={styles.fieldGroup}>
                  <ThemedText style={styles.label}>Title</ThemedText>
                  <TextInput value={title} onChangeText={setTitle} placeholder="Recorded lesson title" placeholderTextColor="#9CA3AF" style={styles.input} />
                </View>
                <View style={styles.fieldGroup}>
                  <ThemedText style={styles.label}>Description</ThemedText>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="What does this class cover?"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    textAlignVertical="top"
                    style={[styles.input, styles.textarea]}
                  />
                </View>
                <View style={styles.inlineRow}>
                  <View style={[styles.fieldGroup, styles.inlineField]}>
                    <ThemedText style={styles.label}>Duration (seconds)</ThemedText>
                    <TextInput
                      value={durationSeconds}
                      onChangeText={setDurationSeconds}
                      placeholder="1800"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      style={styles.input}
                    />
                  </View>
                  <View style={[styles.fieldGroup, styles.inlineField]}>
                    <ThemedText style={styles.label}>Access</ThemedText>
                    <View style={styles.visibilityRow}>
                      {(['paid', 'free'] as const).map((value) => (
                        <TouchableOpacity
                          key={value}
                          style={[styles.visibilityChip, visibility === value && styles.visibilityChipActive]}
                          onPress={() => setVisibility(value)}
                        >
                          <ThemedText style={[styles.visibilityChipText, visibility === value && styles.visibilityChipTextActive]}>
                            {value === 'paid' ? 'Paid' : 'Free'}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={styles.videoPicker} onPress={pickVideo} activeOpacity={0.85}>
                  <Ionicons name="cloud-upload-outline" size={22} color="#0F766E" />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.videoPickerTitle}>{selectedVideo ? selectedVideo.name : 'Choose video file'}</ThemedText>
                    <ThemedText style={styles.videoPickerCopy}>
                      {selectedVideo?.size ? `${(selectedVideo.size / (1024 * 1024)).toFixed(1)} MB selected` : 'MP4, MOV, WEBM, or M4V'}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              </LingoCard>

              <LingoCard style={styles.card}>
                <ThemedText style={styles.sectionTitle}>Student access</ThemedText>
                <ThemedText style={styles.sectionSubtitle}>
                  {selectedSessionId && grantToBookedStudents
                    ? 'Booked students will be granted automatically. You can also add extra students below.'
                    : 'Choose which students should unlock this prerecorded class.'}
                </ThemedText>
                <View style={styles.studentWrap}>
                  {students.length === 0 ? (
                    <LingoEmptyState icon="people-outline" title="No students found" subtitle="Students will appear here after bookings are created." tone="teal" />
                  ) : (
                    students.map((student) => {
                      const active = selectedStudentIds.includes(student.id);
                      return (
                        <TouchableOpacity
                          key={student.id}
                          style={[styles.studentChip, active && styles.studentChipActive]}
                          onPress={() => toggleStudent(student.id)}
                        >
                          <ThemedText style={[styles.studentChipText, active && styles.studentChipTextActive]}>
                            {student.name}
                          </ThemedText>
                          {student.parent_name ? (
                            <ThemedText style={[styles.studentChipMeta, active && styles.studentChipTextActive]}>
                              {student.parent_name}
                            </ThemedText>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </LingoCard>

              <LingoButton
                label={uploading ? 'Uploading…' : 'Upload prerecorded class'}
                icon="checkmark-circle-outline"
                onPress={submit}
                loading={uploading}
                style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
              />
            </>
          )}
        </View>
      </ScrollView>
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
    gap: 20,
  },
  header: { paddingHorizontal: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  backButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 2, borderColor: '#E5E5E5', borderBottomWidth: 4,
    justifyContent: 'center', alignItems: 'center',
  },
  topBarCenter: { flex: 1, alignItems: 'center' },
  topBarTitle: { fontSize: 20, fontWeight: '800', color: '#3C3C3C' },
  topBarSub: { fontSize: 13, color: '#AFAFAF', fontWeight: '600', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginBottom: 8 },
  metricPill: {
    flex: 1, alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, borderWidth: 2, borderColor: '#E5E5E5', borderBottomWidth: 4,
    paddingVertical: 12, paddingHorizontal: 4, gap: 2,
  },
  pillValue: { fontSize: 15, fontWeight: '800', color: '#3C3C3C' },
  pillLabel: { fontSize: 10, fontWeight: '700', color: '#AFAFAF', textTransform: 'uppercase' },
  content: {
    paddingHorizontal: 20,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '700',
    color: LingoTheme.colors.muted,
  },
  card: {
    padding: 18,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: LingoTheme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modeCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    borderRadius: 18,
    padding: 14,
    backgroundColor: LingoTheme.colors.surfaceAlt,
  },
  modeCardActive: {
    borderColor: LingoTheme.colors.teal,
    backgroundColor: LingoTheme.colors.softTeal,
  },
  modeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginTop: 10,
    marginBottom: 4,
  },
  modeTitleActive: {
    color: '#0F766E',
  },
  modeCopy: {
    color: LingoTheme.colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  sessionList: {
    marginTop: 14,
    gap: 10,
  },
  sessionCard: {
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  sessionCardActive: {
    borderColor: LingoTheme.colors.teal,
    backgroundColor: LingoTheme.colors.softTeal,
  },
  sessionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  sessionTitleActive: {
    color: '#0F766E',
  },
  sessionMeta: {
    color: LingoTheme.colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  smallBadge: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  smallBadgeText: {
    color: '#0F766E',
    fontSize: 11,
    fontWeight: '700',
  },
  optionBox: {
    marginTop: 14,
    gap: 12,
    backgroundColor: LingoTheme.colors.surfaceAlt,
    borderRadius: 18,
    padding: 14,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: LingoTheme.colors.ink,
    marginBottom: 2,
  },
  optionCopy: {
    fontSize: 12,
    color: LingoTheme.colors.muted,
    lineHeight: 17,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: LingoTheme.colors.ink,
    fontSize: 14,
  },
  textarea: {
    minHeight: 110,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inlineField: {
    flex: 1,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  visibilityChip: {
    flex: 1,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    backgroundColor: LingoTheme.colors.surfaceAlt,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  visibilityChipActive: {
    borderColor: LingoTheme.colors.teal,
    backgroundColor: LingoTheme.colors.softTeal,
  },
  visibilityChipText: {
    color: LingoTheme.colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  visibilityChipTextActive: {
    color: '#0F766E',
  },
  videoPicker: {
    marginTop: 4,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: LingoTheme.colors.teal,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: LingoTheme.colors.softTeal,
  },
  videoPickerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: LingoTheme.colors.ink,
    marginBottom: 2,
  },
  videoPickerCopy: {
    fontSize: 12,
    color: LingoTheme.colors.muted,
  },
  studentWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  studentChip: {
    minWidth: '47%',
    backgroundColor: LingoTheme.colors.surfaceAlt,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  studentChipActive: {
    backgroundColor: LingoTheme.colors.primary,
    borderColor: LingoTheme.colors.primaryDark,
  },
  studentChipText: {
    color: LingoTheme.colors.ink,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  studentChipTextActive: {
    color: '#FFFFFF',
  },
  studentChipMeta: {
    color: LingoTheme.colors.muted,
    fontSize: 11,
  },
  emptyCopy: {
    color: LingoTheme.colors.muted,
    fontSize: 13,
  },
  submitButton: {
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
});