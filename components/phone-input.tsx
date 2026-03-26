import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';

// Comprehensive list of countries with calling codes and flags
export const COUNTRIES = [
  { code: 'PK', name: 'Pakistan', callingCode: '+92', flag: '🇵🇰' },
  { code: 'US', name: 'United States', callingCode: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', callingCode: '+44', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', callingCode: '+1', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', callingCode: '+61', flag: '🇦🇺' },
  { code: 'IN', name: 'India', callingCode: '+91', flag: '🇮🇳' },
  { code: 'AE', name: 'United Arab Emirates', callingCode: '+971', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', callingCode: '+966', flag: '🇸🇦' },
  { code: 'QA', name: 'Qatar', callingCode: '+974', flag: '🇶🇦' },
  { code: 'KW', name: 'Kuwait', callingCode: '+965', flag: '🇰🇼' },
  { code: 'BH', name: 'Bahrain', callingCode: '+973', flag: '🇧🇭' },
  { code: 'OM', name: 'Oman', callingCode: '+968', flag: '🇴🇲' },
  { code: 'EG', name: 'Egypt', callingCode: '+20', flag: '🇪🇬' },
  { code: 'JO', name: 'Jordan', callingCode: '+962', flag: '🇯🇴' },
  { code: 'LB', name: 'Lebanon', callingCode: '+961', flag: '🇱🇧' },
  { code: 'TR', name: 'Turkey', callingCode: '+90', flag: '🇹🇷' },
  { code: 'MY', name: 'Malaysia', callingCode: '+60', flag: '🇲🇾' },
  { code: 'ID', name: 'Indonesia', callingCode: '+62', flag: '🇮🇩' },
  { code: 'SG', name: 'Singapore', callingCode: '+65', flag: '🇸🇬' },
  { code: 'BD', name: 'Bangladesh', callingCode: '+880', flag: '🇧🇩' },
  { code: 'DE', name: 'Germany', callingCode: '+49', flag: '🇩🇪' },
  { code: 'FR', name: 'France', callingCode: '+33', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', callingCode: '+39', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', callingCode: '+34', flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands', callingCode: '+31', flag: '🇳🇱' },
  { code: 'BE', name: 'Belgium', callingCode: '+32', flag: '🇧🇪' },
  { code: 'SE', name: 'Sweden', callingCode: '+46', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', callingCode: '+47', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', callingCode: '+45', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland', callingCode: '+358', flag: '🇫🇮' },
  { code: 'CH', name: 'Switzerland', callingCode: '+41', flag: '🇨🇭' },
  { code: 'AT', name: 'Austria', callingCode: '+43', flag: '🇦🇹' },
  { code: 'IE', name: 'Ireland', callingCode: '+353', flag: '🇮🇪' },
  { code: 'NZ', name: 'New Zealand', callingCode: '+64', flag: '🇳🇿' },
  { code: 'ZA', name: 'South Africa', callingCode: '+27', flag: '🇿🇦' },
  { code: 'NG', name: 'Nigeria', callingCode: '+234', flag: '🇳🇬' },
  { code: 'KE', name: 'Kenya', callingCode: '+254', flag: '🇰🇪' },
  { code: 'GH', name: 'Ghana', callingCode: '+233', flag: '🇬🇭' },
  { code: 'MA', name: 'Morocco', callingCode: '+212', flag: '🇲🇦' },
  { code: 'TN', name: 'Tunisia', callingCode: '+216', flag: '🇹🇳' },
  { code: 'DZ', name: 'Algeria', callingCode: '+213', flag: '🇩🇿' },
  { code: 'IQ', name: 'Iraq', callingCode: '+964', flag: '🇮🇶' },
  { code: 'SY', name: 'Syria', callingCode: '+963', flag: '🇸🇾' },
  { code: 'PS', name: 'Palestine', callingCode: '+970', flag: '🇵🇸' },
  { code: 'AF', name: 'Afghanistan', callingCode: '+93', flag: '🇦🇫' },
  { code: 'IR', name: 'Iran', callingCode: '+98', flag: '🇮🇷' },
  { code: 'JP', name: 'Japan', callingCode: '+81', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', callingCode: '+82', flag: '🇰🇷' },
  { code: 'CN', name: 'China', callingCode: '+86', flag: '🇨🇳' },
  { code: 'HK', name: 'Hong Kong', callingCode: '+852', flag: '🇭🇰' },
  { code: 'TW', name: 'Taiwan', callingCode: '+886', flag: '🇹🇼' },
  { code: 'PH', name: 'Philippines', callingCode: '+63', flag: '🇵🇭' },
  { code: 'TH', name: 'Thailand', callingCode: '+66', flag: '🇹🇭' },
  { code: 'VN', name: 'Vietnam', callingCode: '+84', flag: '🇻🇳' },
  { code: 'BR', name: 'Brazil', callingCode: '+55', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', callingCode: '+52', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', callingCode: '+54', flag: '🇦🇷' },
  { code: 'CL', name: 'Chile', callingCode: '+56', flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia', callingCode: '+57', flag: '🇨🇴' },
  { code: 'PE', name: 'Peru', callingCode: '+51', flag: '🇵🇪' },
  { code: 'RU', name: 'Russia', callingCode: '+7', flag: '🇷🇺' },
  { code: 'UA', name: 'Ukraine', callingCode: '+380', flag: '🇺🇦' },
  { code: 'PL', name: 'Poland', callingCode: '+48', flag: '🇵🇱' },
  { code: 'CZ', name: 'Czech Republic', callingCode: '+420', flag: '🇨🇿' },
  { code: 'HU', name: 'Hungary', callingCode: '+36', flag: '🇭🇺' },
  { code: 'RO', name: 'Romania', callingCode: '+40', flag: '🇷🇴' },
  { code: 'GR', name: 'Greece', callingCode: '+30', flag: '🇬🇷' },
  { code: 'PT', name: 'Portugal', callingCode: '+351', flag: '🇵🇹' },
  { code: 'IL', name: 'Israel', callingCode: '+972', flag: '🇮🇱' },
  { code: 'LK', name: 'Sri Lanka', callingCode: '+94', flag: '🇱🇰' },
  { code: 'NP', name: 'Nepal', callingCode: '+977', flag: '🇳🇵' },
  { code: 'MM', name: 'Myanmar', callingCode: '+95', flag: '🇲🇲' },
].sort((a, b) => a.name.localeCompare(b.name));

export interface Country {
  code: string;
  name: string;
  callingCode: string;
  flag: string;
}

export interface PhoneInputProps {
  value: string;
  onChangePhone: (fullNumber: string, isValid: boolean) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  accentColor?: string;
  error?: string;
  defaultCountryCode?: string;
}

export function PhoneInput({
  value,
  onChangePhone,
  label = 'Phone Number',
  placeholder = 'Enter phone number',
  required = false,
  accentColor = '#4ECDC4',
  error,
  defaultCountryCode = 'PK',
}: PhoneInputProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Find default country
  const defaultCountry = useMemo(() => 
    COUNTRIES.find(c => c.code === defaultCountryCode) || COUNTRIES[0],
    [defaultCountryCode]
  );

  // Store selected country separately
  const [selectedCountry, setSelectedCountry] = useState<Country>(defaultCountry);
  
  // Extract phone number (digits only) from the full value
  const phoneNumber = useMemo(() => {
    if (!value) return '';
    // Remove the calling code from the value to get just the phone number
    if (value.startsWith(selectedCountry.callingCode)) {
      return value.slice(selectedCountry.callingCode.length);
    }
    // If value doesn't start with current calling code, try to extract digits
    return value.replace(/^\+\d+/, '').replace(/\D/g, '');
  }, [value, selectedCountry]);

  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    if (!searchQuery) return COUNTRIES;
    const query = searchQuery.toLowerCase();
    return COUNTRIES.filter(
      country =>
        country.name.toLowerCase().includes(query) ||
        country.callingCode.includes(query) ||
        country.code.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Handle phone number change (digits only)
  const handlePhoneChange = useCallback((text: string) => {
    // Remove all non-digit characters
    const digitsOnly = text.replace(/\D/g, '');
    const fullNumber = digitsOnly ? `${selectedCountry.callingCode}${digitsOnly}` : '';
    const isValid = digitsOnly.length >= 7 && digitsOnly.length <= 15;
    onChangePhone(fullNumber, isValid);
  }, [selectedCountry, onChangePhone]);

  // Handle country selection
  const handleCountrySelect = useCallback((country: Country) => {
    setModalVisible(false);
    setSearchQuery('');
    setSelectedCountry(country);
    
    // Get current phone digits
    const currentDigits = phoneNumber.replace(/\D/g, '');
    const fullNumber = currentDigits ? `${country.callingCode}${currentDigits}` : '';
    const isValid = currentDigits.length >= 7 && currentDigits.length <= 15;
    onChangePhone(fullNumber, isValid);
  }, [phoneNumber, onChangePhone]);

  // Render country item
  const renderCountryItem = useCallback(({ item }: { item: Country }) => (
    <TouchableOpacity
      style={styles.countryItem}
      onPress={() => handleCountrySelect(item)}
      activeOpacity={0.7}
    >
      <ThemedText style={styles.countryFlag}>{item.flag}</ThemedText>
      <View style={styles.countryInfo}>
        <ThemedText style={styles.countryName}>{item.name}</ThemedText>
        <ThemedText style={styles.countryCode}>{item.callingCode}</ThemedText>
      </View>
      {selectedCountry.code === item.code && (
        <Ionicons name="checkmark-circle" size={22} color={accentColor} />
      )}
    </TouchableOpacity>
  ), [selectedCountry, accentColor, handleCountrySelect]);

  const keyExtractor = useCallback((item: Country) => item.code, []);

  return (
    <View style={styles.container}>
      {label && (
        <ThemedText style={styles.label}>
          {label} {required && <ThemedText style={styles.required}>*</ThemedText>}
        </ThemedText>
      )}
      
      <View style={[
        styles.inputContainer,
        isFocused && { borderColor: accentColor, backgroundColor: '#fff' },
        error && styles.inputContainerError,
      ]}>
        {/* Country Selector */}
        <TouchableOpacity
          style={styles.countrySelector}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
        >
          <ThemedText style={styles.selectedFlag}>{selectedCountry.flag}</ThemedText>
          <ThemedText style={styles.selectedCode}>{selectedCountry.callingCode}</ThemedText>
          <Ionicons name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Phone Input */}
        <TextInput
          style={styles.phoneInput}
          value={phoneNumber}
          onChangeText={handlePhoneChange}
          placeholder={placeholder}
          placeholderTextColor="#999"
          keyboardType="phone-pad"
          maxLength={15}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={14} color="#FF4444" />
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      )}

      {/* Country Selection Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setModalVisible(false);
          setSearchQuery('');
        }}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Select Country</ThemedText>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setModalVisible(false);
                setSearchQuery('');
              }}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search country or code..."
              placeholderTextColor="#999"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {/* Country List */}
          <FlatList
            data={filteredCountries}
            renderItem={renderCountryItem}
            keyExtractor={keyExtractor}
            style={styles.countryList}
            contentContainerStyle={styles.countryListContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={10}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color="#ccc" />
                <ThemedText style={styles.emptyText}>No countries found</ThemedText>
              </View>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 4,
  },
  required: {
    color: '#FF6B6B',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    borderRadius: 14,
    backgroundColor: '#F8FAFB',
    overflow: 'hidden',
  },
  inputContainerError: {
    borderColor: '#FF4444',
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 6,
  },
  selectedFlag: {
    fontSize: 22,
  },
  selectedCode: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: '#E0E0E0',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#FF4444',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  countryList: {
    flex: 1,
  },
  countryListContent: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  countryFlag: {
    fontSize: 28,
    marginRight: 12,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  countryCode: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

export default PhoneInput;
