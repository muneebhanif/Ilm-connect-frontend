import { StyleSheet, View, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { LinearGradient } from 'expo-linear-gradient';
import { LingoBadge, LingoButton, LingoCard, LingoEmptyState } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { BookTeacherSkeleton } from '@/components/ui/dashboard-skeletons';
import { DateTime } from 'luxon';
import { useStripe } from '@/lib/stripe';
import { useSafePadding } from '@/hooks/use-safe-padding';

interface Teacher {
  id: string;
  profiles: { full_name: string };
  hourly_rate: number;
  weekly_package_price?: number;
  monthly_package_price?: number;
  subjects: string[];
  availability: any;
  timezone?: string;
}

interface Child { 
  id: string; 
  name: string; 
}

interface Package {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
}

export default function BookTeacherScreen() {
  const { id, subject, courseTitle, courseId } = useLocalSearchParams<{
    id: string;
    subject?: string;
    courseTitle?: string;
    courseId?: string;
  }>();
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { topPadding, bottomPadding } = useSafePadding();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [teacherTz, setTeacherTz] = useState<string>('UTC');
  const [children, setChildren] = useState<Child[]>([]);
  
  // Selection State
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<DateTime>(() => DateTime.now().setZone('UTC').startOf('day'));
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string>('single');
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<null | { message: string; session: any }>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const courseSubject = typeof subject === 'string' ? subject.trim() : '';
  const selectedCourseTitle = typeof courseTitle === 'string' ? courseTitle.trim() : '';
  const selectedCourseId = typeof courseId === 'string' ? courseId.trim() : '';

  // Subject options based on teacher's subjects
  const SUBJECT_OPTIONS = [
    { label: 'Arabic', value: 'Arabic' },
    { label: 'Quran', value: 'Quran' },
  ];

  const derivedSubjectOptions = useMemo(() => {
    const teacherSubjects = Array.isArray(teacher?.subjects) ? teacher!.subjects : [];

    const matched = SUBJECT_OPTIONS.filter(opt =>
      teacherSubjects.includes(opt.value) ||
      teacherSubjects.includes('Both') ||
      teacherSubjects.some((s: string) => s.toLowerCase().includes(opt.value.toLowerCase()))
    );

    if (matched.length > 0) return matched;

    const clean = teacherSubjects
      .map((s: unknown) => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean);

    const unique = Array.from(new Set(clean));
    if (unique.length === 0) return SUBJECT_OPTIONS;

    return unique.map((value) => ({ label: value, value }));
  }, [teacher?.subjects]);

  // Constants
  const dates = useMemo(() => {
    const base = DateTime.now().setZone(teacherTz).startOf('day');
    return Array.from({ length: 14 }, (_, i) => base.plus({ days: i }));
  }, [teacherTz]);

  const packages: Package[] = [
    { id: 'single', name: 'Single Class', description: 'Pay per class', price: teacher?.hourly_rate || 0 },
    {
      id: 'weekly',
      name: 'Weekly Bundle',
      description: '4 classes',
      price: teacher?.weekly_package_price && teacher.weekly_package_price > 0
        ? teacher.weekly_package_price
        : (teacher?.hourly_rate || 0) * 4 * 0.9,
      originalPrice: (() => {
        const base = (teacher?.hourly_rate || 0) * 4;
        const final = teacher?.weekly_package_price && teacher.weekly_package_price > 0
          ? teacher.weekly_package_price
          : (teacher?.hourly_rate || 0) * 4 * 0.9;
        return base > final ? base : undefined;
      })(),
    },
    {
      id: 'monthly',
      name: 'Monthly Plan',
      description: '12 classes',
      price: teacher?.monthly_package_price && teacher.monthly_package_price > 0
        ? teacher.monthly_package_price
        : (teacher?.hourly_rate || 0) * 12 * 0.8,
      originalPrice: (() => {
        const base = (teacher?.hourly_rate || 0) * 12;
        const final = teacher?.monthly_package_price && teacher.monthly_package_price > 0
          ? teacher.monthly_package_price
          : (teacher?.hourly_rate || 0) * 12 * 0.8;
        return base > final ? base : undefined;
      })(),
    },
  ];

  useEffect(() => { fetchData(); }, [id]);

  // Keep selected date anchored to the teacher's calendar.
  useEffect(() => {
    setSelectedDate(DateTime.now().setZone(teacherTz).startOf('day'));
    setSelectedTime(null);
  }, [teacherTz]);
  
  useEffect(() => { 
    if (teacher?.availability) generateTimeSlots(); 
  }, [selectedDate, teacher]);

  const fetchData = async () => {
    try {
      const res = await fetch(api.teacherProfile(id as string));
      const data = await res.json();

      const t = data.teacher || data.profile || data.data || data;

      if (!t) throw new Error('No teacher data found');

      setTeacher({
        id: t.id || id,
        profiles: { full_name: t.profiles?.full_name || t.full_name || 'Unknown' },
        hourly_rate: Number(t.hourly_rate) || 0,
        weekly_package_price: Number(t.weekly_package_price) || 0,
        monthly_package_price: Number(t.monthly_package_price) || 0,
        subjects: Array.isArray(t.subjects) ? t.subjects : [],
        availability: t.availability || {},
        timezone: t.timezone,
      });

      // Auto-select the course subject first, then fall back to a single teacher subject.
      const teacherSubjects = Array.isArray(t.subjects) ? t.subjects : [];
      if (courseSubject) {
        setSelectedSubject(courseSubject);
      } else if (teacherSubjects.length === 1 && (teacherSubjects[0] === 'Arabic' || teacherSubjects[0] === 'Quran')) {
        setSelectedSubject(teacherSubjects[0]);
      }

      const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      setTeacherTz(typeof t.timezone === 'string' && t.timezone.length > 0 ? t.timezone : deviceTz);

      const parentId = await AsyncStorage.getItem('userId');
      if (parentId) {
        const token = await AsyncStorage.getItem('access_token');
        const ch = await fetch(api.parentChildren(parentId), {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const cd = await ch.json();
        setChildren(cd.children || []);
      }
    } catch (e) {
      console.error('Fetch error:', e);
      setError('Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const generateTimeSlots = () => {
    if (!teacher?.availability) return setAvailableTimeSlots([]);

    // Day name in teacher timezone (matches availability keys stored as weekday names)
    const dayName = selectedDate.setZone(teacherTz).toFormat('cccc').toLowerCase();
    // Handle case sensitivity in DB keys
    const availabilityKey = Object.keys(teacher.availability).find(k => k.toLowerCase() === dayName);
    const dayData = availabilityKey ? teacher.availability[availabilityKey] : null;

    if (!dayData) return setAvailableTimeSlots([]);

    // If API returns array of strings ["10:00", "11:00"]
    if (Array.isArray(dayData)) {
      setAvailableTimeSlots(dayData);
      return;
    } 
    
    // If API returns { start: "09:00", end: "17:00" }
    if (dayData.start && dayData.end) {
      const slots = [];
      const start = parseInt(dayData.start.split(':')[0]);
      const end = parseInt(dayData.end.split(':')[0]);
      for (let i = start; i < end; i++) {
        slots.push(`${i.toString().padStart(2, '0')}:00`);
      }
      setAvailableTimeSlots(slots);
    }
  };

  const handleBooking = async () => {
    setFeedbackMessage(null);

    if (selectedChildren.length === 0) {
      const msg = 'Please select at least one child.';
      setFeedbackMessage(msg);
      return Alert.alert('Missing Info', msg);
    }
    if (!selectedSubject) {
      const msg = 'Please select a subject.';
      setFeedbackMessage(msg);
      return Alert.alert('Missing Info', msg);
    }
    if (!selectedTime) {
      const msg = 'Please select a time slot.';
      setFeedbackMessage(msg);
      return Alert.alert('Missing Info', msg);
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const [hours, minutes] = selectedTime.split(':');
      const hour = parseInt(hours, 10);
      const minute = parseInt(minutes, 10);

      // IMPORTANT: Slot times are in the teacher's timezone.
      // Build the session timestamp in teacher TZ, then convert to UTC ISO for backend storage.
      const sessionDateISO = selectedDate
        .setZone(teacherTz)
        .set({ hour, minute, second: 0, millisecond: 0 })
        .toUTC()
        .toISO();

      if (!sessionDateISO) {
        throw new Error('Failed to build session timestamp');
      }

      const bookingPayload = {
        teacherId: teacher?.id,
        studentIds: selectedChildren,
        subject: selectedSubject,
        sessionDate: sessionDateISO,
        durationMinutes: 60,
        packageType: selectedPackage,
        teacherTimezone: teacherTz,
        courseId: selectedCourseId || undefined,
        courseTitle: selectedCourseTitle || undefined,
      };
      console.log('Booking request payload:', bookingPayload);

      if (!token) {
        const msg = 'Session expired. Please login again.';
        setFeedbackMessage(msg);
        Alert.alert('Login Required', msg);
        router.replace('/login');
        return;
      }

      // ── Payment gate ──────────────────────────────────────────────────────
      let paymentIntentId: string | null = null;

      if (totalAmount > 0) {
        // 1. Create PaymentIntent on backend
        setPaymentLoading(true);
        const intentRes = await fetch(api.payments.createIntent(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            amount: totalAmount,
            currency: 'usd',
            teacherId: teacher?.id,
            packageType: selectedPackage,
            subject: selectedSubject,
            numStudents: selectedChildren.length,
          }),
        });
        const intentData = await intentRes.json();
        setPaymentLoading(false);

        if (!intentRes.ok || !intentData.clientSecret) {
          const msg = intentData.error || 'Failed to start payment. Please try again.';
          setFeedbackMessage(msg);
          Alert.alert('Payment Error', msg);
          return;
        }

        // 2. Initialize Stripe Payment Sheet
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: intentData.clientSecret,
          merchantDisplayName: 'IlmConnect',
          defaultBillingDetails: { name: 'Parent' },
          style: 'automatic',
          returnURL: 'ilmconnect://payment-complete',
        });

        if (initError) {
          const msg = initError.message || 'Unable to load payment sheet.';
          setFeedbackMessage(msg);
          Alert.alert('Payment Error', msg);
          return;
        }

        // 3. Present the Stripe Payment Sheet
        const { error: payError } = await presentPaymentSheet();

        if (payError) {
          if (payError.code === 'Canceled') return; // user dismissed — no alert needed
          const msg = payError.message || 'Payment was not completed.';
          setFeedbackMessage(msg);
          Alert.alert('Payment Failed', msg);
          return;
        }

        // Payment succeeded — keep the paymentIntentId to attach to booking
        paymentIntentId = intentData.paymentIntentId;
      }
      // ─────────────────────────────────────────────────────────────────────

      // 4. Create the booking (now with verified paymentIntentId if paid)
      const response = await fetch(api.bookings(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...bookingPayload, paymentIntentId }),
      });

      const data = await response.json();
      console.log('Booking API response:', data);
      if (response.ok) {
        console.log('Booking confirmed!');
        setConfirmation({ message: data.message, session: data.session });
      } else {
        console.error('Booking failed:', data.error || data);
        const msg = data.error || 'Unable to book session.';
        setFeedbackMessage(msg);
        Alert.alert('Booking Failed', msg);
      }
    } catch (error) {
      console.error('Booking error:', error);
      const msg = 'Network error. Please try again.';
      setFeedbackMessage(msg);
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
      setPaymentLoading(false);
    }
  };

  if (confirmation) {
    // Show confirmation UI and redirect after a short delay
    setTimeout(() => {
      router.replace('/(parent)/classes');
    }, 2500);
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="checkmark-circle" size={64} color="#4ECDC4" style={{ marginBottom: 16 }} />
        <ThemedText style={{ fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 8 }}>
          Booking Confirmed!
        </ThemedText>
        <ThemedText style={{ color: '#4ECDC4', fontWeight: '600', fontSize: 16, marginBottom: 12 }}>
          {confirmation.message}
        </ThemedText>
        <ThemedText style={{ color: '#6B7280', fontSize: 15, textAlign: 'center', maxWidth: 320 }}>
          Your class is scheduled for:
        </ThemedText>
        <ThemedText style={{ color: '#111827', fontWeight: '600', fontSize: 16, marginTop: 8 }}>
          {new Date(confirmation.session.session_date).toLocaleString()}
        </ThemedText>
        <ThemedText style={{ color: '#6B7280', fontSize: 15, marginTop: 8 }}>
          You can view and join this class from your Schedule.
        </ThemedText>
      </View>
    );
  }

  if (loading) {
    return <BookTeacherSkeleton />;
  }

  if (error || !teacher) {
    return (
      <View style={[styles.container, styles.center]}>
        <LingoCard style={styles.errorCard}>
          <LingoEmptyState icon="alert-circle-outline" title="Teacher not found" subtitle={error || 'The teacher profile could not be loaded right now.'} tone="danger" />
          <LingoButton label="Go back" onPress={() => router.back()} variant="secondary" style={styles.retryButton} />
        </LingoCard>
      </View>
    );
  }

  const currentPackage = packages.find(p => p.id === selectedPackage);
  const totalAmount = (currentPackage?.price || 0) * (selectedChildren.length || 1);
  const footerBottomPadding = Platform.OS === 'android'
    ? Math.max(bottomPadding + 12, 56)
    : bottomPadding + 12;

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={[styles.header, { paddingTop: topPadding }]}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color="#3C3C3C" />
          </TouchableOpacity>
          <View style={styles.topBarCenter}>
            <ThemedText style={styles.topBarTitle}>Book a Class</ThemedText>
            <ThemedText style={styles.topBarSub}>{teacher?.profiles.full_name ?? 'Select options below'}</ThemedText>
          </View>
          <View style={styles.topBarSpacer} />
        </View>
        <View style={styles.statsRow}>
          <View style={styles.metricPill}>
            <View style={[styles.metricIconBox, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="people-outline" size={18} color="#4F46E5" />
            </View>
            <ThemedText style={styles.pillValue}>{selectedChildren.length}</ThemedText>
            <ThemedText style={styles.pillLabel}>Children</ThemedText>
          </View>
          <View style={styles.metricPill}>
            <View style={[styles.metricIconBox, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="card-outline" size={18} color="#059669" />
            </View>
            <ThemedText style={styles.pillValue}>${totalAmount.toFixed(0)}</ThemedText>
            <ThemedText style={styles.pillLabel}>Total</ThemedText>
          </View>
          <View style={styles.metricPill}>
            <View style={[styles.metricIconBox, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="book-outline" size={18} color="#EA580C" />
            </View>
            <ThemedText style={styles.pillValue} numberOfLines={1}>{selectedSubject || '-'}</ThemedText>
            <ThemedText style={styles.pillLabel}>Subject</ThemedText>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: footerBottomPadding + 132 }} showsVerticalScrollIndicator={false}>
        
        <LinearGradient
          colors={['#ECFCD8', '#FFFFFF', '#F2E8FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.teacherCard}
        >
          <View style={styles.avatar}>
            <ThemedText style={styles.avatarText}>
              {teacher.profiles.full_name.charAt(0)}
            </ThemedText>
          </View>
          <View style={styles.teacherInfo}>
            <ThemedText style={styles.teacherName}>{teacher.profiles.full_name}</ThemedText>
            <ThemedText style={styles.teacherSub}>{teacher.subjects.join(' • ') || 'Islamic Studies'}</ThemedText>
            <LingoBadge label={`$${teacher.hourly_rate}/hr`} icon="pricetag-outline" tone="teal" />
          </View>
        </LinearGradient>

        {selectedCourseTitle ? (
          <View style={styles.courseContext}>
            <View style={styles.courseContextIcon}>
              <Ionicons name="school-outline" size={18} color={LingoTheme.colors.primaryDark} />
            </View>
            <View style={styles.courseContextBody}>
              <ThemedText style={styles.courseContextLabel}>Enrolling in</ThemedText>
              <ThemedText style={styles.courseContextTitle} numberOfLines={2}>{selectedCourseTitle}</ThemedText>
            </View>
          </View>
        ) : null}

        <LingoCard style={styles.section}>
          <ThemedText style={styles.sectionTitle}>1. Select Child</ThemedText>
          {children.length === 0 ? (
            <LingoButton label="Add child profile" variant="secondary" icon="add-outline" onPress={() => router.push('/(parent)/dashboard')} style={styles.addBtn} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
              {children.map((child) => {
                const selected = selectedChildren.includes(child.id);
                return (
                  <TouchableOpacity
                    key={child.id}
                    style={[styles.childChip, selected && styles.childChipSelected]}
                    onPress={() => {
                      setSelectedChildren(prev => 
                        selected ? prev.filter(id => id !== child.id) : [...prev, child.id]
                      );
                    }}
                  >
                    <View style={[styles.childAvatar, selected && styles.childAvatarSelected]}>
                      <ThemedText style={[styles.childInit, selected && {color: '#FFF'}]}>
                        {child.name.charAt(0)}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.childName, selected && styles.childNameSelected]}>
                      {child.name}
                    </ThemedText>
                    {selected && (
                      <View style={styles.checkBadge}>
                        <Ionicons name="checkmark" size={10} color="#FFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </LingoCard>

        <LingoCard style={styles.section}>
          <ThemedText style={styles.sectionTitle}>2. Select Subject</ThemedText>
          <View style={styles.subjectRow}>
            {derivedSubjectOptions.map((opt) => {
              const isSelected = selectedSubject === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.subjectChip, isSelected && styles.subjectChipSelected]}
                  onPress={() => setSelectedSubject(opt.value)}
                >
                  <Ionicons 
                    name={opt.value === 'Quran' ? 'book' : 'language'} 
                    size={18} 
                    color={isSelected ? '#FFF' : '#4ECDC4'} 
                  />
                  <ThemedText style={[styles.subjectText, isSelected && styles.subjectTextSelected]}>
                    {opt.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </LingoCard>

        <LingoCard style={styles.section}>
          <ThemedText style={styles.sectionTitle}>3. Select Date</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
            {dates.map((date, i) => {
              const isSelected = selectedDate.hasSame(date, 'day');
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.dateCard, isSelected && styles.dateCardSelected]}
                  onPress={() => { setSelectedDate(date); setSelectedTime(null); }}
                >
                  <ThemedText style={[styles.dayText, isSelected && styles.textSelected]}>
                    {date.toFormat('ccc')}
                  </ThemedText>
                  <ThemedText style={[styles.dateText, isSelected && styles.textSelected]}>
                    {date.day}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </LingoCard>

        <LingoCard style={styles.section}>
          <ThemedText style={styles.sectionTitle}>4. Select Time</ThemedText>
          {availableTimeSlots.length > 0 ? (
            <View style={styles.timeGrid}>
              {availableTimeSlots.map((time, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.timeChip, selectedTime === time && styles.timeChipSelected]}
                  onPress={() => setSelectedTime(time)}
                >
                  <ThemedText style={[styles.timeText, selectedTime === time && styles.textSelected]}>
                    {time}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <LingoEmptyState icon="calendar-outline" title="No slots available" subtitle="Try another date to view available times for this teacher." tone="gold" />
          )}
        </LingoCard>

        <LingoCard style={styles.section}>
          <ThemedText style={styles.sectionTitle}>5. Select Package</ThemedText>
          {packages.map((pkg) => (
            <TouchableOpacity
              key={pkg.id}
              style={[styles.pkgCard, selectedPackage === pkg.id && styles.pkgCardSelected]}
              onPress={() => setSelectedPackage(pkg.id)}
            >
              <View style={styles.pkgInfo}>
                <ThemedText style={styles.pkgName}>{pkg.name}</ThemedText>
                <ThemedText style={styles.pkgDesc}>{pkg.description}</ThemedText>
              </View>
              <View style={styles.pkgRight}>
                {pkg.originalPrice && (
                  <ThemedText style={styles.strikePrice}>${pkg.originalPrice.toFixed(0)}</ThemedText>
                )}
                <ThemedText style={styles.finalPrice}>${pkg.price.toFixed(0)}</ThemedText>
                <View style={[styles.radio, selectedPackage === pkg.id && styles.radioActive]}>
                  {selectedPackage === pkg.id && <View style={styles.radioDot} />}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </LingoCard>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
        {!!feedbackMessage && (
          <View style={styles.feedbackBanner}>
            <ThemedText style={styles.feedbackText}>{feedbackMessage}</ThemedText>
          </View>
        )}
        <View style={styles.footerActionRow}>
          <View style={styles.footerInfo}>
            <ThemedText style={styles.totalLabel}>Total</ThemedText>
            <ThemedText style={styles.totalValue}>${totalAmount.toFixed(2)}</ThemedText>
          </View>
          <LingoButton
            label={totalAmount > 0 ? `Pay $${totalAmount.toFixed(2)}` : 'Book free class'}
            onPress={handleBooking}
            loading={submitting || paymentLoading}
            disabled={!selectedSubject || !selectedTime || selectedChildren.length === 0}
            style={[styles.bookBtn, (submitting || paymentLoading || !selectedSubject || !selectedTime || selectedChildren.length === 0) && styles.btnDisabled]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LingoTheme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorCard: { width: '100%', maxWidth: 340 },
  
  header: {
    paddingHorizontal: 20, paddingBottom: 12,
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12,
  },
  backButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 2, borderColor: '#E5E5E5', borderBottomWidth: 4,
    justifyContent: 'center', alignItems: 'center',
  },
  topBarCenter: { flex: 1, alignItems: 'center' },
  topBarTitle: { fontSize: 20, fontWeight: '800', color: '#3C3C3C' },
  topBarSub: { fontSize: 13, color: '#AFAFAF', fontWeight: '600', marginTop: 2 },
  topBarSpacer: { width: 44 },
  statsRow: {
    flexDirection: 'row', gap: 12, justifyContent: 'center', marginBottom: 8,
  },
  metricPill: {
    flex: 1, alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, borderWidth: 2, borderColor: '#E5E5E5', borderBottomWidth: 4,
    paddingVertical: 12, paddingHorizontal: 4,
  },
  metricIconBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  pillValue: { fontSize: 15, fontWeight: '800', color: '#3C3C3C', maxWidth: '100%' },
  pillLabel: { fontSize: 10, fontWeight: '700', color: '#AFAFAF', textTransform: 'uppercase' },
  
  content: { paddingHorizontal: 20 },

  /* Hero Card */
  teacherCard: {
    flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 24,
    marginBottom: 24, borderWidth: 2, borderColor: LingoTheme.colors.border
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: LingoTheme.colors.softTeal,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFFFFF'
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: LingoTheme.colors.teal },
  teacherInfo: { marginLeft: 16, flex: 1 },
  teacherName: { fontSize: 18, fontWeight: '800', color: LingoTheme.colors.ink },
  teacherSub: { fontSize: 13, color: LingoTheme.colors.muted, marginBottom: 6 },
  courseContext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    borderBottomWidth: 4,
    padding: 14,
    marginBottom: 24,
  },
  courseContextIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LingoTheme.colors.softPrimary,
  },
  courseContextBody: {
    flex: 1,
    minWidth: 0,
  },
  courseContextLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: LingoTheme.colors.muted,
    textTransform: 'uppercase',
  },
  courseContextTitle: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
  },

  /* Sections */
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#374151', marginBottom: 12, textTransform: 'uppercase' },
  rowScroll: { gap: 12, paddingRight: 20 },

  feedbackBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  feedbackText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  /* Children */
  addBtn: {
    marginTop: 4,
  },
  
  childChip: {
    alignItems: 'center', padding: 12, borderRadius: 16, backgroundColor: '#FFF',
    borderWidth: 2, borderColor: LingoTheme.colors.border, minWidth: 85, position: 'relative'
  },
  childChipSelected: { borderColor: LingoTheme.colors.primaryDark, backgroundColor: LingoTheme.colors.softPrimary },
  childAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: LingoTheme.colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8
  },
  childAvatarSelected: { backgroundColor: LingoTheme.colors.primary },
  childInit: { fontSize: 18, fontWeight: '600', color: '#6B7280' },
  childName: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  childNameSelected: { color: LingoTheme.colors.primaryDark, fontWeight: '700' },
  checkBadge: {
    position: 'absolute', top: 8, right: 8, width: 16, height: 16, 
    borderRadius: 8, backgroundColor: '#4ECDC4', justifyContent: 'center', alignItems: 'center'
  },

  /* Date */
  dateCard: {
    alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: '#FFF',
    borderWidth: 1, borderColor: '#E5E7EB', minWidth: 64
  },
  dateCardSelected: { backgroundColor: LingoTheme.colors.primary, borderColor: LingoTheme.colors.primaryDark, elevation: 2 },
  dayText: { fontSize: 12, color: '#6B7280', marginBottom: 4, fontWeight: '500' },
  dateText: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  textSelected: { color: '#FFF' },

  /* Subject Selection */
  subjectRow: { flexDirection: 'row', gap: 12 },
  subjectChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#FFF',
    borderWidth: 2, borderColor: '#E5E7EB'
  },
  subjectChipSelected: { 
    backgroundColor: LingoTheme.colors.primary, borderColor: LingoTheme.colors.primaryDark,
  },
  subjectText: { fontSize: 15, fontWeight: '600', color: '#4B5563' },
  subjectTextSelected: { color: '#FFF' },

  /* Time */
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeChip: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#FFF',
    borderWidth: 1, borderColor: '#E5E7EB', width: '30%', alignItems: 'center'
  },
  timeChipSelected: { backgroundColor: LingoTheme.colors.primary, borderColor: LingoTheme.colors.primaryDark },
  timeText: { fontSize: 14, fontWeight: '500', color: '#4B5563' },
  emptyState: { padding: 20, alignItems: 'center', gap: 8 },
  emptyText: { color: '#9CA3AF' },

  /* Packages */
  pkgCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16,
    borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6'
  },
  pkgCardSelected: { borderColor: LingoTheme.colors.primaryDark, backgroundColor: LingoTheme.colors.softPrimary },
  pkgInfo: { flex: 1 },
  pkgName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  pkgDesc: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  pkgRight: { alignItems: 'flex-end', gap: 2 },
  strikePrice: { fontSize: 12, color: '#9CA3AF', textDecorationLine: 'line-through' },
  finalPrice: { fontSize: 16, fontWeight: '700', color: LingoTheme.colors.primaryDark },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB',
    justifyContent: 'center', alignItems: 'center', marginTop: 4
  },
  radioActive: { borderColor: LingoTheme.colors.primaryDark },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: LingoTheme.colors.primaryDark },

  /* Footer */
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF',
    borderTopWidth: 2, borderTopColor: LingoTheme.colors.border,
    paddingHorizontal: 20,
    paddingTop: 16,
    shadowColor: '#000', shadowOffset: {width:0, height:-2}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 10
  },
  footerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerInfo: { minWidth: 96 },
  totalLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  totalValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  bookBtn: { flex: 1, minWidth: 0 },
  btnDisabled: { backgroundColor: '#E5E7EB', shadowOpacity: 0 },

  errorText: { fontSize: 16, color: '#374151', marginVertical: 12 },
  retryButton: { marginTop: 20 },
});
