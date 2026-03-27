import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth-context';

export default function StudentDashboardScreen() {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <ThemedText style={styles.title}>Student Portal</ThemedText>
      <ThemedText style={styles.subtitle}>Welcome, {user?.full_name || 'Student'}</ThemedText>
      <ThemedText style={styles.description}>
        Use Classes tab to join sessions and submit teacher reviews.
      </ThemedText>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
});
