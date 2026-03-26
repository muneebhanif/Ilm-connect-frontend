import { StyleSheet, View, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackButton } from '@/components/back-button';
import { PhoneInput } from '@/components/phone-input';
import { Fonts } from '@/constants/theme';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/lib/config';
import { CountryDropdown, CityDropdown } from '@/components/dropdowns';

const logo = require('@/assets/images/logo.png');

export default function SignUpParentScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [serverProgress, setServerProgress] = useState<number | null>(null);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    location: '',
    country: '',
    city: '',
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

  // Validate form and return true if valid
  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {};

    if (!formData.fullName.trim()) {
      errors.fullName = 'Full name is required';
    } else if (!/[a-zA-Z]/.test(formData.fullName)) {
      errors.fullName = 'Name must contain letters';
    } else if (/^[0-9]+$/.test(formData.fullName.trim())) {
      errors.fullName = 'Name cannot be only numbers';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.phoneNumber) {
      errors.phoneNumber = 'Phone number is required';
    } else if (!isPhoneValid) {
      errors.phoneNumber = 'Please enter a valid phone number';
    }

    if (!formData.country) {
      errors.country = 'Please select your country';
    }

    if (!formData.city) {
      errors.city = 'Please select your city';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Clear error when user starts typing
  const clearError = (field: string) => {
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handlePhoneChange = (fullNumber: string, isValid: boolean) => {
    setFormData({ ...formData, phoneNumber: fullNumber });
    setIsPhoneValid(isValid);
    clearError('phoneNumber');
    if (fullNumber && !isValid) {
      setPhoneError('Please enter a valid phone number (7-15 digits)');
    } else {
      setPhoneError(undefined);
    }
  };

  useEffect(() => {
    let mounted = true;
    const fetchProgress = async () => {
      if (!user) return;
      try {
        const token = await AsyncStorage.getItem('access_token');
        if (!token) return;

        const [profileRes, childrenRes] = await Promise.all([
          fetch(api.parentProfile(user.id), { headers: { Authorization: `Bearer ${token}` } }),
          fetch(api.parentChildren(user.id), { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const profileData = profileRes.ok ? await profileRes.json() : null;
        const childrenData = childrenRes.ok ? await childrenRes.json() : null;

        const profile = profileData?.profile || {};
        const children = childrenData?.children || [];

        const profileCompleted = !!(profile.full_name && profile.email);
        const percent = children.length > 0 ? 100 : (profileCompleted ? 50 : 0);
        if (mounted) setServerProgress(percent);
      } catch (e) {
        // ignore network errors
      }
    };
    fetchProgress();
    return () => { mounted = false; };
  }, [user]);

  const handleSignUp = async () => {
    // Validate form first
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const normalizedLocation = [formData.city?.trim(), formData.country?.trim()]
        .filter(Boolean)
        .join(', ');

      const response = await fetch(api.signupParent(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
          fullName: formData.fullName.trim(),
          phoneNumber: formData.phoneNumber,
          location: normalizedLocation || formData.location?.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Show API error inline if it's a field-specific error
        if (data.error?.toLowerCase().includes('email')) {
          setFormErrors({ email: data.error });
        } else if (data.error?.toLowerCase().includes('password')) {
          setFormErrors({ password: data.error });
        } else {
          setFormErrors({ general: data.error || 'Signup failed' });
        }
        return;
      }

      if (data.user?.id) {
        await AsyncStorage.setItem('userId', data.user.id);
      }

      const successMessage = 'Congratulations! Your parent account has been created successfully. Welcome to IlmConnect.\n\n— IlmConnect Team';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`🎉 Account Created\n\n${successMessage}`);
        router.replace('/login');
      } else {
        Alert.alert(
          '🎉 Account Created',
          successMessage,
          [
            {
              text: 'Go to Login',
              onPress: () => router.replace('/login'),
            },
          ]
        );
      }
    } catch (error: any) {
      setFormErrors({ general: error.message || 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  };

  // Custom Input Component matching the "Native Mobile" aesthetic
  const renderInput = (
    key: keyof typeof formData,
    label: string,
    placeholder: string,
    options?: {
      required?: boolean;
      keyboardType?: 'default' | 'email-address' | 'phone-pad';
      autoCapitalize?: 'none' | 'sentences';
      secureTextEntry?: boolean;
    }
  ) => (
    <View>
      <View style={[
        styles.filledInputContainer,
        focusedInput === key && styles.filledInputFocused,
        formErrors[key] && styles.inputError
      ]}>
        <ThemedText style={styles.tinyLabel}>
          {label} {options?.required && <ThemedText style={styles.required}>*</ThemedText>}
        </ThemedText>
        <View style={styles.inputContentRow}>
          <TextInput
            style={styles.mainInput}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            value={formData[key]}
            onChangeText={(text) => {
              setFormData((prev) => ({ ...prev, [key]: text }));
              clearError(key);
            }}
            onFocus={() => setFocusedInput(key)}
            onBlur={() => setFocusedInput(null)}
            autoCapitalize={options?.autoCapitalize}
            keyboardType={options?.keyboardType}
            secureTextEntry={options?.secureTextEntry && !showPassword}
          />
          {options?.secureTextEntry && (
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={styles.iconButton}
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
      {formErrors[key] && (
        <ThemedText style={styles.errorText}>{formErrors[key]}</ThemedText>
      )}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.content}>
            <View style={styles.topNav}>
              <BackButton />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.logoBadge}>
                <Image source={logo} style={styles.logoImage} resizeMode="contain" />
              </View>
              <ThemedText style={styles.welcomeText}>Create Account</ThemedText>
              <ThemedText style={styles.subtitleText}>Join IlmConnect to find trusted teachers</ThemedText>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressSection}>
              {(() => {
                let percent = 0;
                if (user && user.role === 'parent' && serverProgress !== null) {
                  percent = serverProgress;
                } else {
                  const total = 6;
                  let completed = 0;
                  if (formData.fullName?.trim().length > 0) completed++;
                  if (formData.email?.includes('@')) completed++;
                  if (formData.password?.length >= 6) completed++;
                  if (formData.phoneNumber && isPhoneValid) completed++;
                  if (formData.country) completed++;
                  if (formData.city) completed++;
                  percent = Math.round((completed / total) * 100);
                }
                return (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarBg}>
                       <LinearGradient
                          colors={['#4ECDC4', '#2BCBBA']}
                          style={[styles.progressBarFill, { width: `${percent}%` }]}
                       />
                    </View>
                    <ThemedText style={styles.progressText}>{percent}% Completed</ThemedText>
                  </View>
                );
              })()}
            </View>

            {/* Form Fields */}
            <View style={styles.formContainer}>
              {/* General Error */}
              {formErrors.general && (
                <View style={styles.generalErrorContainer}>
                  <Ionicons name="alert-circle" size={18} color="#fff" />
                  <ThemedText style={styles.generalErrorText}>{formErrors.general}</ThemedText>
                </View>
              )}
              
              {renderInput('fullName', 'Full Name', 'e.g. Alina Ahmed', { required: true })}
              <View style={styles.spacer} />
              
              {renderInput('email', 'Email', 'alina@example.com', { required: true, keyboardType: 'email-address', autoCapitalize: 'none' })}
              <View style={styles.spacer} />
              
              {renderInput('password', 'Password', '••••••••', { required: true, secureTextEntry: true })}
              <View style={styles.spacer} />

              {/* Confirm Password */}
              <View>
                <View style={[
                  styles.filledInputContainer,
                  focusedInput === 'confirmPassword' && styles.filledInputFocused,
                  formErrors.confirmPassword && styles.inputError
                ]}>
                  <ThemedText style={styles.tinyLabel}>
                    Confirm Password <ThemedText style={styles.required}>*</ThemedText>
                  </ThemedText>
                  <View style={styles.inputContentRow}>
                    <TextInput
                      style={styles.mainInput}
                      placeholder="••••••••"
                      placeholderTextColor="#9CA3AF"
                      value={formData.confirmPassword}
                      onChangeText={(text) => {
                        setFormData((prev) => ({ ...prev, confirmPassword: text }));
                        clearError('confirmPassword');
                      }}
                      onFocus={() => setFocusedInput('confirmPassword')}
                      onBlur={() => setFocusedInput(null)}
                      secureTextEntry={!showConfirmPassword}
                    />
                    <TouchableOpacity 
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.iconButton}
                    >
                      <Ionicons 
                        name={showConfirmPassword ? "eye-off" : "eye"} 
                        size={20} 
                        color="#9CA3AF" 
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                {formErrors.confirmPassword && (
                  <ThemedText style={styles.errorText}>{formErrors.confirmPassword}</ThemedText>
                )}
              </View>
              <View style={styles.spacer} />

              {/* Phone Input - Wrapped to match look */}
              <View style={[styles.filledInputContainer, formErrors.phoneNumber && styles.inputError]}>
                 <ThemedText style={styles.tinyLabel}>Phone Number <ThemedText style={styles.required}>*</ThemedText></ThemedText>
                 <View style={styles.phoneInputWrapper}>
                   <PhoneInput
                      value={formData.phoneNumber}
                      onChangePhone={handlePhoneChange}
                      label=""
                      placeholder="300 1234567"
                      accentColor="#4ECDC4"
                      error={phoneError}
                      defaultCountryCode="PK"
                      containerStyle={styles.phoneInputOverride}
                   />
                 </View>
              </View>
              {formErrors.phoneNumber && (
                <ThemedText style={styles.errorText}>{formErrors.phoneNumber}</ThemedText>
              )}
              <View style={styles.spacer} />

              <View style={styles.row}>
                <View style={styles.halfInput}>
                    {/* Country Wrapper */}
                    <View style={[styles.filledInputContainer, formErrors.country && styles.inputError]}>
                        <ThemedText style={styles.tinyLabel}>Country <ThemedText style={styles.required}>*</ThemedText></ThemedText>
                        <CountryDropdown
                            value={formData.country}
                            onSelect={(country) => {
                              setFormData({ ...formData, country, city: '' });
                              clearError('country');
                            }}
                            label=""
                            required
                        />
                    </View>
                    {formErrors.country && (
                      <ThemedText style={styles.errorText}>{formErrors.country}</ThemedText>
                    )}
                </View>
                <View style={styles.halfInput}>
                    {/* City Wrapper */}
                    <View style={[styles.filledInputContainer, formErrors.city && styles.inputError]}>
                        <ThemedText style={styles.tinyLabel}>City <ThemedText style={styles.required}>*</ThemedText></ThemedText>
                        <CityDropdown
                            country={formData.country}
                            value={formData.city}
                            onSelect={(city) => {
                              setFormData({ ...formData, city });
                              clearError('city');
                            }}
                            label=""
                            required
                        />
                    </View>
                    {formErrors.city && (
                      <ThemedText style={styles.errorText}>{formErrors.city}</ThemedText>
                    )}
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity 
                style={[styles.signUpButton, loading && styles.buttonDisabled]}
                onPress={handleSignUp}
                disabled={loading}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={loading ? ['#E5E7EB', '#E5E7EB'] : ['#4ECDC4', '#3DBDB4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.signUpButtonGradient}
                >
                  <ThemedText style={[styles.signUpButtonText, loading && { color: '#9CA3AF' }]}>
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </ThemedText>
                  {!loading && <Ionicons name="arrow-forward" size={18} color="#fff" />}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <ThemedText style={styles.termsText}>
                By creating an account, you agree to our{' '}
                <ThemedText style={styles.termsLink}>Terms</ThemedText>
                {' '}and{' '}
                <ThemedText style={styles.termsLink}>Privacy Policy</ThemedText>
              </ThemedText>
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
    backgroundColor: '#FFFFFF',
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
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  topNav: {
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: 10,
  },
  
  /* Header */
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBadge: {
    marginBottom: 16,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  logoImage: {
    width: 70,
    height: 70,
  },
  logoGradient: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: 26,
    fontFamily: Fonts.rounded,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subtitleText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
  },

  /* Progress Bar */
  progressSection: {
    marginBottom: 24,
  },
  progressContainer: {
    gap: 8,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
    fontWeight: '600',
  },

  /* Form */
  formContainer: {
    width: '100%',
  },
  spacer: {
    height: 16,
  },
  
  /* NEW Filled Input Styles - Matches Reference Image */
  filledInputContainer: {
    backgroundColor: '#F5F7FA', // Light gray background
    borderRadius: 12,           // Rounded corners
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent', // No border by default
  },
  filledInputFocused: {
    backgroundColor: '#FFFFFF',
    borderColor: '#4ECDC4', // Theme color border on focus
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tinyLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase', // Optional: makes label cleaner
    letterSpacing: 0.5,
  },
  required: {
    color: '#EF4444',
  },
  inputContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
    paddingVertical: 2, // Tight padding to fit
  },
  iconButton: {
    padding: 4,
  },

  /* Custom component overrides */
  phoneInputWrapper: {
    marginTop: -4, // Adjust alignment for phone input
  },
  phoneInputOverride: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    marginBottom: 0,
    height: 28,
  },

  /* Layout */
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },

  /* Button */
  signUpButton: {
    marginTop: 32,
    borderRadius: 30, // Pill shape
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  signUpButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
    borderRadius: 30,
  },
  signUpButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
    shadowOpacity: 0,
    elevation: 0,
  },

  /* Footer Terms */
  footer: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  termsText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  termsLink: {
    color: '#111827',
    fontWeight: '600',
  },

  /* Error Styles */
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  generalErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  generalErrorText: {
    color: '#B91C1C',
    fontSize: 14,
    flex: 1,
  },
});