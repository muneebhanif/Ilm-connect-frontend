import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './config';
import { authFetchJson } from './auth-fetch';

const STORAGE_KEYS = {
  PUSH_TOKEN: 'expo_push_token',
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    (Constants as any).easConfig?.projectId ||
    undefined
  );
}

export async function configurePushNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10B981',
      sound: 'default',
    });
  }
}

export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') {
    return { token: null, error: null as string | null };
  }

  await configurePushNotifications();

  let permissionStatus = (await Notifications.getPermissionsAsync()).status;
  if (permissionStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    permissionStatus = requested.status;
  }

  if (permissionStatus !== 'granted') {
    return { token: null, error: 'Notification permission not granted' };
  }

  const projectId = getProjectId();
  if (!projectId) {
    return { token: null, error: 'Expo project ID not configured. Make sure eas.json and app.json are set up correctly.' };
  }

  try {
    const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
    await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, pushToken.data);
    return { token: pushToken.data, error: null as string | null };
  } catch (err: any) {
    console.error('getExpoPushTokenAsync failed:', err);
    const msg = err?.message || 'Failed to get push token';
    // Firebase not initialized — app needs a valid google-services.json and a proper native build (not Expo Go)
    if (msg.includes('Firebase') || msg.includes('FirebaseApp')) {
      return { token: null, error: 'Push notifications require a native build with Firebase configured. Use the IlmConnect app build instead of Expo Go.' };
    }
    // Common Android issue: Google Play Services unavailable
    if (msg.includes('Play') || msg.includes('GCM') || msg.includes('FCM')) {
      return { token: null, error: 'Google Play Services is required for push notifications on Android.' };
    }
    return { token: null, error: msg };
  }
}

export async function syncDevicePushToken() {
  let registerResult: { token: string | null; error: string | null };
  try {
    registerResult = await registerForPushNotificationsAsync();
  } catch (err: any) {
    console.error('registerForPushNotificationsAsync threw:', err);
    return { token: null, error: err?.message || 'Unexpected error registering for notifications' };
  }
  const { token, error } = registerResult;
  if (!token) {
    return { token: null, error };
  }

  const appVersion = Constants.expoConfig?.version || null;
  const deviceName = Constants.deviceName || null;

  const result = await authFetchJson(api.notifications.registerDevice(), {
    method: 'POST',
    body: JSON.stringify({
      token,
      platform: Platform.OS,
      appVersion,
      deviceName,
    }),
  });

  if (result.error) {
    return { token: null, error: result.error };
  }

  return { token, error: null as string | null };
}

export async function getStoredPushToken() {
  return AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
}