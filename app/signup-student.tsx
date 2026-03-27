import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { BackButton } from '@/components/back-button';
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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton />
        <ThemedText style={styles.title}>Student Sign Up</ThemedText>
        <ThemedText style={styles.subtitle}>Create your learning portal account</ThemedText>

        <TextInput
          style={styles.input}
          placeholder="Student ID"
          value={studentId}
          onChangeText={setStudentId}
          editable={!params?.studentId}
        />
        <TextInput style={styles.input} placeholder="Full Name" value={fullName} onChangeText={setFullName} />
        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={onSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <ThemedText style={styles.buttonText}>Create Student Account</ThemedText>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingTop: 50,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 18,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    color: '#111827',
  },
  button: {
    marginTop: 10,
    backgroundColor: '#4ECDC4',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
