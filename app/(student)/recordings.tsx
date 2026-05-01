import { useEffect, useState, useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View, RefreshControl, ActivityIndicator } from 'react-native';
import { StudentRecordingsSkeleton } from '@/components/ui/dashboard-skeletons';
import * as WebBrowser from 'expo-web-browser';
import { ThemedText } from '@/components/themed-text';
import { LingoCard, LingoEmptyState, LingoScreenHeader, LingoStatPill } from '@/components/ui/lingo-mobile';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/config';
import { authFetch } from '@/lib/auth-fetch';
import { Ionicons } from '@expo/vector-icons';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';
import { useFocusEffect } from '@react-navigation/native';

interface RecordingItem {
  id: string;
  title: string;
  description?: string;
  duration_seconds?: number | null;
  visibility: 'paid' | 'free';
  can_access: boolean;
  created_at: string;
  teacher?: { id: string; full_name: string };
  course?: { id: string | null; title: string };
}

const formatDuration = (seconds?: number | null) => {
  if (!seconds || !Number.isFinite(seconds)) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

export default function StudentRecordingsScreen() {
  const { user } = useAuth();
  const { topPadding, bottomPadding } = useSafePadding();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);

  useEffect(() => {
    loadRecordings();
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id && !loading) loadRecordings('background');
    }, [user?.id])
  );

  const loadRecordings = async (mode = 'initial') => {
    if (!user?.id) return;
    try {
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      const response = await authFetch(api.studentRecordings(user.id));
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to load recordings');
      setRecordings(data.recordings || []);
    } catch (error: any) {
      console.error('Load recordings error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const openRecording = async (recordingId: string, canAccess: boolean) => {
    if (!canAccess) {
      Alert.alert('Locked', 'This recording is locked. Please complete payment/unlock first.');
      return;
    }
    try {
      setOpeningId(recordingId);
      const response = await authFetch(api.recordingAccess(recordingId));
      const data = await response.json();
      if (!response.ok || !data?.signedUrl) throw new Error(data?.error || 'Unable to open recording');
      await WebBrowser.openBrowserAsync(data.signedUrl);
    } catch (error: any) {
      Alert.alert('Error', String(error?.message || 'Unable to open recording'));
    } finally {
      setOpeningId(null);
    }
  };

  if (loading) {
    return <StudentRecordingsSkeleton />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding, paddingBottom: bottomPadding + (Platform.OS === 'ios' ? 120 : 100) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadRecordings('refresh')} tintColor={LingoTheme.colors.primary} />
        }
      >
        <View style={styles.contentPad}>
          <LingoScreenHeader
            badge="Student library"
            icon="play-circle"
            title="Recordings ready when you are"
            subtitle="Open class replays, revisit lessons, and quickly spot what is unlocked or restricted."
          >
            <View style={styles.headerStatsWrap}>
              <LingoStatPill icon="🎬" value={String(recordings.length)} label="Recordings" tone="purple" />
              <LingoStatPill icon="🔓" value={String(recordings.filter((item) => item.can_access).length)} label="Open" tone="primary" />
            </View>
          </LingoScreenHeader>

          {recordings.length === 0 ? (
            <LingoCard>
              <LingoEmptyState icon="videocam-off-outline" title="No recordings yet" subtitle="Class recordings will appear here once they become available." tone="purple" />
            </LingoCard>
          ) : (
            recordings.map((item) => (
              <LingoCard key={item.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.cardIcon, { backgroundColor: item.can_access ? '#EFF6FF' : '#FEE2E2' }]}>
                    <Ionicons
                      name={item.can_access ? 'play' : 'lock-closed'}
                      size={20}
                      color={item.can_access ? '#2563EB' : '#DC2626'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.cardTitle} numberOfLines={1}>{item.title || 'Recorded Class'}</ThemedText>
                    <ThemedText style={styles.cardTeacher}>
                      {item.teacher?.full_name || 'Teacher'}
                    </ThemedText>
                  </View>
                  <View style={styles.badgeGroup}>
                    <View style={[styles.badge, item.visibility === 'free' ? styles.badgeFree : styles.badgePaid]}>
                      <ThemedText style={[styles.badgeText, { color: item.visibility === 'free' ? '#059669' : '#D97706' }]}>
                        {item.visibility === 'free' ? 'Free' : 'Paid'}
                      </ThemedText>
                    </View>
                  </View>
                </View>

                {item.description ? (
                  <ThemedText style={styles.cardDesc} numberOfLines={2}>{item.description}</ThemedText>
                ) : null}

                <View style={styles.cardFooter}>
                  <View style={styles.metaItem}>
                    <Ionicons name="musical-notes-outline" size={14} color="#6B7280" />
                    <ThemedText style={styles.metaText}>{item.course?.title || 'Course'}</ThemedText>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={14} color="#6B7280" />
                    <ThemedText style={styles.metaText}>{formatDuration(item.duration_seconds)}</ThemedText>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.watchBtn, !item.can_access && styles.watchBtnLocked]}
                  onPress={() => openRecording(item.id, item.can_access)}
                  disabled={openingId === item.id}
                  activeOpacity={0.8}
                >
                  {openingId === item.id ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons
                        name={item.can_access ? 'play' : 'lock-closed'}
                        size={16}
                        color="#FFF"
                      />
                      <ThemedText style={styles.watchBtnText}>
                        {item.can_access ? 'Watch Now' : 'Unlock Required'}
                      </ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </LingoCard>
            ))
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LingoTheme.colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  contentPad: {
    paddingHorizontal: 16,
  },
  headerStatsWrap: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },

  /* Card */
  card: {
    marginBottom: 14,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  cardTeacher: {
    fontSize: 13,
    color: '#6B7280',
  },
  badgeGroup: {
    gap: 4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeFree: {
    backgroundColor: '#ECFDF5',
  },
  badgePaid: {
    backgroundColor: '#FEF3C7',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  watchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LingoTheme.colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.15)',
    gap: 8,
  },
  watchBtnLocked: {
    backgroundColor: '#9CA3AF',
  },
  watchBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },

});
