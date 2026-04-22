import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ThemedText } from '@/components/themed-text';
import { getStoredPushToken, syncDevicePushToken } from '@/lib/notifications';
import { Fonts } from '@/constants/theme';

type StatusType = 'enabled' | 'disabled' | 'unknown';

interface Props {
  title?: string;
  subtitle?: string;
}

export function NotificationStatusCard({
  title = 'Notifications',
  subtitle = 'Stay ready for class reminders, updates, and new messages.',
}: Props) {
  const [status, setStatus] = useState<StatusType>('unknown');
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        setStatus('disabled');
        setPermissionStatus('unavailable');
        setPushToken(null);
        return;
      }

      const permissions = await Notifications.getPermissionsAsync();
      const storedToken = await getStoredPushToken();
      setPermissionStatus(permissions.status);
      setPushToken(storedToken);
      setStatus(permissions.status === 'granted' && !!storedToken ? 'enabled' : 'disabled');
    } catch (error) {
      console.warn('Failed to load notification status:', error);
      setStatus('unknown');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useFocusEffect(
    useCallback(() => {
      refreshStatus();
    }, [refreshStatus])
  );

  const handleEnable = async () => {
    setSyncing(true);
    try {
      const result = await syncDevicePushToken();
      if (result.error) {
        if (Platform.OS === 'web') {
          Alert.alert('Notifications unavailable', result.error);
        } else {
          Alert.alert(
            'Notifications disabled',
            permissionStatus === 'denied'
              ? 'Enable notifications in device settings to receive class reminders and updates.'
              : result.error,
            permissionStatus === 'denied'
              ? [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Open Settings', onPress: () => Linking.openSettings() },
                ]
              : [{ text: 'OK' }]
          );
        }
      }
      await refreshStatus();
    } finally {
      setSyncing(false);
    }
  };

  const accent = status === 'enabled' ? '#58CC02' : status === 'disabled' ? '#FF4B4B' : '#FFC800';
  const accentSoft = status === 'enabled' ? '#ECFCD8' : status === 'disabled' ? '#FEE2E2' : '#FFF7D6';
  const icon = status === 'enabled' ? 'notifications' : status === 'disabled' ? 'notifications-off' : 'radio-outline';
  const badgeText = status === 'enabled' ? 'Enabled' : status === 'disabled' ? 'Disabled' : 'Checking';
  const helper =
    status === 'enabled'
      ? 'This device is ready to receive push notifications.'
      : permissionStatus === 'denied'
        ? 'Notifications are blocked in device settings.'
        : 'Enable notifications so you never miss a class or message.';

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: accentSoft }]}>
          <Ionicons name={icon as any} size={20} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
        </View>
        <View style={[styles.badge, { backgroundColor: accentSoft, borderColor: accent }]}>
          <ThemedText style={[styles.badgeText, { color: accent }]}>{badgeText}</ThemedText>
        </View>
      </View>

      <View style={styles.messageBox}>
        <ThemedText style={styles.messageText}>{helper}</ThemedText>
        {!!pushToken && <ThemedText style={styles.tokenText}>Token saved on this device</ThemedText>}
      </View>

      <TouchableOpacity style={[styles.button, { backgroundColor: accent }]} onPress={handleEnable} activeOpacity={0.85} disabled={syncing || loading}>
        {syncing || loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name={status === 'enabled' ? 'refresh' : 'checkmark-circle'} size={18} color="#FFFFFF" />
            <ThemedText style={styles.buttonText}>{status === 'enabled' ? 'Refresh status' : 'Enable notifications'}</ThemedText>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#EDE5D8',
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  title: {
    fontSize: 18,
    lineHeight: 22,
    fontFamily: Fonts.rounded,
    fontWeight: '800',
    color: '#25313C',
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  messageBox: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#374151',
    fontWeight: '600',
  },
  tokenText: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 16,
    color: '#0D9488',
    fontWeight: '700',
  },
  button: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.14)',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
