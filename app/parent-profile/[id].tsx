import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { BackButton } from '@/components/back-button';
import { api } from '@/lib/config';

interface ParentProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  role?: string;
}

const cleanText = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const v = value.trim();
  if (!v || v.toLowerCase() === 'null' || v.toLowerCase() === 'undefined') return fallback;
  return v;
};

export default function ParentProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ParentProfile | null>(null);

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const fetchProfile = async () => {
    if (!id || typeof id !== 'string') {
      setError('Parent not found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(api.profile(id));
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load parent profile');
      }

      setProfile(data.profile || null);
    } catch (err: any) {
      setError(String(err?.message || 'Failed to load parent profile'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle-outline" size={44} color="#9CA3AF" />
        <ThemedText style={styles.errorText}>{error || 'Parent profile unavailable'}</ThemedText>
        <TouchableOpacity style={styles.retryButton} onPress={fetchProfile}>
          <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  const displayName = cleanText(profile.full_name, 'Parent');
  const displayEmail = cleanText(profile.email, 'Email unavailable');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <ThemedText style={styles.headerTitle}>Parent Profile</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarFallback}>
            <ThemedText style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</ThemedText>
          </View>
        )}

        <ThemedText style={styles.name}>{displayName}</ThemedText>
        <ThemedText style={styles.email}>{displayEmail}</ThemedText>

        <TouchableOpacity
          style={styles.messageButton}
          onPress={() =>
            router.push({
              pathname: '/chat/[id]' as any,
              params: { id: profile.id, name: displayName, avatar: profile.avatar_url || '' }
            })
          }
        >
          <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFF" />
          <ThemedText style={styles.messageText}>Message Parent</ThemedText>
        </TouchableOpacity>
      </View>
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
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  content: {
    alignItems: 'center',
    marginTop: 32,
    paddingHorizontal: 20,
  },
  avatarImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
    marginBottom: 12,
  },
  avatarFallback: {
    width: 92,
    height: 92,
    borderRadius: 46,
    marginBottom: 12,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '700',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  email: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  messageButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 14,
    backgroundColor: '#4ECDC4',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '700',
  },
});
