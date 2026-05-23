import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { LingoButton } from '@/components/ui/lingo-mobile';
import { Fonts, LingoTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useSafePadding } from '@/hooks/use-safe-padding';

const logo = require('@/assets/images/logo.png');
const LOGIN_STORAGE = {
  REMEMBER_ME: 'login_remember_me',
  REMEMBERED_EMAIL: 'login_remembered_email',
  REMEMBERED_PASSWORD: 'login_remembered_password',
};

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const { topPadding, bottomPadding } = useSafePadding();
  
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --------------------------------------------------------
  // BACKEND & STATE LOGIC (Unchanged)
  // --------------------------------------------------------
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
    if (!nextValue) await persistRememberedLogin(false);
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

  // --------------------------------------------------------
  // UI PRESENTATION
  // --------------------------------------------------------
  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <KeyboardAvoidingView
        enabled={Platform.OS === 'ios'}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={styles.keyboardView}
      >
        {/* --- TOP HEADER SECTION --- */}
        <View style={styles.topHeader}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()} 
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            <View style={styles.logoWrap}>
              <Image source={logo} style={styles.logo} resizeMode="contain" />
            </View>
            <ThemedText style={styles.title}>Welcome back</ThemedText>
            <ThemedText style={styles.subtitle}>
              Sign in to continue your learning journey.
            </ThemedText>
          </View>
        </View>

        {/* --- BOTTOM SHEET CONTENT --- */}
        <View style={styles.bottomSheetContainer}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: bottomPadding + 32 },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
          >
            <View style={styles.formContent}>
              
              {/* Error Alert */}
              {errorMsg && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={20} color="#EF4444" />
                  <ThemedText style={styles.errorText}>{errorMsg}</ThemedText>
                </View>
              )}

              {/* Email Input */}
              <View style={styles.inputWrapper}>
                <View style={[styles.filledInputContainer, errorMsg && !email ? styles.inputError : null]}>
                  <ThemedText style={styles.tinyLabel}>Email Address</ThemedText>
                  <View style={styles.inputContentRow}>
                    <Ionicons name="mail-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.mainInput}
                      placeholder="you@example.com"
                      placeholderTextColor="#9CA3AF"
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputWrapper}>
                <View style={[styles.filledInputContainer, errorMsg && !password ? styles.inputError : null]}>
                  <ThemedText style={styles.tinyLabel}>Password</ThemedText>
                  <View style={styles.inputContentRow}>
                    <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.mainInput}
                      placeholder="••••••••"
                      placeholderTextColor="#9CA3AF"
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      autoCapitalize="none"
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.iconButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off' : 'eye'}
                        size={20}
                        color="#9CA3AF"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Options Row */}
              <View style={styles.optionsRow}>
                <TouchableOpacity style={styles.rememberRow} onPress={handleRememberToggle} activeOpacity={0.8}>
                  <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                    {rememberMe && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <ThemedText style={styles.optionText}>Remember me</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/forgot-password' as any)}>
                  <ThemedText style={styles.forgotText}>Forgot password?</ThemedText>
                </TouchableOpacity>
              </View>

              {/* Submit Button */}
              <View style={styles.submitWrap}>
                <LingoButton
                  label={loading ? 'Signing in...' : 'Sign In'}
                  icon="arrow-forward"
                  onPress={handleLogin}
                  loading={loading}
                />
              </View>

            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <ThemedText style={styles.footerText}>New to IlmConnect?</ThemedText>
              <TouchableOpacity onPress={() => router.push('/role-selection')} activeOpacity={0.8}>
                <ThemedText style={styles.footerLink}>Create an account</ThemedText>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// --------------------------------------------------------
// STYLES
// --------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LingoTheme.colors.primary || '#2DD4BF',
  },
  keyboardView: {
    flex: 1,
  },

  // --- Top Header ---
  topHeader: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  titleContainer: {
    gap: 8,
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  logo: {
    width: 36,
    height: 36,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: Fonts.rounded,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    paddingRight: 20,
  },

  // --- Bottom Sheet ---
  bottomSheetContainer: {
    flex: 1,
    backgroundColor: LingoTheme.colors.background,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 40,
  },
  formContent: {
    paddingHorizontal: 24,
    flex: 1,
  },

  // --- Form Inputs ---
  inputWrapper: {
    marginBottom: 16,
  },
  filledInputContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderWidth: 1.5,
    borderColor: LingoTheme.colors.border,
  },
  tinyLabel: {
    fontSize: 11,
    color: LingoTheme.colors.muted,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: {
    marginRight: 10,
  },
  mainInput: {
    flex: 1,
    fontSize: 16,
    color: LingoTheme.colors.ink,
    fontWeight: '600',
    paddingVertical: Platform.OS === 'android' ? 2 : 0,
    minHeight: 24,
  },
  iconButton: {
    padding: 4,
    marginLeft: 8,
  },

  // --- Options Row ---
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#CBD5E1', // Slate 300
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxOn: {
    backgroundColor: LingoTheme.colors.primaryDark || '#0D9488',
    borderColor: LingoTheme.colors.primaryDark || '#0D9488',
  },
  optionText: {
    fontSize: 14,
    color: LingoTheme.colors.ink,
    fontWeight: '600',
  },
  forgotText: {
    fontSize: 14,
    color: LingoTheme.colors.primaryDark || '#0D9488',
    fontWeight: '700',
  },

  // --- Errors ---
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
  },
  errorText: {
    flex: 1,
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '600',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },

  // --- Buttons & Footer ---
  submitWrap: {
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingTop: 32,
    paddingBottom: 16,
  },
  footerText: {
    fontSize: 15,
    color: LingoTheme.colors.muted,
    fontWeight: '600',
  },
  footerLink: {
    fontSize: 15,
    color: LingoTheme.colors.primaryDark || '#0D9488',
    fontWeight: '800',
  },
});