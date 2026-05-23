import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LingoButton, LingoCard } from '@/components/ui/lingo-mobile';
import { Fonts, LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';

export default function SignUpStudentScreen() {
  const router = useRouter();
  const { topPadding, bottomPadding } = useSafePadding();

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        enabled={Platform.OS === 'ios'}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        style={styles.keyboardWrap}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: topPadding + 12, paddingBottom: bottomPadding + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.signupHeader}>
            <ThemedText style={styles.signupTitle}>Student sign-up</ThemedText>
            <ThemedText style={styles.signupSubtitle}>
              Parents create student credentials from the parent dashboard. Sign in with those details here.
            </ThemedText>
          </View>

          <LingoCard>
            <ThemedText style={styles.cardTitle}>What changed?</ThemedText>
            <ThemedText style={styles.bodyText}>
              Student self-registration has been removed. A parent must first add the child and create login credentials from the parent dashboard.
            </ThemedText>

            <View style={styles.stepList}>
              <View style={styles.stepRow}>
                <View style={styles.stepBadge}><ThemedText style={styles.stepBadgeText}>1</ThemedText></View>
                <ThemedText style={styles.stepText}>Parent creates the child profile.</ThemedText>
              </View>
              <View style={styles.stepRow}>
                <View style={styles.stepBadge}><ThemedText style={styles.stepBadgeText}>2</ThemedText></View>
                <ThemedText style={styles.stepText}>Parent generates the student email and password.</ThemedText>
              </View>
              <View style={styles.stepRow}>
                <View style={styles.stepBadge}><ThemedText style={styles.stepBadgeText}>3</ThemedText></View>
                <ThemedText style={styles.stepText}>Student signs in using those credentials.</ThemedText>
              </View>
            </View>

            <View style={styles.actions}>
              <LingoButton label="Go to Login" icon="log-in" onPress={() => router.replace('/login')} />
              <LingoButton label="Back to Sign Up" icon="arrow-back" variant="secondary" onPress={() => router.replace('/role-selection')} />
            </View>
          </LingoCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LingoTheme.colors.background,
  },
  keyboardWrap: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 18,
  },
  headerRow: {
    display: 'none',
  },
  signupHeader: {
    gap: 6,
  },
  signupTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontFamily: Fonts.rounded,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    letterSpacing: -0.5,
  },
  signupSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: LingoTheme.colors.muted,
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: 24,
    fontFamily: Fonts.rounded,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    marginBottom: 10,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 23,
    color: LingoTheme.colors.muted,
  },
  stepList: {
    marginTop: 18,
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: '#4F46E5',
    fontWeight: '800',
    fontSize: 13,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: LingoTheme.colors.ink,
  },
  actions: {
    marginTop: 18,
    gap: 12,
  },
});
