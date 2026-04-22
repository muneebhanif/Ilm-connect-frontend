import { StyleSheet, View, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LingoCard, LingoScreenHeader } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafePadding } from '@/hooks/use-safe-padding';

export default function TabTwoScreen() {
  const { topPadding, bottomPadding } = useSafePadding();

  const features = [
    {
      icon: 'book',
      title: 'Quran & Tajweed',
      description: 'Connect with certified Quran teachers for guided, one-to-one lessons.',
    },
    {
      icon: 'school',
      title: 'Islamic Studies',
      description: 'Learn Hadith, Fiqh, and foundational knowledge in a clear path.',
    },
    {
      icon: 'language',
      title: 'Arabic Language',
      description: 'Build Arabic skills to understand the Quran with more confidence.',
    },
    {
      icon: 'people',
      title: 'Community Learning',
      description: 'Study with supportive teachers and stay connected to your learning goals.',
    },
  ] as const;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: topPadding, paddingBottom: bottomPadding + 24 }}>
      <ThemedView style={styles.content}>
        <LingoScreenHeader
          badge="Explore"
          icon="compass"
          title="Discover faith-filled learning"
          subtitle="Browse the kinds of learning experiences IlmConnect is built to support for families and students."
        />

        <View style={styles.featuresSection}>
          {features.map((feature) => (
            <LingoCard key={feature.title} style={styles.featureCard}>
              <View style={styles.featureIconContainer}>
                <Ionicons name={feature.icon} size={24} color={LingoTheme.colors.teal} />
              </View>
              <View style={styles.featureContent}>
                <ThemedText style={styles.featureTitle}>{feature.title}</ThemedText>
                <ThemedText style={styles.featureDescription}>{feature.description}</ThemedText>
              </View>
            </LingoCard>
          ))}
        </View>

        <LingoCard style={styles.footerCard}>
          <ThemedText style={styles.footerTitle}>Simple, playful, and clear</ThemedText>
          <ThemedText style={styles.footerText}>
            Every screen should help learners move forward with bright guidance, clear actions, and friendly structure.
          </ThemedText>
        </LingoCard>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LingoTheme.colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  featuresSection: {
    gap: 14,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  featureIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: LingoTheme.colors.softTeal,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#90E2D8',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    marginBottom: 6,
  },
  featureDescription: {
    fontSize: 14,
    color: LingoTheme.colors.muted,
    lineHeight: 20,
  },
  footerCard: {
    marginTop: 14,
    marginBottom: 4,
  },
  footerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    marginBottom: 8,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 14,
    lineHeight: 21,
    color: LingoTheme.colors.muted,
    textAlign: 'center',
  },
});
