import { useEffect, useState, useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View, RefreshControl, ActivityIndicator } from 'react-native';
import { StudentRecordingsSkeleton } from '@/components/ui/dashboard-skeletons';
import * as WebBrowser from 'expo-web-browser';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/config';
import { authFetch } from '@/lib/auth-fetch';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadRecordings('refresh')} tintColor="#14B8A6" />
        }
      >
        {/* Header */}
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerIconWrap}>
            <Ionicons name="play-circle" size={32} color="#FFF" />
          </View>
          <ThemedText style={styles.headerTitle}>Recordings</ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            {recordings.length} recording{recordings.length !== 1 ? 's' : ''} available
          </ThemedText>
        </LinearGradient>

        <View style={styles.contentPad}>
          {recordings.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="videocam-off-outline" size={40} color="#D1D5DB" />
              </View>
              <ThemedText style={styles.emptyTitle}>No recordings yet</ThemedText>
              <ThemedText style={styles.emptyDesc}>
                Class recordings will appear here once available
              </ThemedText>
            </View>
          ) : (
            recordings.map((item) => (
              <View key={item.id} style={styles.card}>
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
              </View>
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
    backgroundColor: '#F9FAFB',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  /* Header */
  header: {
    paddingTop: 60,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },

  /* Content */
  contentPad: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  /* Card */
  card: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
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
    borderRadius: 14,
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
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 12,
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

  /* Empty */
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFF',
    borderRadius: 20,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
