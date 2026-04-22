import { StyleSheet, View, ScrollView, Image } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { SkeletonScreen } from '@/components/ui/skeleton';
import { LingoBadge, LingoButton, LingoCard, LingoStatPill } from '@/components/ui/lingo-mobile';
import { Fonts, LingoTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';

const logo = require('@/assets/images/logo.png');

export default function HomeScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;

    const target = user.role === 'teacher'
      ? '/(teacher)/teacher-dashboard'
      : user.role === 'student'
        ? '/(student)/dashboard'
        : '/(parent)/dashboard';

    router.replace(target);
  }, [user, loading, router]);

  if (loading) {
    return <SkeletonScreen />;
  }

  if (user) {
    return null;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={['#ECFCD8', '#FFFFFF', '#F2E8FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <LingoBadge label="Trusted Islamic learning" icon="sparkles" />

        <View style={styles.logoBubbleWrap}>
          <View style={styles.logoBubbleOuter}>
            <View style={styles.logoBubbleInner}>
              <Image source={logo} style={styles.heroLogo} resizeMode="contain" />
            </View>
          </View>
        </View>

        <ThemedText style={styles.mainTitle}>
          Grow with Quran, Arabic, and faith-filled learning
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          A bright, simple place for parents, students, and teachers to learn together.
        </ThemedText>

        <View style={styles.statRow}>
          <LingoStatPill icon="👨‍🏫" value="100+" label="Teachers" tone="teal" />
          <LingoStatPill icon="📚" value="1,000+" label="Students" tone="gold" />
        </View>
      </LinearGradient>

      <LingoCard>
        <ThemedText style={styles.sectionTitle}>Why families choose IlmConnect</ThemedText>
        <View style={styles.featureList}>
          {[
            ['checkmark-circle', 'Verified teachers and trusted profiles'],
            ['videocam', 'Live classes from anywhere'],
            ['chatbubble-ellipses', 'Easy chat and scheduling'],
          ].map(([icon, text]) => (
            <View key={text} style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={LingoTheme.colors.primaryDark} />
              </View>
              <ThemedText style={styles.featureText}>{text}</ThemedText>
            </View>
          ))}
        </View>
      </LingoCard>

      <View style={styles.actions}>
        <LingoButton label="Get Started" icon="arrow-forward" onPress={() => router.push('/role-selection')} />
        <View style={styles.spacer} />
        <LingoButton label="Log In" variant="secondary" onPress={() => router.push('/login')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LingoTheme.colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 40,
    gap: 18,
  },
  heroCard: {
    borderRadius: 30,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    paddingHorizontal: 20,
    paddingVertical: 26,
    alignItems: 'center',
    ...LingoTheme.shadow.card,
  },
  logoBubbleWrap: {
    marginVertical: 12,
  },
  logoBubbleOuter: {
    width: 120,
    height: 120,
    borderRadius: 40,
    backgroundColor: 'rgba(88,204,2,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBubbleInner: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.12)',
  },
  heroLogo: {
    width: 62,
    height: 62,
  },
  mainTitle: {
    fontSize: 30,
    fontFamily: Fonts.rounded,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: LingoTheme.colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 6,
  },
  statRow: {
    marginTop: 18,
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Fonts.rounded,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    marginBottom: 14,
  },
  featureList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LingoTheme.colors.softPrimary,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: LingoTheme.colors.ink,
    fontWeight: '600',
  },
  actions: {
    marginTop: 4,
  },
  spacer: {
    height: 12,
  },
});