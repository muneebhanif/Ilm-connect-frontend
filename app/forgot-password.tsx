import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
// Back button removed
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
            <View style={styles.iconBadge}>
              <Ionicons name="mail-open-outline" size={26} color="#14B8A6" />
            </View>
            <ThemedText style={styles.title}>Forgot password?</ThemedText>
            <ThemedText style={styles.subtitle}>
              Enter your email and a reset link will be sent to you.
            </ThemedText>
          </View>

          <View style={styles.formCard}>
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

            <TouchableOpacity style={[styles.primaryButton, loading && styles.primaryButtonDisabled]} onPress={handleReset} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.primaryButtonText}>Send Reset Link</ThemedText>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace('/login')}>
              <ThemedText style={styles.secondaryButtonText}>Back to login</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  topNav: {
    alignItems: 'flex-start',
    marginTop: 10,
    marginBottom: 20,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  formCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#FFFFFF',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
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
  primaryButton: {
    marginTop: 18,
    backgroundColor: '#14B8A6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
});