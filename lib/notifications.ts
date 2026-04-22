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
    return { token: null, error: 'Expo project ID is missing' };
  }

  const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
  await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, pushToken.data);

  return { token: pushToken.data, error: null as string | null };
}

export async function syncDevicePushToken() {
  const { token, error } = await registerForPushNotificationsAsync();
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