import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { SimpleProfileSkeleton } from '@/components/ui/dashboard-skeletons';
import { LingoButton, LingoCard, LingoEmptyState, LingoScreenHeader } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';
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
  const { topPadding, bottomPadding } = useSafePadding();
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
    return <SimpleProfileSkeleton />;
  }

  if (error || !profile) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={[styles.errorContent, { paddingTop: topPadding, paddingBottom: bottomPadding + 24 }]}> 
          <LingoScreenHeader
            badge="Profile"
            icon="people"
            title="Parent profile"
            subtitle="See a simple view of the parent account and jump into a message when needed."
            onBack={() => router.back()}
          />
          <LingoCard>
            <LingoEmptyState
              icon="alert-circle-outline"
              title="Profile unavailable"
              subtitle={error || 'This parent profile could not be loaded right now.'}
              tone="gold"
            />
            <View style={styles.retryWrap}>
              <LingoButton label="Try again" onPress={fetchProfile} icon="refresh" />
            </View>
          </LingoCard>
        </ScrollView>
      </View>
    );
  }

  const displayName = cleanText(profile.full_name, 'Parent');
  const displayEmail = cleanText(profile.email, 'Email unavailable');

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: topPadding, paddingBottom: bottomPadding + 24 }]}> 
        <LingoScreenHeader
          badge="Profile"
          icon="people"
          title="Parent profile"
          subtitle="Review the account details and open a direct conversation with the parent."
          onBack={() => router.back()}
        />

        <LingoCard style={styles.profileCard}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <ThemedText style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</ThemedText>
            </View>
          )}

          <ThemedText style={styles.name}>{displayName}</ThemedText>
          <ThemedText style={styles.email}>{displayEmail}</ThemedText>

          <View style={styles.detailPill}>
            <Ionicons name="mail-outline" size={16} color={LingoTheme.colors.teal} />
            <ThemedText style={styles.detailPillText}>{displayEmail}</ThemedText>
          </View>

          <View style={styles.buttonWrap}>
            <LingoButton
              label="Message parent"
              icon="chatbubble-ellipses"
              onPress={() =>
                router.push({
                  pathname: '/chat/[id]' as any,
                  params: { id: profile.id, name: displayName, avatar: profile.avatar_url || '' }
                })
              }
            />
          </View>
        </LingoCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LingoTheme.colors.background,
  },
  errorContent: {
    paddingHorizontal: 16,
  },
  content: {
    paddingHorizontal: 16,
  },
  profileCard: {
    alignItems: 'center',
    paddingTop: 24,
  },
  avatarImage: {
    width: 104,
    height: 104,
    borderRadius: 52,
    marginBottom: 14,
  },
  avatarFallback: {
    width: 104,
    height: 104,
    borderRadius: 52,
    marginBottom: 14,
    backgroundColor: LingoTheme.colors.softTeal,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#90E2D8',
  },
  avatarText: {
    color: LingoTheme.colors.teal,
    fontSize: 38,
    fontWeight: '800',
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    marginBottom: 6,
  },
  email: {
    fontSize: 14,
    color: LingoTheme.colors.muted,
    marginBottom: 18,
  },
  detailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
  },
  detailPillText: {
    color: LingoTheme.colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  buttonWrap: {
    marginTop: 18,
    width: '100%',
  },
  retryWrap: {
    marginTop: 18,
  },
});
