import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/config';
import { authFetch } from '@/lib/auth-fetch';

export default function StudentProfileScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, [user?.id]);

  const loadProfile = async () => {
    if (!user?.id) return;
    try {
      const response = await authFetch(api.studentProfile(user.id));
      const data = await response.json();
      if (response.ok) setProfile(data.student || null);
    } catch (error) {
      console.error('Failed to load student profile', error);
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

  return (
    <View style={styles.container}>
      <ThemedText style={styles.title}>My Profile</ThemedText>
      <ThemedText style={styles.item}>Name: {profile?.name || user?.full_name || 'Student'}</ThemedText>
      <ThemedText style={styles.item}>Email: {profile?.email || user?.email || '—'}</ThemedText>
      <ThemedText style={styles.item}>Age: {profile?.age ?? '—'}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 80,
    paddingHorizontal: 20,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },
  item: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 8,
  },
});
