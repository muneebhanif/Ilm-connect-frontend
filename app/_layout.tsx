import { Stack } from 'expo-router';
import { AuthProvider } from '@/lib/auth-context';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StripeProvider } from '@/lib/stripe';
import { useEffect } from 'react';
import { configurePushNotifications } from '@/lib/notifications';
import { LingoTheme } from '@/constants/theme';

const STRIPE_PK = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

export default function RootLayout() {
  // Android hardware back is handled natively by expo-router

  useEffect(() => {
    configurePushNotifications().catch((error) => {
      console.warn('Notification channel setup failed:', error);
    });
  }, []);

  const content = (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: LingoTheme.colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="role-selection" />
        <Stack.Screen name="signup-parent" />
        <Stack.Screen name="signup-teacher" />
        <Stack.Screen name="signup-student" />
        <Stack.Screen name="(parent)" />
        <Stack.Screen name="(teacher)" />
        <Stack.Screen name="(student)" />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </AuthProvider>
  );

  return (
    <SafeAreaProvider>
      {STRIPE_PK ? (
        <StripeProvider
          publishableKey={STRIPE_PK}
          merchantIdentifier="merchant.com.ilmconnect.app"
          urlScheme="ilmconnect"
        >
          {content}
        </StripeProvider>
      ) : (
        content
      )}
    </SafeAreaProvider>
  );
}
