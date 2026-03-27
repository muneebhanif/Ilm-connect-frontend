import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/config';
import { authFetch } from '@/lib/auth-fetch';
import { useRouter } from 'expo-router';
import { RateTeacherModal } from '@/components/rate-teacher-modal';

interface ClassSession {
  id: string;
  scheduled_date: string;
  duration_minutes: number;
  status: string;
  live_status?: string;
  courses: {
    title: string;
    teacher_id: string;
    teachers: { profiles: { full_name: string } };
  };
}

export default function StudentClassesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassSession | null>(null);

  useEffect(() => {
    loadClasses();
  }, [user?.id]);

  const loadClasses = async () => {
    if (!user?.id) return;
    try {
      const response = await authFetch(api.studentClasses(user.id));
      const data = await response.json();
      if (response.ok) setClasses(data.classes || []);
    } catch (error) {
      console.error('Failed to load student classes', error);
    } finally {
      setLoading(false);
    }
  };

  const { upcoming, completed } = useMemo(() => {
    const now = Date.now();
    const upcomingClasses = classes.filter((c) => {
      const ms = new Date(c.scheduled_date).getTime();
      return Number.isFinite(ms) && ms >= now && String(c.status || '').toLowerCase() !== 'completed';
    });

    const doneClasses = classes.filter((c) => {
      const raw = String(c.status || '').toLowerCase();
      if (raw === 'completed') return true;
      const ms = new Date(c.scheduled_date).getTime();
      return Number.isFinite(ms) && ms < now;
    });

    return { upcoming: upcomingClasses, completed: doneClasses };
  }, [classes]);

  const renderRow = (item: ClassSession, allowReview: boolean) => (
    <View key={item.id} style={styles.card}>
      <ThemedText style={styles.title}>{item.courses?.title || 'Class'}</ThemedText>
      <ThemedText style={styles.meta}>Teacher: {item.courses?.teachers?.profiles?.full_name || 'Teacher'}</ThemedText>
      <ThemedText style={styles.meta}>{new Date(item.scheduled_date).toLocaleString()}</ThemedText>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push({ pathname: '/class-room/[id]' as any, params: { id: item.id } })}
        >
          <ThemedText style={styles.primaryBtnText}>Join Class</ThemedText>
        </TouchableOpacity>
        {allowReview && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              setSelectedClass(item);
              setRatingOpen(true);
            }}
          >
            <ThemedText style={styles.secondaryBtnText}>Review Teacher</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <ThemedText style={styles.sectionTitle}>Upcoming</ThemedText>
        {upcoming.length === 0 ? <ThemedText style={styles.empty}>No upcoming classes</ThemedText> : upcoming.map((c) => renderRow(c, false))}

        <ThemedText style={[styles.sectionTitle, { marginTop: 18 }]}>Completed</ThemedText>
        {completed.length === 0 ? <ThemedText style={styles.empty}>No completed classes</ThemedText> : completed.map((c) => renderRow(c, true))}
      </ScrollView>

      <RateTeacherModal
        visible={ratingOpen}
        onClose={() => {
          setRatingOpen(false);
          setSelectedClass(null);
        }}
        onSuccess={() => {
          setRatingOpen(false);
          setSelectedClass(null);
        }}
        teacherId={selectedClass?.courses?.teacher_id || ''}
        teacherName={selectedClass?.courses?.teachers?.profiles?.full_name || 'Teacher'}
        sessionId={selectedClass?.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 70,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  empty: {
    color: '#6B7280',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  actions: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  primaryBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryBtn: {
    backgroundColor: '#E6FFFB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  secondaryBtnText: {
    color: '#0F766E',
    fontWeight: '700',
    fontSize: 13,
  },
});
