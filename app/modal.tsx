import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LingoButton, LingoCard, LingoScreenHeader } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';

export default function ModalScreen() {
  return (
    <ThemedView style={styles.container}>
      <LingoScreenHeader
        badge="Quick note"
        icon="sparkles"
        title="A bright little modal"
        subtitle="Use this space for short actions, confirmations, or small pieces of helpful context."
      />

      <LingoCard style={styles.card}>
        <ThemedText style={styles.title}>You’re in a focused modal view</ThemedText>
        <ThemedText style={styles.subtitle}>
          Keep modal content short, actionable, and easy to dismiss so the main flow stays clear.
        </ThemedText>

        <View style={styles.actions}>
          <Link href="/" dismissTo asChild>
            <View>
              <LingoButton label="Back home" icon="arrow-forward" />
            </View>
          </Link>
        </View>
      </LingoCard>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: LingoTheme.colors.background,
  },
  card: {
    padding: 20,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: LingoTheme.colors.muted,
    textAlign: 'center',
  },
  actions: {
    marginTop: 18,
  },
});
