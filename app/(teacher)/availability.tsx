import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/lib/config';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { LingoButton, LingoCard } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
type DayName = (typeof DAYS)[number];

/** All 24 hourly slots as "HH:00" strings. */
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

const formatTime = (time24: string) => {
  const hour24 = parseInt(time24, 10);
  if (!Number.isFinite(hour24)) return time24;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = ((hour24 + 11) % 12) + 1;
  return `${hour12}:00 ${suffix}`;
};

/** Returns today's weekday name e.g. "Wednesday". */
const todayDayName = (): DayName => {
  const idx = new Date().getDay(); // 0 = Sunday
  const map: DayName[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return map[idx];
};

// ─── Time-group definitions ────────────────────────────────────────────────────

interface TimeGroup {
  label: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  gradient: [string, string];
  lightColor: string;
  slots: string[];
}

const SLOT_GROUPS: TimeGroup[] = [
  {
    label: 'Morning',
    subtitle: '6:00 AM – 12:00 PM',
    icon: 'sunny-outline',
    color: '#D97706',
    gradient: ['#F59E0B', '#FBBF24'],
    lightColor: '#FEF3C7',
    slots: ALL_HOURS.slice(6, 12),
  },
  {
    label: 'Afternoon',
    subtitle: '12:00 PM – 6:00 PM',
    icon: 'partly-sunny-outline',
    color: '#2563EB',
    gradient: ['#3B82F6', '#60A5FA'],
    lightColor: '#DBEAFE',
    slots: ALL_HOURS.slice(12, 18),
  },
  {
    label: 'Evening',
    subtitle: '6:00 PM – 12:00 AM',
    icon: 'moon-outline',
    color: '#4F46E5',
    gradient: ['#6366F1', '#818CF8'],
    lightColor: '#EEF2FF',
    slots: ALL_HOURS.slice(18, 24),
  },
  {
    label: 'Late Night',
    subtitle: '12:00 AM – 6:00 AM',
    icon: 'bed-outline',
    color: '#374151',
    gradient: ['#4B5563', '#6B7280'],
    lightColor: '#F3F4F6',
    slots: ALL_HOURS.slice(0, 6),
  },
];

// Slot chip width: 3 per row, accounting for scrollContent padding (16×2),
// groupCard padding (16×2), and 2 inner gaps (8×2).
const SLOT_W = Math.floor((SCREEN_W - 64 - 16) / 3);

// ─── Component ────────────────────────────────────────────────────────────────

export default function AvailabilityScreen() {
  const router = useRouter();
  const { topPadding, bottomPadding } = useSafePadding();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [feedback, setFeedback] = useState<'success' | 'error' | null>(null);
  const [availability, setAvailability] = useState<Record<string, string[]>>({});
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayName>(todayDayName());

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(t);
  }, [feedback]);

  useEffect(() => {
    loadAvailability();
  }, []);

  const loadAvailability = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) { setLoading(false); return; }
      setTeacherId(userId);
      const res = await fetch(api.teacherById(userId));
      const data = await res.json();
      if (data.teacher?.availability && typeof data.teacher.availability === 'object') {
        // Sanitize: only keep valid day names as keys and valid HH:00 strings as values
        const raw = data.teacher.availability as Record<string, unknown>;
        const sanitized: Record<string, string[]> = {};
        for (const day of DAYS) {
          const daySlots = raw[day];
          if (Array.isArray(daySlots)) {
            sanitized[day] = (daySlots as string[]).filter(s => ALL_HOURS.includes(s));
          }
        }
        setAvailability(sanitized);
      }
    } catch {
      Alert.alert('Error', 'Failed to load your availability.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSlot = useCallback((day: string, time: string) => {
    setHasUnsaved(true);
    setAvailability(prev => {
      const current = prev[day] || [];
      const updated = current.includes(time)
        ? current.filter(t => t !== time)
        : [...current, time].sort();
      return { ...prev, [day]: updated };
    });
  }, []);

  const toggleGroupAll = useCallback((day: string, groupSlots: string[]) => {
    setHasUnsaved(true);
    setAvailability(prev => {
      const current = prev[day] || [];
      const allSelected = groupSlots.every(s => current.includes(s));
      const updated = allSelected
        ? current.filter(t => !groupSlots.includes(t))
        : [...new Set([...current, ...groupSlots])].sort();
      return { ...prev, [day]: updated };
    });
  }, []);

  const clearDay = useCallback((day: string) => {
    setHasUnsaved(true);
    setAvailability(prev => ({ ...prev, [day]: [] }));
  }, []);

  const handleSave = async () => {
    if (!teacherId) { Alert.alert('Error', 'Please log in again.'); return; }
    setSaving(true);
    try {
      const res = await fetch(api.teacherById(teacherId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availability }),
      });
      if (!res.ok) throw new Error();
      setFeedback('success');
      setHasUnsaved(false);
    } catch {
      setFeedback('error');
    } finally {
      setSaving(false);
    }
  };

  const selectedSlots = availability[selectedDay] || [];
  const totalWeeklySlots = DAYS.reduce((s, d) => s + (availability[d]?.length || 0), 0);
  const configuredDays = DAYS.filter(d => (availability[d]?.length || 0) > 0).length;

  const getGroupState = (groupSlots: string[]) => {
    const count = groupSlots.filter(s => selectedSlots.includes(s)).length;
    if (count === 0) return 'none';
    if (count === groupSlots.length) return 'all';
    return 'partial';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LingoCard style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#14B8A6" />
          <ThemedText style={styles.loadingText}>Loading your schedule...</ThemedText>
        </LingoCard>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.headerWrap, { paddingTop: topPadding }]}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.canGoBack() ? router.back() : router.replace('/(teacher)/' as any)} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color="#3C3C3C" />
          </TouchableOpacity>
          <View style={styles.topBarCenter}>
            <ThemedText style={styles.topBarTitle}>Availability</ThemedText>
            <ThemedText style={styles.topBarSub}>{hasUnsaved ? '🟡 Unsaved changes' : 'Ready for bookings'}</ThemedText>
          </View>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.statsRow}>
          <View style={styles.metricPill}>
            <ThemedText style={styles.pillIcon}>🗓️</ThemedText>
            <ThemedText style={styles.pillValue}>{configuredDays}</ThemedText>
            <ThemedText style={styles.pillLabel}>Days set</ThemedText>
          </View>
          <View style={styles.metricPill}>
            <ThemedText style={styles.pillIcon}>⏰</ThemedText>
            <ThemedText style={styles.pillValue}>{totalWeeklySlots}</ThemedText>
            <ThemedText style={styles.pillLabel}>Open slots</ThemedText>
          </View>
          <View style={styles.metricPill}>
            <ThemedText style={styles.pillIcon}>✨</ThemedText>
            <ThemedText style={styles.pillValue}>{selectedSlots.length}</ThemedText>
            <ThemedText style={styles.pillLabel}>Today</ThemedText>
          </View>
        </View>
      </View>

      {/* Day Selector */}
      <View style={styles.daySelectorWrap}>
      <View style={styles.daySelector}>
        {DAYS.map((day, i) => {
          const isActive = selectedDay === day;
          const slotCount = availability[day]?.length || 0;
          const isToday = day === todayDayName();
          return (
            <TouchableOpacity
              key={day}
              style={[styles.dayPill, isActive && styles.dayPillActive]}
              onPress={() => setSelectedDay(day)}
              activeOpacity={0.75}
            >
              <ThemedText style={[styles.dayPillAbbr, isActive && styles.dayPillAbbrActive]}>
                {DAY_ABBR[i]}
              </ThemedText>
              <View style={styles.dayIndicatorRow}>
                {isToday && !isActive && <View style={styles.todayRing} />}
                {slotCount > 0 ? (
                  <View style={[styles.dayDotFilled, isActive && styles.dayDotFilledActive]}>
                    <ThemedText style={[styles.dayDotCount, isActive && styles.dayDotCountActive]}>
                      {slotCount}
                    </ThemedText>
                  </View>
                ) : (
                  <View style={styles.dayDotEmpty} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      </View>

      {/* Day Header Bar */}
      <View style={styles.dayBar}>
        <View style={styles.dayBarLeft}>
          <ThemedText style={styles.dayBarName}>{selectedDay}</ThemedText>
          <ThemedText style={styles.dayBarCount}>
            {selectedSlots.length === 0
              ? 'No slots selected — tap chips below to open time slots'
              : `${selectedSlots.length} slot${selectedSlots.length !== 1 ? 's' : ''} open for bookings`}
          </ThemedText>
        </View>
        {selectedSlots.length > 0 && (
          <TouchableOpacity
            style={styles.clearBtn}
            activeOpacity={0.75}
            onPress={() =>
              Alert.alert(
                `Clear ${selectedDay}?`,
                `Remove all ${selectedSlots.length} slot${selectedSlots.length !== 1 ? 's' : ''} from ${selectedDay}?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', style: 'destructive', onPress: () => clearDay(selectedDay) },
                ]
              )
            }
          >
            <Ionicons name="trash-outline" size={13} color="#EF4444" />
            <ThemedText style={styles.clearBtnText}>Clear</ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {/* Scroll Body */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {SLOT_GROUPS.map(group => {
          const state = getGroupState(group.slots);
          const groupSelected = group.slots.filter(s => selectedSlots.includes(s)).length;
          return (
            <View key={group.label} style={styles.groupCard}>
              <View style={styles.groupHead}>
                <LinearGradient
                  colors={group.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.groupIconBg}
                >
                  <Ionicons name={group.icon} size={16} color="#FFF" />
                </LinearGradient>
                <View style={styles.groupHeadLabels}>
                  <ThemedText style={styles.groupTitle}>{group.label}</ThemedText>
                  <ThemedText style={styles.groupSub}>{group.subtitle}</ThemedText>
                </View>
                {groupSelected > 0 && (
                  <View style={[styles.groupCountPill, { backgroundColor: group.lightColor }]}>
                    <ThemedText style={[styles.groupCountText, { color: group.color }]}>
                      {groupSelected}/{group.slots.length}
                    </ThemedText>
                  </View>
                )}
                <TouchableOpacity
                  style={[
                    styles.groupToggle,
                    state === 'all' && { backgroundColor: group.color, borderColor: group.color },
                    state === 'partial' && { borderColor: group.color },
                  ]}
                  onPress={() => toggleGroupAll(selectedDay, group.slots)}
                  activeOpacity={0.75}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  {state === 'all' ? (
                    <Ionicons name="checkmark" size={14} color="#FFF" />
                  ) : state === 'partial' ? (
                    <Ionicons name="remove" size={14} color={group.color} />
                  ) : (
                    <ThemedText style={styles.groupToggleTxt}>All</ThemedText>
                  )}
                </TouchableOpacity>
              </View>
              <View style={styles.groupDivider} />
              <View style={styles.slotGrid}>
                {group.slots.map(time => {
                  const isOn = selectedSlots.includes(time);
                  return (
                    <TouchableOpacity
                      key={time}
                      style={[
                        styles.slot,
                        isOn && { backgroundColor: group.color, borderColor: group.color },
                      ]}
                      onPress={() => toggleSlot(selectedDay, time)}
                      activeOpacity={0.72}
                    >
                      {isOn && (
                        <Ionicons
                          name="checkmark-circle"
                          size={10}
                          color="rgba(255,255,255,0.7)"
                          style={styles.slotCheck}
                        />
                      )}
                      <ThemedText style={[styles.slotText, isOn && styles.slotTextOn]}>
                        {formatTime(time)}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}

        {/* Weekly Overview */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <View style={styles.overviewIconBg}>
              <Ionicons name="grid-outline" size={16} color="#0D9488" />
            </View>
            <ThemedText style={styles.overviewTitle}>Weekly Overview</ThemedText>
            <ThemedText style={styles.overviewHint}>Tap a row to switch day</ThemedText>
          </View>
          {DAYS.map((day, i) => {
            const slots = availability[day] || [];
            const isActive = day === selectedDay;
            const barPct = Math.min(slots.length / 12, 1);
            return (
              <TouchableOpacity
                key={day}
                style={[styles.overviewRow, isActive && styles.overviewRowActive]}
                onPress={() => setSelectedDay(day)}
                activeOpacity={0.75}
              >
                <View style={styles.overviewRowLeft}>
                  <ThemedText style={[styles.overviewAbbr, isActive && styles.overviewAbbrActive]}>
                    {DAY_ABBR[i]}
                  </ThemedText>
                  <ThemedText style={styles.overviewFull}>{day}</ThemedText>
                </View>
                <View style={styles.barTrack}>
                  {barPct > 0 && (
                    <LinearGradient
                      colors={['#14B8A6', '#4ECDC4']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.barFill, { width: `${barPct * 100}%` as any }]}
                    />
                  )}
                </View>
                <ThemedText style={[styles.overviewCount, isActive && styles.overviewCountActive]}>
                  {slots.length > 0 ? `${slots.length}h` : '-'}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 130 }} />
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: bottomPadding + (Platform.OS === 'ios' ? 120 : 100) }]}> 
        {!!feedback && (
          <View style={[
            styles.feedbackBanner,
            feedback === 'success' ? styles.feedbackBannerOk : styles.feedbackBannerErr,
          ]}>
            <Ionicons
              name={feedback === 'success' ? 'checkmark-circle' : 'alert-circle'}
              size={16}
              color={feedback === 'success' ? '#059669' : '#DC2626'}
            />
            <ThemedText style={[
              styles.feedbackText,
              feedback === 'success' ? styles.feedbackTextOk : styles.feedbackTextErr,
            ]}>
              {feedback === 'success'
                ? 'Saved! Students can now book your open slots.'
                : 'Could not save changes. Please try again.'}
            </ThemedText>
          </View>
        )}
        <LingoButton
          label={hasUnsaved ? 'Save changes' : 'Up to date'}
          icon={hasUnsaved ? 'save-outline' : 'checkmark-circle-outline'}
          onPress={handleSave}
          loading={saving}
          disabled={!hasUnsaved && !saving}
          style={[styles.saveBtn, !hasUnsaved && styles.saveBtnDisabled]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LingoTheme.colors.background },
  loadingContainer: { flex: 1, backgroundColor: LingoTheme.colors.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  loadingCard: {
    alignItems: 'center', gap: 14,
    width: '100%',
    maxWidth: 340,
  },
  loadingText: { fontSize: 14, color: LingoTheme.colors.muted, fontWeight: '700' },
  headerWrap: { paddingHorizontal: 20, paddingBottom: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  backButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 2, borderColor: '#E5E5E5', borderBottomWidth: 4,
    justifyContent: 'center', alignItems: 'center',
  },
  topBarCenter: { flex: 1, alignItems: 'center' },
  topBarTitle: { fontSize: 20, fontWeight: '800', color: '#3C3C3C' },
  topBarSub: { fontSize: 13, color: '#AFAFAF', fontWeight: '600', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginBottom: 8 },
  metricPill: {
    flex: 1, alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, borderWidth: 2, borderColor: '#E5E5E5', borderBottomWidth: 4,
    paddingVertical: 12, paddingHorizontal: 4,
  },
  pillIcon: { fontSize: 18, marginBottom: 2 },
  pillValue: { fontSize: 18, fontWeight: '800', color: '#3C3C3C' },
  pillLabel: { fontSize: 11, fontWeight: '700', color: '#AFAFAF', textTransform: 'uppercase' },
  daySelectorWrap: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  daySelector: {
    flexDirection: 'row', backgroundColor: '#FFF',
    paddingHorizontal: 12, paddingVertical: 12, justifyContent: 'space-between',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    ...LingoTheme.shadow.card,
  },
  dayPill: {
    flex: 1, alignItems: 'center', paddingVertical: 9, marginHorizontal: 2,
    borderRadius: 14, backgroundColor: LingoTheme.colors.surfaceAlt, borderWidth: 1.5, borderColor: LingoTheme.colors.border,
  },
  dayPillActive: {
    backgroundColor: LingoTheme.colors.primary, borderColor: LingoTheme.colors.primaryDark,
  },
  dayPillAbbr: { fontSize: 11, fontWeight: '700', color: LingoTheme.colors.muted, letterSpacing: 0.3 },
  dayPillAbbrActive: { color: '#FFF' },
  dayIndicatorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 5, height: 14, gap: 2 },
  todayRing: { width: 6, height: 6, borderRadius: 3, borderWidth: 1.5, borderColor: LingoTheme.colors.teal },
  dayDotFilled: { minWidth: 16, height: 14, borderRadius: 7, backgroundColor: LingoTheme.colors.softPrimary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  dayDotFilledActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  dayDotCount: { fontSize: 9, fontWeight: '800', color: LingoTheme.colors.primaryDark, lineHeight: 12 },
  dayDotCountActive: { color: '#FFF' },
  dayDotEmpty: { width: 5, height: 5, borderRadius: 3, backgroundColor: LingoTheme.colors.border },
  dayBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: '#FFF', borderTopWidth: 2, borderBottomWidth: 2, borderColor: LingoTheme.colors.border,
  },
  dayBarLeft: { flex: 1 },
  dayBarName: { fontSize: 16, fontWeight: '800', color: LingoTheme.colors.ink },
  dayBarCount: { fontSize: 12, color: LingoTheme.colors.muted, marginTop: 2, flexShrink: 1 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: LingoTheme.colors.softDanger, marginLeft: 12, borderWidth: 1.5, borderColor: '#F7A7A7' },
  clearBtnText: { fontSize: 12, fontWeight: '700', color: LingoTheme.colors.danger },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 14 },
  groupCard: {
    backgroundColor: '#FFF', borderRadius: 24, padding: 16, marginBottom: 12,
    borderWidth: 2, borderColor: LingoTheme.colors.border,
    ...LingoTheme.shadow.card,
  },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  groupIconBg: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  groupHeadLabels: { flex: 1 },
  groupTitle: { fontSize: 15, fontWeight: '800', color: LingoTheme.colors.ink },
  groupSub: { fontSize: 11, color: LingoTheme.colors.muted, marginTop: 1, fontWeight: '500' },
  groupCountPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  groupCountText: { fontSize: 11, fontWeight: '700' },
  groupToggle: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: LingoTheme.colors.surfaceAlt, borderWidth: 1.5, borderColor: LingoTheme.colors.border },
  groupToggleTxt: { fontSize: 11, fontWeight: '700', color: LingoTheme.colors.muted },
  groupDivider: { height: 1, backgroundColor: LingoTheme.colors.border, marginVertical: 12 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: {
    width: SLOT_W, paddingVertical: 9, borderRadius: 14, borderWidth: 1.5, borderColor: LingoTheme.colors.border,
    backgroundColor: LingoTheme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3,
  },
  slotCheck: { marginRight: 1 },
  slotText: { fontSize: 12, fontWeight: '700', color: '#4B5563' },
  slotTextOn: { color: '#FFF', fontWeight: '700' },
  overviewCard: {
    backgroundColor: '#FFF', borderRadius: 24, padding: 16, marginBottom: 12,
    borderWidth: 2, borderColor: LingoTheme.colors.border,
    ...LingoTheme.shadow.card,
  },
  overviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  overviewIconBg: { width: 30, height: 30, borderRadius: 8, backgroundColor: LingoTheme.colors.softTeal, justifyContent: 'center', alignItems: 'center' },
  overviewTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: LingoTheme.colors.ink },
  overviewHint: { fontSize: 11, color: LingoTheme.colors.muted, fontWeight: '500' },
  overviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 10, marginBottom: 2 },
  overviewRowActive: { backgroundColor: LingoTheme.colors.softPrimary },
  overviewRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 82 },
  overviewAbbr: { fontSize: 12, fontWeight: '800', color: '#9CA3AF', width: 30 },
  overviewAbbrActive: { color: LingoTheme.colors.primaryDark },
  overviewFull: { fontSize: 12, color: LingoTheme.colors.muted, fontWeight: '500' },
  barTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: LingoTheme.colors.surfaceAlt, overflow: 'hidden' },
  barFill: { height: 7, borderRadius: 4 },
  overviewCount: { fontSize: 12, fontWeight: '700', color: LingoTheme.colors.muted, width: 30, textAlign: 'right' },
  overviewCountActive: { color: LingoTheme.colors.primaryDark },
  footer: {
    backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 14,
    borderTopWidth: 2, borderTopColor: LingoTheme.colors.border,
  },
  feedbackBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginBottom: 12 },
  feedbackBannerOk: { backgroundColor: '#ECFDF5' },
  feedbackBannerErr: { backgroundColor: '#FEF2F2' },
  feedbackText: { flex: 1, fontSize: 13, fontWeight: '600' },
  feedbackTextOk: { color: '#059669' },
  feedbackTextErr: { color: '#DC2626' },
  saveBtn: { borderRadius: 18 },
  saveBtnDisabled: { opacity: 0.78 },
});
