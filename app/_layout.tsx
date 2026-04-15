import { Stack } from 'expo-router';
import { AuthProvider } from '@/lib/auth-context';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StripeProvider } from '@/lib/stripe';

const STRIPE_PK = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StripeProvider
        publishableKey={STRIPE_PK}
        merchantIdentifier="merchant.com.ilmconnect.app"
        urlScheme="ilmconnect"
      >
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
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
      </StripeProvider>
    </SafeAreaProvider>
  );
}
