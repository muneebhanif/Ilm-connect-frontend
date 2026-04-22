import { StyleSheet, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LingoBadge, LingoButton, LingoCard, LingoHero } from '@/components/ui/lingo-mobile';
import { Fonts, LingoTheme } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
const LOGIN_STORAGE = {
  REMEMBER_ME: 'login_remember_me',
  REMEMBERED_EMAIL: 'login_remembered_email',
  REMEMBERED_PASSWORD: 'login_remembered_password',
};

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [savedRemember, savedEmail, savedPassword] = await Promise.all([
          AsyncStorage.getItem(LOGIN_STORAGE.REMEMBER_ME),
          AsyncStorage.getItem(LOGIN_STORAGE.REMEMBERED_EMAIL),
          AsyncStorage.getItem(LOGIN_STORAGE.REMEMBERED_PASSWORD),
        ]);

        if (savedRemember === 'true') {
          setRememberMe(true);
          if (savedEmail) setEmail(savedEmail);
          if (savedPassword) setPassword(savedPassword);
        }
      } catch (error) {
        console.error('Failed to load remembered login', error);
      }
    })();
  }, []);

  const persistRememberedLogin = async (enabled: boolean, nextEmail?: string, nextPassword?: string) => {
    if (!enabled) {
      await Promise.all([
        AsyncStorage.setItem(LOGIN_STORAGE.REMEMBER_ME, 'false'),
        AsyncStorage.removeItem(LOGIN_STORAGE.REMEMBERED_EMAIL),
        AsyncStorage.removeItem(LOGIN_STORAGE.REMEMBERED_PASSWORD),
      ]);
      return;
    }

    await Promise.all([
      AsyncStorage.setItem(LOGIN_STORAGE.REMEMBER_ME, 'true'),
      AsyncStorage.setItem(LOGIN_STORAGE.REMEMBERED_EMAIL, (nextEmail ?? email).trim()),
      AsyncStorage.setItem(LOGIN_STORAGE.REMEMBERED_PASSWORD, nextPassword ?? password),
    ]);
  };

  const handleRememberToggle = async () => {
    const nextValue = !rememberMe;
    setRememberMe(nextValue);

    if (!nextValue) {
      await persistRememberedLogin(false);
    }
  };

  const handleLogin = async () => {
    setErrorMsg(null);
    if (!email || !password) {
      setErrorMsg('Please enter both email and password');
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      await persistRememberedLogin(rememberMe, email, password);
    } catch (error: any) {
      setErrorMsg(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Custom "Filled" Input Component to match the design
  const renderInput = (
    label: string,
    value: string,
    setValue: (text: string) => void,
    placeholder: string,
    isPassword = false
  ) => (
    <View style={styles.inputContainer}>
      <ThemedText style={styles.inputLabel}>{label}</ThemedText>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={setValue}
          autoCapitalize="none"
          keyboardType={isPassword ? 'default' : 'email-address'}
          secureTextEntry={isPassword && !showPassword}
        />
        {isPassword && (
          <TouchableOpacity 
            onPress={() => setShowPassword(!showPassword)} 
            style={styles.eyeIcon}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={showPassword ? "eye-off" : "eye"} 
              size={20} 
              color="#9CA3AF" 
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView 
        enabled={Platform.OS === 'ios'}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        style={styles.keyboardView}
      >
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
        >
          <View style={styles.content}>
            <LingoHero
              icon="lock-closed"
              badge="Welcome back"
              title="Sign in and continue learning"
              subtitle="Return to classes, messages, and your dashboard with a bright, simple login flow."
            />

            <LingoCard style={styles.formContainer}>
               <View style={styles.formHeaderRow}>
                 <ThemedText style={styles.formTitle}>Your account</ThemedText>
                 <LingoBadge label="Secure login" icon="shield-checkmark" tone="teal" />
               </View>
               {renderInput('Email', email, setEmail, 'alina@example.com')}
               <View style={{ height: 16 }} />
               {renderInput('Password', password, setPassword, '••••••••', true)}

               {/* Remember Me & Forgot Password Row */}
               <View style={styles.optionsRow}>
                  <TouchableOpacity 
                    style={styles.rememberMeContainer} 
                    onPress={handleRememberToggle}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                       {rememberMe && <Ionicons name="checkmark" size={12} color="white" />}
                    </View>
                    <ThemedText style={styles.optionText}>Remember me</ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/forgot-password' as any)}>
                    <ThemedText style={styles.forgotPasswordText}>Forgot password</ThemedText>
                  </TouchableOpacity>
               </View>

               {/* Error Message */}
               {errorMsg && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={18} color="#EF4444" />
                    <ThemedText style={styles.errorText}>{errorMsg}</ThemedText>
                  </View>
               )}

               {/* Actions */}
               <View style={styles.actionsContainer}>
                <LingoButton
                  label={loading ? 'Signing in...' : 'Sign in'}
                  icon="arrow-forward"
                  onPress={handleLogin}
                  loading={loading}
                />
               </View>

               {/* Footer */}
               <View style={styles.footer}>
                  <ThemedText style={styles.footerText}>Don't have an account? </ThemedText>
                  <TouchableOpacity onPress={() => router.push('/role-selection')}>
                     <ThemedText style={styles.signUpLink}>Sign up</ThemedText>
                  </TouchableOpacity>
               </View>
            </LingoCard>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LingoTheme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
  },

  /* Form */
  formContainer: {
    width: '100%',
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  formTitle: {
    flex: 1,
    fontSize: 22,
    fontFamily: Fonts.rounded,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
  },
  
  /* Input Styles - Matches the "Filled" look */
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
  },
  inputLabel: {
    fontSize: 12,
    color: LingoTheme.colors.muted,
    fontWeight: '700',
    marginBottom: 4,
    marginLeft: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: LingoTheme.colors.ink,
    paddingVertical: Platform.OS === 'android' ? 4 : 2,
    paddingHorizontal: 0,
    fontWeight: '500',
  },
  eyeIcon: {
    padding: 4,
  },

  /* Options Row */
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 24,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  checkboxChecked: {
    backgroundColor: LingoTheme.colors.primary,
    borderColor: LingoTheme.colors.primary,
  },
  optionText: {
    fontSize: 14,
    color: LingoTheme.colors.ink,
    fontWeight: '600',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: LingoTheme.colors.primaryDark,
    fontWeight: '800',
  },

  /* Error */
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    flex: 1,
  },

  /* Actions */
  actionsContainer: {
    marginTop: 4,
  },

  /* Footer */
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
  },
  footerText: {
    fontSize: 14,
    color: LingoTheme.colors.muted,
  },
  signUpLink: {
    fontSize: 14,
    color: LingoTheme.colors.primaryDark,
    fontWeight: '800',
  },
});