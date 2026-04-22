import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LingoBadge, LingoButton, LingoCard } from '@/components/ui/lingo-mobile';
import { Fonts, LingoTheme } from '@/constants/theme';
import { api } from '@/lib/config';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    setError(null);
    setSuccess(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(api.forgotPassword(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          redirectTo: 'ilmconnect://login',
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send password reset email');
      }

      setSuccess('Reset email sent. Please check your inbox and spam folder.');
    } catch (e: any) {
      setError(e?.message || 'Failed to send password reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <View style={styles.content}>
          <View style={styles.hero}>
            <LingoBadge label="Secure account recovery" icon="mail-open-outline" />
            <View style={styles.iconBadge}>
              <Ionicons name="mail-open-outline" size={30} color={LingoTheme.colors.primaryDark} />
            </View>
            <ThemedText style={styles.title}>Forgot password?</ThemedText>
            <ThemedText style={styles.subtitle}>
              Enter your email and a reset link will be sent to you.
            </ThemedText>
          </View>

          <LingoCard style={styles.formCard}>
            <ThemedText style={styles.inputLabel}>Email</ThemedText>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="alina@example.com"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </View>
            ) : null}

            {success ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={18} color="#059669" />
                <ThemedText style={styles.successText}>{success}</ThemedText>
              </View>
            ) : null}

            <View style={styles.primaryWrap}>
              {loading ? (
                <View style={[styles.loadingButton, styles.primaryButtonDisabled]}>
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              ) : (
                <LingoButton label="Send Reset Link" icon="paper-plane" onPress={handleReset} />
              )}
            </View>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace('/login')}>
              <ThemedText style={styles.secondaryButtonText}>Back to login</ThemedText>
            </TouchableOpacity>
          </LingoCard>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LingoTheme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
    gap: 10,
  },
  iconBadge: {
    width: 78,
    height: 78,
    borderRadius: 28,
    backgroundColor: LingoTheme.colors.softPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.12)',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: Fonts.rounded,
    color: LingoTheme.colors.ink,
  },
  subtitle: {
    fontSize: 15,
    color: LingoTheme.colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  formCard: {
    gap: 2,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: LingoTheme.colors.ink,
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: LingoTheme.colors.ink,
    backgroundColor: '#FFFFFF',
  },
  errorBox: {
    marginTop: 14,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  errorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 14,
  },
  successBox: {
    marginTop: 14,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  successText: {
    flex: 1,
    color: '#047857',
    fontSize: 14,
  },
  primaryWrap: {
    marginTop: 18,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  loadingButton: {
    backgroundColor: LingoTheme.colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.12)',
  },
  secondaryButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: LingoTheme.colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
});