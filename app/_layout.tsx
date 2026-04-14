import { Stack } from 'expo-router';
import { AuthProvider } from '@/lib/auth-context';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
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
    </SafeAreaProvider>
  );
}
