import { StyleSheet, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackButton } from '@/components/back-button';
import { api } from '@/lib/config';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Generate 24-hour slots
const TIME_SLOTS_24H = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, '0');
  return `${hour}:00`;
});

const formatTime12h = (time24: string) => {
  const [hh, mm] = time24.split(':');
  const hour24 = Number(hh);
  if (!Number.isFinite(hour24)) return time24;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = ((hour24 + 11) % 12) + 1;
  return `${hour12}:${mm || '00'} ${suffix}`;
};

// Helper to group slots
const SLOT_GROUPS = [
  { label: 'Morning', slots: TIME_SLOTS_24H.slice(6, 12), icon: 'sunny-outline' },
  { label: 'Afternoon', slots: TIME_SLOTS_24H.slice(12, 18), icon: 'partly-sunny-outline' },
  { label: 'Evening', slots: TIME_SLOTS_24H.slice(18, 24), icon: 'moon-outline' },
  { label: 'Night', slots: TIME_SLOTS_24H.slice(0, 6), icon: 'bed-outline' },
];

export default function AvailabilityScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [availability, setAvailability] = useState<any>({});
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Generate next 14 days for horizontal strip
  const dateStrip = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  useEffect(() => {
    loadAvailability();
  }, []);

  // Auto-clear the small UI feedback message
  useEffect(() => {
    if (!saveFeedback) return;
    const t = setTimeout(() => setSaveFeedback(null), 2500);
    return () => clearTimeout(t);
  }, [saveFeedback]);

  const loadAvailability = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        router.replace('/login');
        return;
      }
      setTeacherId(userId);

      const response = await fetch(api.teacherById(userId));
      const data = await response.json();
      
      if (data.teacher && data.teacher.availability) {
        setAvailability(data.teacher.availability);
      }
    } catch (error) {
      console.error('Error loading availability:', error);
      Alert.alert('Error', 'Failed to load availability');
    } finally {
      setLoading(false);
    }
  };

  const getDayKey = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const isSlotInPast = (time24: string) => {
    // Only block slots in the past for the currently selected day.
    // Date strip only includes today -> next 13 days, so we only need to handle "today".
    const now = new Date();
    const isToday = selectedDate.toDateString() === now.toDateString();
    if (!isToday) return false;
    const [hh, mm] = time24.split(':');
    const hour = Number(hh);
    const minute = Number(mm || '0');
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
    const slotDate = new Date(selectedDate);
    slotDate.setHours(hour, minute, 0, 0);
    return slotDate.getTime() <= now.getTime();
  };

  const toggleSlot = (time: string) => {
    const dayKey = getDayKey(selectedDate);
    const currentSlots = availability[dayKey] || [];
    let newSlots;
    
    if (currentSlots.includes(time)) {
      newSlots = currentSlots.filter((t: string) => t !== time);
    } else {
      newSlots = [...currentSlots, time].sort();
    }

    setAvailability({
      ...availability,
      [dayKey]: newSlots
    });
  };

  const handleSave = async () => {
    if (!teacherId) {
      setSaveFeedback({ type: 'error', message: 'Please log in again' });
      if (Platform.OS !== 'web') Alert.alert('Error', 'Please log in again');
      return;
    }
    setSaving(true);
    setSaveFeedback(null);

    try {
      const response = await fetch(api.teacherById(teacherId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          availability: availability
        }),
      });

      if (!response.ok) throw new Error('Failed to update');

      setSaveFeedback({ type: 'success', message: 'Availability saved' });
      if (Platform.OS !== 'web') Alert.alert('Success', 'Availability is set!');
    } catch (error) {
      setSaveFeedback({ type: 'error', message: 'Failed to save changes' });
      if (Platform.OS !== 'web') Alert.alert('Error', 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const selectedDayName = getDayKey(selectedDate);
  const selectedDaySlots = availability[selectedDayName] || [];

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
           <BackButton />
           <ThemedText style={styles.headerTitle}>Availability</ThemedText>
           <View style={{ width: 40 }} />
        </View>
        <ThemedText style={styles.headerSubtitle}>
           Tap slots to open them for bookings
        </ThemedText>
      </View>

      <View style={styles.content}>
        
        {/* Date Strip */}
        <View style={styles.dateStripContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateScroll}>
            {dateStrip.map((date, index) => {
              const isSelected = selectedDate.toDateString() === date.toDateString();
              const dayName = getDayKey(date);
              const hasSlots = availability[dayName] && availability[dayName].length > 0;

              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.dateCard, isSelected && styles.dateCardSelected]}
                  onPress={() => setSelectedDate(date)}
                >
                  <ThemedText style={[styles.dayName, isSelected && styles.textSelected]}>
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </ThemedText>
                  <ThemedText style={[styles.dayNumber, isSelected && styles.textSelected]}>
                    {date.getDate()}
                  </ThemedText>
                  {hasSlots && !isSelected && <View style={styles.dot} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.dayHeader}>
             <ThemedText style={styles.dayTitle}>Editing {selectedDayName}</ThemedText>
             <ThemedText style={styles.slotCount}>
                {selectedDaySlots.length} slots selected
             </ThemedText>
          </View>

          {/* Time Slot Groups */}
          {SLOT_GROUPS.map((group, index) => (
            <View key={index} style={styles.groupContainer}>
              <View style={styles.groupHeader}>
                <Ionicons name={group.icon as any} size={20} color="#6B7280" />
                <ThemedText style={styles.groupLabel}>{group.label}</ThemedText>
              </View>
              
              <View style={styles.grid}>
                {group.slots.map((time) => {
                  const isSelected = selectedDaySlots.includes(time);
                  const isDisabled = isSlotInPast(time);
                  return (
                    <TouchableOpacity
                      key={time}
                      style={[
                        styles.slotChip,
                        isSelected && styles.slotChipSelected,
                        isDisabled && styles.slotChipDisabled,
                      ]}
                      onPress={() => toggleSlot(time)}
                      disabled={isDisabled}
                      activeOpacity={0.7}
                    >
                      <ThemedText
                        style={[
                          styles.slotText,
                          isSelected && styles.slotTextSelected,
                          isDisabled && styles.slotTextDisabled,
                        ]}
                      >
                        {formatTime12h(time)}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
          
          <View style={styles.bottomPadding} />
        </ScrollView>
      </View>

      {/* Floating Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.disabledButton]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.9}
        >
          <LinearGradient
             colors={saving ? ['#9CA3AF', '#9CA3AF'] : ['#4ECDC4', '#2BCBBA']}
             start={{ x: 0, y: 0 }}
             end={{ x: 1, y: 0 }}
             style={styles.saveGradient}
          >
             {saving ? (
               <ActivityIndicator color="#FFF" />
             ) : (
               <>
                 <Ionicons name="save-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                 <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>
               </>
             )}
          </LinearGradient>
        </TouchableOpacity>

        {!!saveFeedback && (
          <View style={styles.saveFeedbackContainer}>
            <ThemedText
              style={[
                styles.saveFeedbackText,
                saveFeedback.type === 'success' ? styles.saveFeedbackSuccess : styles.saveFeedbackError,
              ]}
            >
              {saveFeedback.message}
            </ThemedText>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  slotChipDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  slotTextDisabled: {
    color: '#9CA3AF',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  /* Header */
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },

  content: {
    flex: 1,
  },

  /* Date Strip */
  dateStripContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
  dateScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  dateCard: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 64,
  },
  dateCardSelected: {
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  dayName: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  textSelected: {
    color: '#FFFFFF',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ECDC4',
    marginTop: 6,
  },

  /* Scroll Content */
  scrollContent: {
    paddingHorizontal: 20,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  slotCount: {
    fontSize: 14,
    color: '#4ECDC4',
    fontWeight: '600',
  },

  /* Group Section */
  groupContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  groupLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  slotChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: '22%', // 4 per row
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotChipSelected: {
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4',
  },
  slotText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  slotTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  bottomPadding: {
    height: 100,
  },

  /* Footer */
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  disabledButton: {
    opacity: 0.8,
    shadowOpacity: 0,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  saveFeedbackContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  saveFeedbackText: {
    fontSize: 13,
    fontWeight: '600',
  },
  saveFeedbackSuccess: {
    color: '#4ECDC4',
  },
  saveFeedbackError: {
    color: '#FF6B6B',
  },
});