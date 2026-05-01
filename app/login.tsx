import { StyleSheet, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
// Back button removed
import { Fonts } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const logo = require('@/assets/images/logo.png');
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
            {/* Header Section */}
            <View style={styles.header}>
               {/* Logo */}
               <View style={styles.logoBadge}>
                  <Image source={logo} style={styles.logoImage} resizeMode="contain" />
               </View>
               
               <ThemedText style={styles.welcomeText}>Welcome back</ThemedText>
               <ThemedText style={styles.subtitleText}>Please enter your details.</ThemedText>
            </View>

            {/* Form Section */}
            <View style={styles.formContainer}>
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
                 {/* Main Sign In Button */}
                 <TouchableOpacity 
                    style={[styles.primaryButton, loading && styles.buttonDisabled]}
                    onPress={handleLogin}
                    disabled={loading}
                    activeOpacity={0.9}
                 >
                    <LinearGradient
                      colors={loading ? ['#E5E7EB', '#E5E7EB'] : ['#4ECDC4', '#3DBDB4']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.primaryButtonGradient}
                    >
                       <ThemedText style={[styles.primaryButtonText, loading && { color: '#9CA3AF' }]}>
                          {loading ? 'Signing in...' : 'Sign in'}
                       </ThemedText>
                    </LinearGradient>
                 </TouchableOpacity>

                 {/* Google Sign In Button
                 <TouchableOpacity style={styles.googleButton} activeOpacity={0.8}>
                    <Ionicons name="logo-google" size={20} color="#1F2937" style={{ marginRight: 8 }} />
                    <ThemedText style={styles.googleButtonText}>Sign in with Google</ThemedText>
                 </TouchableOpacity> */}
               </View>

               {/* Footer */}
               <View style={styles.footer}>
                  <ThemedText style={styles.footerText}>Don't have an account? </ThemedText>
                  <TouchableOpacity onPress={() => router.push('/role-selection')}>
                     <ThemedText style={styles.signUpLink}>Sign up</ThemedText>
                  </TouchableOpacity>
               </View>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Pure white background as per design
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
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  topNav: {
    alignItems: 'flex-start',
    marginTop: 10,
    marginBottom: 20,
  },

  /* Header */
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBadge: {
    marginBottom: 24,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  logoGradient: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: 28,
    fontFamily: Fonts.rounded,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '400',
  },

  /* Form */
  formContainer: {
    width: '100%',
  },
  
  /* Input Styles - Matches the "Filled" look */
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 2,
    marginLeft: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
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
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  checkboxChecked: {
    backgroundColor: '#4ECDC4', // Theme color check
    borderColor: '#4ECDC4',
  },
  optionText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#111827', // Darker text for link as per design
    fontWeight: '700',
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
    color: '#EF4444',
    fontSize: 14,
    flex: 1,
  },

  /* Actions */
  actionsContainer: {
    gap: 16,
  },
  primaryButton: {
    borderRadius: 30, // Fully rounded pill shape
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
    shadowOpacity: 0,
    elevation: 0,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    borderRadius: 30, // Pill shape
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  googleButtonText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
  },

  /* Footer */
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 40,
  },
  footerText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  signUpLink: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },
});