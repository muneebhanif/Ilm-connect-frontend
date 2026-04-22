import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LingoBadge, LingoButton, LingoCard, LingoHero } from '@/components/ui/lingo-mobile';
import { Fonts, LingoTheme } from '@/constants/theme';
import { api } from '@/lib/config';

export default function SignUpStudentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ studentId?: string; fullName?: string }>();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [studentId, setStudentId] = useState('');

  useEffect(() => {
    if (typeof params?.studentId === 'string' && params.studentId.trim()) {
      setStudentId(params.studentId.trim());
    }
    if (typeof params?.fullName === 'string' && params.fullName.trim()) {
      setFullName(params.fullName.trim());
    }
  }, [params?.studentId, params?.fullName]);

  const onSubmit = async () => {
    if (!fullName.trim() || !email.trim() || !password || !studentId.trim()) {
      Alert.alert('Missing fields', 'Please fill all required fields.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Invalid password', 'Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(api.signupStudent(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          studentId: studentId.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const errorText = String(data?.error || '').toLowerCase();
        if (
          response.status === 409 ||
          errorText.includes('already linked') ||
          errorText.includes('already registered') ||
          errorText.includes('already exists')
        ) {
          Alert.alert(
            'Student account already exists',
            'This student is already linked to an account. Please log in with that account.',
            [{ text: 'Go to Login', onPress: () => router.replace('/login') }]
          );
          return;
        }
        throw new Error(data.error || 'Failed to create student account');
      }

      Alert.alert(
        'Account Created',
        'Your student account has been created. Please login to continue.',
        [{ text: 'Go to Login', onPress: () => router.replace('/login') }]
      );
    } catch (error: any) {
      Alert.alert('Signup Failed', String(error?.message || 'Unable to create account'));
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { label: 'Student ID', value: studentId, setValue: setStudentId, editable: !params?.studentId, placeholder: 'Enter your student ID' },
    { label: 'Full Name', value: fullName, setValue: setFullName, placeholder: 'Your full name' },
    { label: 'Email', value: email, setValue: setEmail, placeholder: 'student@example.com', keyboardType: 'email-address' as const },
    { label: 'Password', value: password, setValue: setPassword, placeholder: 'Create a password', secureTextEntry: true },
    { label: 'Confirm Password', value: confirmPassword, setValue: setConfirmPassword, placeholder: 'Repeat your password', secureTextEntry: true },
  ];

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        enabled={Platform.OS === 'ios'}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        style={styles.keyboardWrap}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <LingoHero
            icon="school"
            badge="Student portal"
            title="Create your learning account"
            subtitle="Join classes, review progress, and keep your recordings all in one bright place."
          />

          <LingoCard>
            <View style={styles.headerRow}>
              <ThemedText style={styles.cardTitle}>Student sign up</ThemedText>
              <LingoBadge label="Quick setup" tone="purple" icon="flash" />
            </View>

            {fields.map((field) => (
              <View key={field.label} style={styles.fieldWrap}>
                <ThemedText style={styles.fieldLabel}>{field.label}</ThemedText>
                <TextInput
                  style={[styles.input, field.editable === false && styles.readOnlyInput]}
                  placeholder={field.placeholder}
                  placeholderTextColor="#9CA3AF"
                  value={field.value}
                  onChangeText={field.setValue}
                  editable={field.editable}
                  keyboardType={field.keyboardType}
                  autoCapitalize="none"
                  secureTextEntry={field.secureTextEntry}
                />
              </View>
            ))}

            <View style={styles.buttonWrap}>
              <LingoButton label="Create Student Account" icon="arrow-forward" onPress={onSubmit} loading={loading} />
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
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 24,
    fontFamily: Fonts.rounded,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
  },
  fieldWrap: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: LingoTheme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: LingoTheme.colors.border,
    borderWidth: 2,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: LingoTheme.colors.ink,
    fontSize: 15,
  },
  readOnlyInput: {
    backgroundColor: '#F8FAFC',
  },
  buttonWrap: {
    marginTop: 8,
  },
});
