import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/lib/config';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafePadding } from '@/hooks/use-safe-padding';
import { Fonts } from '@/constants/theme';

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

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!hasUnsaved) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [hasUnsaved]);

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
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#14B8A6" />
          <ThemedText style={styles.loadingText}>Loading your schedule...</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F766E', '#0D9488', '#14B8A6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPadding }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(teacher)/' as any)}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.headerTitleRow}>
              <ThemedText style={styles.headerTitle}>Availability</ThemedText>
              {hasUnsaved && (
                <Animated.View style={[styles.unsavedDot, { opacity: pulseAnim }]} />
              )}
            </View>
            <ThemedText style={styles.headerSub}>Recurring weekly schedule</ThemedText>
          </View>
          <View style={styles.weekBadge}>
            <ThemedText style={styles.weekBadgeNum}>{totalWeeklySlots}</ThemedText>
            <ThemedText style={styles.weekBadgeLbl}>hrs/wk</ThemedText>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.9)" />
            <ThemedText style={styles.statText}>
              {configuredDays} day{configuredDays !== 1 ? 's' : ''} configured
            </ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statChip}>
            <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.9)" />
            <ThemedText style={styles.statText}>
              {totalWeeklySlots} open slot{totalWeeklySlots !== 1 ? 's' : ''} this week
            </ThemedText>
          </View>
        </View>
      </LinearGradient>

      {/* Day Selector */}
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
      <View style={[styles.footer, { paddingBottom: Math.max(bottomPadding, 16) }]}>
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
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={saving ? ['#9CA3AF', '#9CA3AF'] : ['#0F766E', '#14B8A6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveGradient}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons
                  name={hasUnsaved ? 'save-outline' : 'checkmark-circle-outline'}
                  size={20}
                  color="#FFF"
                  style={{ marginRight: 8 }}
                />
                <ThemedText style={styles.saveBtnText}>
                  {hasUnsaved ? 'Save Changes' : 'Up to Date'}
                </ThemedText>
                {hasUnsaved && <View style={styles.saveDot} />}
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0FDFA' },
  loadingContainer: { flex: 1, backgroundColor: '#F0FDFA', justifyContent: 'center', alignItems: 'center' },
  loadingCard: {
    backgroundColor: '#FFF', borderRadius: 20, paddingVertical: 36, paddingHorizontal: 48,
    alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  loadingText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  header: { paddingHorizontal: 20, paddingBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  headerCenter: { flex: 1 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 22, fontFamily: Fonts?.rounded ?? 'system', fontWeight: '700', color: '#FFF' },
  unsavedDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#FCD34D', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontWeight: '500' },
  weekBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', minWidth: 58,
  },
  weekBadgeNum: { fontSize: 20, fontWeight: '800', color: '#FFF', lineHeight: 24 },
  weekBadgeLbl: { fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginTop: 1 },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  statChip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  statText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  statDivider: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 12 },
  daySelector: {
    flexDirection: 'row', backgroundColor: '#FFF',
    paddingHorizontal: 12, paddingVertical: 12, justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  dayPill: {
    flex: 1, alignItems: 'center', paddingVertical: 9, marginHorizontal: 2,
    borderRadius: 14, backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  dayPillActive: {
    backgroundColor: '#0F766E', borderColor: '#0F766E',
    shadowColor: '#0D9488', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  dayPillAbbr: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.3 },
  dayPillAbbrActive: { color: '#FFF' },
  dayIndicatorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 5, height: 14, gap: 2 },
  todayRing: { width: 6, height: 6, borderRadius: 3, borderWidth: 1.5, borderColor: '#14B8A6' },
  dayDotFilled: { minWidth: 16, height: 14, borderRadius: 7, backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  dayDotFilledActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  dayDotCount: { fontSize: 9, fontWeight: '800', color: '#0D9488', lineHeight: 12 },
  dayDotCountActive: { color: '#FFF' },
  dayDotEmpty: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#E5E7EB' },
  dayBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  dayBarLeft: { flex: 1 },
  dayBarName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  dayBarCount: { fontSize: 12, color: '#6B7280', marginTop: 2, flexShrink: 1 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FEF2F2', marginLeft: 12 },
  clearBtnText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14 },
  groupCard: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  groupIconBg: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  groupHeadLabels: { flex: 1 },
  groupTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  groupSub: { fontSize: 11, color: '#9CA3AF', marginTop: 1, fontWeight: '500' },
  groupCountPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  groupCountText: { fontSize: 11, fontWeight: '700' },
  groupToggle: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB' },
  groupToggleTxt: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  groupDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: {
    width: SLOT_W, paddingVertical: 9, borderRadius: 11, borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3,
  },
  slotCheck: { marginRight: 1 },
  slotText: { fontSize: 12, fontWeight: '600', color: '#4B5563' },
  slotTextOn: { color: '#FFF', fontWeight: '700' },
  overviewCard: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  overviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  overviewIconBg: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#CCFBF1', justifyContent: 'center', alignItems: 'center' },
  overviewTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
  overviewHint: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  overviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 10, marginBottom: 2 },
  overviewRowActive: { backgroundColor: '#F0FDFA' },
  overviewRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 82 },
  overviewAbbr: { fontSize: 12, fontWeight: '800', color: '#9CA3AF', width: 30 },
  overviewAbbrActive: { color: '#0D9488' },
  overviewFull: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  barTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  barFill: { height: 7, borderRadius: 4 },
  overviewCount: { fontSize: 12, fontWeight: '700', color: '#6B7280', width: 30, textAlign: 'right' },
  overviewCountActive: { color: '#0D9488' },
  footer: {
    backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 10,
  },
  feedbackBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginBottom: 12 },
  feedbackBannerOk: { backgroundColor: '#ECFDF5' },
  feedbackBannerErr: { backgroundColor: '#FEF2F2' },
  feedbackText: { flex: 1, fontSize: 13, fontWeight: '600' },
  feedbackTextOk: { color: '#059669' },
  feedbackTextErr: { color: '#DC2626' },
  saveBtn: { borderRadius: 16, overflow: 'hidden', shadowColor: '#0D9488', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  saveBtnDisabled: { shadowOpacity: 0, opacity: 0.75 },
  saveGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 24 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  saveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FCD34D', marginLeft: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
});
