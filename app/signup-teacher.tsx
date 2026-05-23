import { StyleSheet, View, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { PhoneInput } from '@/components/phone-input';
import { LingoButton } from '@/components/ui/lingo-mobile';
import { Fonts, LingoTheme } from '@/constants/theme';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/lib/config';
import { CountryDropdown, CityDropdown, GenderDropdown, LanguagesDropdown } from '@/components/dropdowns';
import { useSafePadding } from '@/hooks/use-safe-padding';

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
    return '';
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
                  <Ionicons name="checkmark-circle" size={24} color={LingoTheme.colors.primaryDark || '#0D9488'} />
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
  const { topPadding, bottomPadding } = useSafePadding();
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const { user } = useAuth();
  const [serverProgress, setServerProgress] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

  // --------------------------------------------------------
  // BACKEND & VALIDATION LOGIC (Unchanged)
  // --------------------------------------------------------
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
      } catch {
        // ignore
      }
    };
    fetchStatus();
    const t = setInterval(fetchStatus, 15000);
    return () => { mounted = false; clearInterval(t); };
  }, [user]);

  const handleSignUp = async () => {
    if (!validateForm()) return;
    setLoading(true);

    try {
      const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      
      let subjectsArray: string[];
      if (formData.subjects === 'Both') {
        subjectsArray = ['Arabic', 'Quran'];
      } else {
        subjectsArray = [formData.subjects];
      }

      const response = await fetch(api.signupTeacher(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      const successMessage = 'Congratulations! Your teacher account has been created successfully. Welcome to IlmConnect.\n\n- IlmConnect Team';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`Account Created\n\n${successMessage}`);
        router.replace('/login' as any);
      } else {
        Alert.alert('Account Created', successMessage, [{ text: 'Go to Login', onPress: () => router.replace('/login' as any) }]);
      }
    } catch (error: any) {
      setFormErrors({ general: error.message || 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------
  // UI PRESENTATION
  // --------------------------------------------------------
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
      icon?: keyof typeof Ionicons.glyphMap;
    }
  ) => (
    <View style={styles.inputWrapper}>
      <View style={[
        styles.filledInputContainer,
        options?.multiline && styles.multilineContainer,
        formErrors[key] && styles.inputError
      ]}>
        <ThemedText style={styles.tinyLabel}>
          {label} {options?.required && <ThemedText style={styles.required}>*</ThemedText>}
        </ThemedText>
        <View style={[styles.inputContentRow, options?.multiline && { alignItems: 'flex-start' }]}>
          {options?.icon && !options?.multiline && (
            <Ionicons name={options.icon} size={18} color="#94A3B8" style={styles.inputIcon} />
          )}
          <TextInput
            style={[styles.mainInput, options?.multiline && styles.multilineInput]}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            value={formData[key]}
            onChangeText={(text) => {
              setFormData((prev) => ({ ...prev, [key]: text }));
              clearError(key);
            }}
            autoCapitalize={options?.autoCapitalize}
            keyboardType={options?.keyboardType}
            secureTextEntry={options?.secureTextEntry && !showPassword}
            multiline={options?.multiline}
            numberOfLines={options?.multiline ? 4 : 1}
            textAlignVertical={options?.multiline ? 'top' : 'center'}
          />
          {options?.secureTextEntry && (
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.iconButton}>
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {formErrors[key] && <ThemedText style={styles.errorText}>{formErrors[key]}</ThemedText>}
    </View>
  );

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
            <ThemedText style={styles.signupTitle}>Teacher Sign-up</ThemedText>
            <ThemedText style={styles.signupSubtitle}>
              Create your profile, set your details, and get ready for verification.
            </ThemedText>
          </View>
        </View>

        {/* --- BOTTOM SHEET CONTENT --- */}
        <View style={styles.bottomSheetContainer}>
          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 32 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
          >
            <View style={styles.formContent}>

              {/* Progress Bar */}
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
                            colors={[LingoTheme.colors.primaryDark || '#0D9488', LingoTheme.colors.primary || '#2DD4BF']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.progressBarFill, { width: `${percent}%` }]}
                         />
                      </View>
                      <ThemedText style={styles.progressText}>{percent}% Completed</ThemedText>
                    </View>
                  );
                })()}
              </View>

              {/* General Error */}
              {formErrors.general && (
                <View style={styles.generalErrorContainer}>
                  <Ionicons name="alert-circle" size={20} color="#EF4444" />
                  <ThemedText style={styles.generalErrorText}>{formErrors.general}</ThemedText>
                </View>
              )}

              {/* --- Section 1: Basic Info --- */}
              {renderInput('fullName', 'Full Name', 'e.g. Sarah Ahmed', { required: true, icon: 'person-outline' })}
              {renderInput('email', 'Email Address', 'sarah@example.com', { required: true, keyboardType: 'email-address', autoCapitalize: 'none', icon: 'mail-outline' })}
              {renderInput('password', 'Password', '••••••••', { required: true, secureTextEntry: true, icon: 'lock-closed-outline' })}
              
              {/* Confirm Password */}
              <View style={styles.inputWrapper}>
                <View style={[styles.filledInputContainer, formErrors.confirmPassword && styles.inputError]}>
                  <ThemedText style={styles.tinyLabel}>
                    Confirm Password <ThemedText style={styles.required}>*</ThemedText>
                  </ThemedText>
                  <View style={styles.inputContentRow}>
                    <Ionicons name="shield-checkmark-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.mainInput}
                      placeholder="••••••••"
                      placeholderTextColor="#9CA3AF"
                      value={formData.confirmPassword}
                      onChangeText={(text) => {
                        setFormData((prev) => ({ ...prev, confirmPassword: text }));
                        clearError('confirmPassword');
                      }}
                      secureTextEntry={!showConfirmPassword}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.iconButton}>
                      <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                </View>
                {formErrors.confirmPassword && <ThemedText style={styles.errorText}>{formErrors.confirmPassword}</ThemedText>}
              </View>
              
              {/* Phone Number */}
              <View style={styles.inputWrapper}>
                 <View style={[styles.filledInputContainer, formErrors.phoneNumber && styles.inputError]}>
                   <ThemedText style={styles.tinyLabel}>Phone Number <ThemedText style={styles.required}>*</ThemedText></ThemedText>
                   <View style={styles.phoneInputWrapper}>
                     <PhoneInput
                        value={formData.phoneNumber}
                        onChangePhone={handlePhoneChange}
                        label=""
                        placeholder="300 1234567"
                        accentColor={LingoTheme.colors.primaryDark || "#0D9488"}
                        error={phoneError}
                        defaultCountryCode="PK"
                     />
                   </View>
                 </View>
                 {formErrors.phoneNumber && <ThemedText style={styles.errorText}>{formErrors.phoneNumber}</ThemedText>}
              </View>

              {/* --- Section 2: Profile --- */}
              {renderInput('bio', 'Bio', 'Describe your experience and teaching style (min 20 chars)...', { required: true, multiline: true })}
              
              <View style={styles.row}>
                 <View style={styles.halfInput}>
                    <SubjectsDropdown 
                      value={formData.subjects}
                      onSelect={(val) => {
                        setFormData({...formData, subjects: val});
                        clearError('subjects');
                      }}
                      label="Subject"
                      required
                    />
                    {formErrors.subjects && <ThemedText style={styles.errorText}>{formErrors.subjects}</ThemedText>}
                 </View>
                 <View style={styles.halfInput}>
                    {renderInput('hourlyRate', 'Rate ($/hr)', '20', { required: true, keyboardType: 'decimal-pad', icon: 'cash-outline' })}
                 </View>
              </View>

              {/* --- Section 3: Details --- */}
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
                    {formErrors.gender && <ThemedText style={styles.errorText}>{formErrors.gender}</ThemedText>}
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
                    {formErrors.languages && <ThemedText style={styles.errorText}>{formErrors.languages}</ThemedText>}
                </View>
              </View>

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
                    {formErrors.country && <ThemedText style={styles.errorText}>{formErrors.country}</ThemedText>}
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
                    {formErrors.city && <ThemedText style={styles.errorText}>{formErrors.city}</ThemedText>}
                </View>
              </View>

              {/* Submit Button */}
              <View style={styles.submitWrap}>
                <LingoButton
                  label={loading ? 'Creating Account...' : 'Create Account'}
                  icon="arrow-forward"
                  onPress={handleSignUp}
                  loading={loading}
                />
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
  signupTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontFamily: Fonts.rounded,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  signupSubtitle: {
    fontSize: 15,
    lineHeight: 22,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 32,
  },
  formContent: {
    paddingHorizontal: 24,
  },

  // --- Progress Bar ---
  progressSection: {
    marginBottom: 28,
  },
  progressContainer: {
    gap: 10,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressText: {
    fontSize: 13,
    color: LingoTheme.colors.primaryDark || '#0D9488',
    textAlign: 'right',
    fontWeight: '800',
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
  multilineContainer: {
    paddingBottom: 16,
  },
  tinyLabel: {
    fontSize: 11,
    color: LingoTheme.colors.muted,
    fontWeight: '800',
    marginBottom: 4,
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
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  iconButton: {
    padding: 4,
    marginLeft: 8,
  },

  // --- Phone Input Override ---
  phoneInputWrapper: {
    marginTop: -2,
  },

  // --- Layout & Buttons ---
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  halfInput: {
    flex: 1,
  },
  submitWrap: {
    marginTop: 16,
  },

  // --- Dropdown Styles ---
  dropdownTriggerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 2 : 0,
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
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: Fonts.rounded,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    marginBottom: 20,
    textAlign: 'center',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: LingoTheme.colors.border,
  },
  optionSelected: {
    backgroundColor: LingoTheme.colors.softPrimary || '#E6F9F6',
    paddingHorizontal: 16,
    borderRadius: 12,
    borderBottomWidth: 0,
  },
  optionText: {
    fontSize: 16,
    color: LingoTheme.colors.ink,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: LingoTheme.colors.primaryDark || '#0D9488',
    fontWeight: '800',
  },
  closeButton: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
  },
  closeButtonText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 16,
  },

  // --- Footer ---
  footer: {
    marginTop: 32,
    paddingHorizontal: 16,
  },
  termsText: {
    fontSize: 13,
    color: LingoTheme.colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  termsLink: {
    color: LingoTheme.colors.primaryDark || '#0D9488',
    fontWeight: '800',
  },

  // --- Error Styles ---
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    marginLeft: 6,
  },
  generalErrorContainer: {
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
  generalErrorText: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});