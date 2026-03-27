import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/config';
import { authFetch } from '@/lib/auth-fetch';

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
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);

  useEffect(() => {
    loadRecordings();
  }, [user?.id]);

  const loadRecordings = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const response = await authFetch(api.studentRecordings(user.id));
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load recordings');
      }
      setRecordings(data.recordings || []);
    } catch (error: any) {
      Alert.alert('Error', String(error?.message || 'Failed to load recordings'));
    } finally {
      setLoading(false);
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

      if (!response.ok || !data?.signedUrl) {
        throw new Error(data?.error || 'Unable to open recording');
      }

      await WebBrowser.openBrowserAsync(data.signedUrl);
    } catch (error: any) {
      Alert.alert('Error', String(error?.message || 'Unable to open recording'));
    } finally {
      setOpeningId(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <ThemedText style={styles.title}>Recorded Courses</ThemedText>
        <ThemedText style={styles.subtitle}>Browse and watch available recorded classes</ThemedText>

        {recordings.length === 0 ? (
          <View style={styles.emptyCard}>
            <ThemedText style={styles.emptyText}>No recordings available yet.</ThemedText>
          </View>
        ) : (
          recordings.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, item.visibility === 'free' ? styles.badgeFree : styles.badgePaid]}>
                  <ThemedText style={styles.badgeText}>{item.visibility === 'free' ? 'FREE' : 'PAID'}</ThemedText>
                </View>
                <View style={[styles.badge, item.can_access ? styles.badgeOpen : styles.badgeLocked]}>
                  <ThemedText style={styles.badgeText}>{item.can_access ? 'UNLOCKED' : 'LOCKED'}</ThemedText>
                </View>
              </View>

              <ThemedText style={styles.cardTitle}>{item.title || 'Recorded Class'}</ThemedText>
              {item.description ? <ThemedText style={styles.cardDesc}>{item.description}</ThemedText> : null}
              <ThemedText style={styles.meta}>Teacher: {item.teacher?.full_name || 'Teacher'}</ThemedText>
              <ThemedText style={styles.meta}>Course: {item.course?.title || 'Recorded Course'}</ThemedText>
              <ThemedText style={styles.meta}>Duration: {formatDuration(item.duration_seconds)}</ThemedText>

              <TouchableOpacity
                style={[styles.openBtn, !item.can_access && styles.openBtnLocked]}
                onPress={() => openRecording(item.id, item.can_access)}
                disabled={openingId === item.id}
              >
                <ThemedText style={styles.openBtnText}>
                  {openingId === item.id ? 'Opening...' : item.can_access ? 'Watch Now' : 'Unlock Required'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          ))
        )}
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 70,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 14,
  },
  emptyCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyText: {
    color: '#6B7280',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeFree: {
    backgroundColor: '#D1FAE5',
  },
  badgePaid: {
    backgroundColor: '#FEF3C7',
  },
  badgeOpen: {
    backgroundColor: '#DBEAFE',
  },
  badgeLocked: {
    backgroundColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 6,
  },
  meta: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  openBtn: {
    marginTop: 10,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  openBtnLocked: {
    backgroundColor: '#9CA3AF',
  },
  openBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
