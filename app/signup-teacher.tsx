import { StyleSheet, View, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, Modal, Image } from 'react-native';
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
import { CountryDropdown, CityDropdown, GenderDropdown, LanguagesDropdown } from '@/components/dropdowns';

const logo = require('@/assets/images/logo.png');

// --- Subjects Dropdown Component ---
const SUBJECTS_OPTIONS = [
  { label: 'Arabic', value: 'Arabic' },
  { label: 'Quran', value: 'Quran' },
  { label: 'Both (Arabic & Quran)', value: 'Both' },
];

interface SubjectsDropdownProps {
  value: string;
  onSelect: (subject: string) => void;
  label: string;
  required?: boolean;
}

function SubjectsDropdown({ value, onSelect, label, required }: SubjectsDropdownProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const getDisplayText = () => {
    if (value) {
      const option = SUBJECTS_OPTIONS.find(opt => opt.value === value);
      return option ? option.label : value;
    }
    return ''; // Empty string so placeholder logic works if needed, or layout remains consistent
  };

  return (
    <>
      <TouchableOpacity
        style={styles.filledInputContainer}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <ThemedText style={styles.tinyLabel}>
          {label} {required && <ThemedText style={styles.required}>*</ThemedText>}
        </ThemedText>
        <View style={styles.dropdownTriggerRow}>
          <ThemedText style={[styles.mainInput, !value && { color: '#9CA3AF' }]}>
            {getDisplayText() || 'Select Subject'}
          </ThemedText>
          <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
        </View>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <ThemedText style={styles.modalTitle}>Select Subject</ThemedText>
            
            {SUBJECTS_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionItem,
                  value === option.value && styles.optionSelected
                ]}
                onPress={() => {
                  onSelect(option.value);
                  setModalVisible(false);
                }}
              >
                <ThemedText style={[
                  styles.optionText,
                  value === option.value && styles.optionTextSelected
                ]}>
                  {option.label}
                </ThemedText>
                {value === option.value && (
                  <Ionicons name="checkmark-circle" size={24} color="#FF6B6B" />
                )}
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <ThemedText style={styles.closeButtonText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// --- Main Screen ---

export default function SignUpTeacherScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const { user } = useAuth();
  const [serverProgress, setServerProgress] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    bio: '',
    subjects: '',
    hourlyRate: '',
    gender: '',
    languages: '',
    country: '',
    city: '',
  });
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

    if (!formData.bio.trim()) {
      errors.bio = 'Bio is required';
    } else if (formData.bio.trim().length < 20) {
      errors.bio = 'Bio must be at least 20 characters';
    }

    if (!formData.subjects) {
      errors.subjects = 'Please select a subject';
    }

    if (!formData.hourlyRate) {
      errors.hourlyRate = 'Hourly rate is required';
    } else if (isNaN(Number(formData.hourlyRate)) || Number(formData.hourlyRate) <= 0) {
      errors.hourlyRate = 'Please enter a valid rate';
    }

    if (!formData.gender) {
      errors.gender = 'Please select your gender';
    }

    if (!formData.languages) {
      errors.languages = 'Please select at least one language';
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
    const fetchStatus = async () => {
      if (!user || user.role !== 'teacher') return;
      try {
        const res = await fetch(api.teacherProfile(user.id));
        if (!res.ok) return;
        const data = await res.json();
        const status = data.profile?.verification_status || 'pending';
        const percent = status === 'verified' ? 100 : (status === 'pending' ? 50 : 0);
        if (mounted) setServerProgress(percent);
      } catch (e) {
        // ignore
      }
    };
    fetchStatus();
    const t = setInterval(fetchStatus, 15000);
    return () => { mounted = false; clearInterval(t); };
  }, [user]);

  const handleSignUp = async () => {
    // Validate form first
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      
      // Convert subjects: "Both" becomes ['Arabic', 'Quran'], otherwise single subject array
      let subjectsArray: string[];
      if (formData.subjects === 'Both') {
        subjectsArray = ['Arabic', 'Quran'];
      } else {
        subjectsArray = [formData.subjects];
      }

      const response = await fetch(api.signupTeacher(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          phoneNumber: formData.phoneNumber,
          bio: formData.bio,
          subjects: subjectsArray,
          hourlyRate: formData.hourlyRate,
          gender: formData.gender,
          languages: formData.languages
            .split(',')
            .map((lang) => lang.trim())
            .filter(Boolean),
          timezone: deviceTz,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Signup error:', response.status, data);
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

      if (data.user && data.user.id) {
        await AsyncStorage.setItem('userId', data.user.id);
      }

      const successMessage = 'Congratulations! Your teacher account has been created successfully. Welcome to IlmConnect.\n\n— IlmConnect Team';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`🎉 Account Created\n\n${successMessage}`);
        router.replace('/login' as any);
      } else {
        Alert.alert(
          '🎉 Account Created',
          successMessage,
          [
            {
              text: 'Go to Login',
              onPress: () => router.replace('/login' as any),
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

  const renderInput = (
    key: keyof typeof formData,
    label: string,
    placeholder: string,
    options?: {
      required?: boolean;
      keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'decimal-pad';
      autoCapitalize?: 'none' | 'sentences';
      secureTextEntry?: boolean;
      multiline?: boolean;
    }
  ) => (
    <View>
      <View style={[
        styles.filledInputContainer,
        focusedInput === key && styles.filledInputFocused,
        options?.multiline && styles.multilineContainer,
        formErrors[key] && styles.inputError
      ]}>
        <ThemedText style={styles.tinyLabel}>
          {label} {options?.required && <ThemedText style={styles.required}>*</ThemedText>}
        </ThemedText>
        <View style={[styles.inputContentRow, options?.multiline && { alignItems: 'flex-start' }]}>
          <TextInput
            style={[styles.mainInput, options?.multiline && styles.multilineInput]}
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
            multiline={options?.multiline}
            numberOfLines={options?.multiline ? 4 : 1}
            textAlignVertical={options?.multiline ? 'top' : 'center'}
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
              <ThemedText style={styles.welcomeText}>Teacher Sign Up</ThemedText>
              <ThemedText style={styles.subtitleText}>Share your expertise with the world</ThemedText>
            </View>

            {/* Progress Bar (Minimalist) */}
            <View style={styles.progressSection}>
              {(() => {
                const total = 8;
                let completed = 0;
                if (formData.fullName?.trim().length > 0) completed++;
                if (formData.email?.includes('@')) completed++;
                if (formData.password?.length >= 6) completed++;
                if (formData.phoneNumber && isPhoneValid) completed++;
                if (formData.bio?.trim().length > 10) completed++;
                if (formData.subjects?.trim().length > 0) completed++;
                if (formData.hourlyRate && !isNaN(Number(formData.hourlyRate))) completed++;
                if (formData.country && formData.city) completed++;
                
                let percent = Math.round((completed / total) * 100);
                if (serverProgress !== null) percent = serverProgress;

                return (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarBg}>
                       <LinearGradient
                          colors={['#FF6B6B', '#EE5A24']}
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
              
              {/* Section 1: Basic Info */}
              {renderInput('fullName', 'Full Name', 'e.g. Sarah Ahmed', { required: true })}
              <View style={styles.spacer} />
              {renderInput('email', 'Email', 'sarah@example.com', { required: true, keyboardType: 'email-address', autoCapitalize: 'none' })}
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
              
              <View style={[styles.filledInputContainer, formErrors.phoneNumber && styles.inputError]}>
                 <ThemedText style={styles.tinyLabel}>Phone Number <ThemedText style={styles.required}>*</ThemedText></ThemedText>
                 <View style={styles.phoneInputWrapper}>
                   <PhoneInput
                      value={formData.phoneNumber}
                      onChangePhone={handlePhoneChange}
                      label=""
                      placeholder="300 1234567"
                      accentColor="#FF6B6B"
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

              {/* Section 2: Profile */}
              {renderInput('bio', 'Bio', 'Describe your experience (min 20 chars)...', { required: true, multiline: true })}
              <View style={styles.spacer} />
              
              <View style={styles.row}>
                 <View style={styles.halfInput}>
                    {/* Replaced renderInput for subjects with Dropdown */}
                    <SubjectsDropdown 
                      value={formData.subjects}
                      onSelect={(val) => {
                        setFormData({...formData, subjects: val});
                        clearError('subjects');
                      }}
                      label="Subject"
                      required
                    />
                    {formErrors.subjects && (
                      <ThemedText style={styles.errorText}>{formErrors.subjects}</ThemedText>
                    )}
                 </View>
                 <View style={styles.halfInput}>
                    {renderInput('hourlyRate', 'Rate ($/hr)', '20', { required: true, keyboardType: 'decimal-pad' })}
                 </View>
              </View>
              <View style={styles.spacer} />

              {/* Section 3: Details */}
              <View style={styles.row}>
                <View style={styles.halfInput}>
                    <View style={[styles.filledInputContainer, formErrors.gender && styles.inputError]}>
                        <ThemedText style={styles.tinyLabel}>Gender <ThemedText style={styles.required}>*</ThemedText></ThemedText>
                        <GenderDropdown
                            value={formData.gender}
                            onSelect={(gender) => {
                              setFormData({ ...formData, gender });
                              clearError('gender');
                            }}
                            label=""
                        />
                    </View>
                    {formErrors.gender && (
                      <ThemedText style={styles.errorText}>{formErrors.gender}</ThemedText>
                    )}
                </View>
                <View style={styles.halfInput}>
                    <View style={[styles.filledInputContainer, formErrors.languages && styles.inputError]}>
                        <ThemedText style={styles.tinyLabel}>Languages <ThemedText style={styles.required}>*</ThemedText></ThemedText>
                        <LanguagesDropdown
                            value={formData.languages}
                            onSelect={(languages) => {
                              setFormData({ ...formData, languages });
                              clearError('languages');
                            }}
                            label=""
                        />
                    </View>
                    {formErrors.languages && (
                      <ThemedText style={styles.errorText}>{formErrors.languages}</ThemedText>
                    )}
                </View>
              </View>
              <View style={styles.spacer} />

              <View style={styles.row}>
                <View style={styles.halfInput}>
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
                  colors={loading ? ['#E5E7EB', '#E5E7EB'] : ['#FF6B6B', '#EE5A24']}
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
    shadowColor: '#FF6B6B',
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
  
  /* Filled Input Styles (Shared by TextInput and Dropdown Trigger) */
  filledInputContainer: {
    backgroundColor: '#F5F7FA', // Light gray background
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filledInputFocused: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FF6B6B', // Teacher Theme Color (Coral)
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  multilineContainer: {
    paddingBottom: 16,
  },
  tinyLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
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
    paddingVertical: 2,
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  iconButton: {
    padding: 4,
  },

  /* Custom overrides */
  phoneInputWrapper: {
    marginTop: -4,
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

  /* Dropdown Styles */
  dropdownTriggerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  optionSelected: {
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 12,
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  optionText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#FF6B6B',
    fontWeight: '700',
  },
  closeButton: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 12,
  },
  closeButtonText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 16,
  },

  /* Button */
  signUpButton: {
    marginTop: 32,
    borderRadius: 30, // Pill shape
    shadowColor: '#FF6B6B',
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

  /* Footer */
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