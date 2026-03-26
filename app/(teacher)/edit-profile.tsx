import { StyleSheet, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, Platform, Modal } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LanguagesMultiSelectDropdown } from '@/components/dropdowns';

interface TeacherProfileData {
  full_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  bio: string;
  subjects: string[];
  hourly_rate: number;
  languages: string[];
  gender: string;
}

const AVAILABLE_SUBJECTS = [
  'Quran Memorization',
  'Tajweed',
  'Arabic Language',
  'Islamic Studies',
  'Fiqh',
  'Hadith',
  'Seerah',
  'Tafsir',
];

export default function EditTeacherProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<TeacherProfileData>({
    full_name: '',
    email: '',
    phone: '',
    avatar_url: '',
    bio: '',
    subjects: [],
    hourly_rate: 0,
    languages: [],
    gender: 'male',
  });
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      if (!user?.id) {
        router.replace('/login');
        return;
      }

      const response = await fetch(api.teacherProfile(user.id));
      const data = await response.json();

      if (response.ok && data.profile) {
        setProfile({
          full_name: data.profile.full_name || '',
          email: data.profile.email || '',
          phone: data.profile.phone || '',
          avatar_url: data.profile.avatar_url || '',
          bio: data.profile.bio || '',
          subjects: data.profile.subjects || [],
          hourly_rate: data.profile.hourly_rate || 0,
          languages: data.profile.languages || [],
          gender: data.profile.gender || 'male',
        });
        if (data.profile.avatar_url) {
          setImageUri(data.profile.avatar_url);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // Take a photo using the camera
  const takePhoto = async () => {
    console.log('📷 takePhoto called');
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      console.log('📷 Camera permission result:', permissionResult);
      if (permissionResult.granted === false) {
        Alert.alert('Permission required', 'Permission to access camera is required!');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5, // Lower quality to reduce upload size
      });
      console.log('📷 Camera result:', result);
      if (!result.canceled && result.assets && result.assets[0]) {
        console.log('📷 Setting image URI:', result.assets[0].uri);
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('📷 takePhoto error:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  // Show image picker when avatar is pressed
  const pickImage = async () => {
    console.log('🖼️ pickImage called');
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('🖼️ Media library permission result:', permissionResult);
      if (permissionResult.granted === false) {
        Alert.alert('Permission required', 'Permission to access media library is required!');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5, // Lower quality to reduce upload size
      });
      console.log('🖼️ Image picker result:', result);
      if (!result.canceled && result.assets && result.assets[0]) {
        console.log('🖼️ Setting image URI:', result.assets[0].uri);
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('🖼️ pickImage error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const showImageOptions = () => {
    console.log('👆 showImageOptions called - Platform:', Platform.OS);
    if (Platform.OS === 'web') {
      // On web, show a custom modal or directly open file picker
      setShowImageModal(true);
    } else {
      // On mobile, use Alert
      Alert.alert(
        'Profile Picture',
        'Choose an option',
        [
          { text: 'Take Photo', onPress: () => { console.log('📷 Take Photo selected'); takePhoto(); } },
          { text: 'Choose from Library', onPress: () => { console.log('🖼️ Choose from Library selected'); pickImage(); } },
          { text: 'Remove Photo', onPress: () => { console.log('🗑️ Remove Photo selected'); setImageUri(null); }, style: 'destructive' },
          { text: 'Cancel', style: 'cancel', onPress: () => console.log('❌ Cancel selected') },
        ]
      );
    }
  };

  const toggleSubject = (subject: string) => {
    setProfile(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...prev.subjects, subject],
    }));
  };

  const handleSave = async () => {
    if (!profile.full_name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (profile.subjects.length === 0) {
      Alert.alert('Error', 'Please select at least one subject');
      return;
    }

    if (profile.hourly_rate <= 0) {
      Alert.alert('Error', 'Please set a valid hourly rate');
      return;
    }

    if (profile.languages.length === 0) {
      Alert.alert('Error', 'Please select at least one language');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'Session expired. Please login again.');
      router.replace('/login');
      return;
    }

    setSaving(true);
    try {
      let avatarUrl: string | undefined = profile.avatar_url;
      
      // Check if user selected a new image (local file or blob on web)
      const isNewLocalImage = imageUri && (
        imageUri.startsWith('file://') || 
        imageUri.startsWith('blob:') ||
        imageUri.startsWith('data:')
      );
      const isExistingRemoteImage = imageUri && (imageUri.startsWith('http://') || imageUri.startsWith('https://'));
      
      console.log('📸 Image check:', { imageUri, isNewLocalImage, isExistingRemoteImage });
      
      if (isNewLocalImage) {
        console.log('📸 Starting image upload...');
        console.log('📸 Image URI:', imageUri);
        
        try {
          let base64: string;
          let extension: string;
          
          if (Platform.OS === 'web') {
            // On web, fetch the blob and convert to base64
            console.log('📸 Web platform: fetching blob...');
            const response = await fetch(imageUri);
            const blob = await response.blob();
            
            // Get extension from blob type
            const mimeType = blob.type;
            extension = mimeType.split('/')[1] || 'jpg';
            console.log('📸 Blob type:', mimeType, 'Extension:', extension);
            
            // Convert blob to base64
            base64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const result = reader.result as string;
                // Remove data URI prefix
                const base64Data = result.split(',')[1];
                resolve(base64Data);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            console.log('📸 Base64 length (web):', base64.length);
          } else {
            // On mobile, use FileSystem
            console.log('📸 Mobile platform: reading file...');
            base64 = await FileSystem.readAsStringAsync(imageUri, {
              encoding: 'base64',
            });
            extension = imageUri.split('.').pop() || 'jpg';
            console.log('📸 Base64 length (mobile):', base64.length);
          }
          console.log('📸 File extension:', extension);
          
          // Build upload URL
          const uploadUrl = api.uploadProfileImage(user.id);
          console.log('📸 Upload URL:', uploadUrl);
          
          // Upload image
          console.log('📸 Sending upload request...');
          const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image: base64,
              fileExtension: extension,
            }),
          });

          console.log('📸 Upload response status:', uploadResponse.status);
          
          // Handle non-JSON responses (like 413 Payload Too Large)
          const contentType = uploadResponse.headers.get('content-type');
          let uploadData: any;
          
          if (contentType && contentType.includes('application/json')) {
            uploadData = await uploadResponse.json();
            console.log('📸 Upload response data:', JSON.stringify(uploadData, null, 2));
          } else {
            const text = await uploadResponse.text();
            console.log('📸 Upload response (non-JSON):', text);
            uploadData = { error: uploadResponse.status === 413 ? 'Image too large. Please select a smaller image.' : `Server error: ${uploadResponse.status}` };
          }
          
          if (uploadResponse.ok && uploadData.avatar_url) {
            avatarUrl = uploadData.avatar_url;
            console.log('✅ Image uploaded successfully!');
            console.log('✅ New avatar URL:', avatarUrl);
            console.log('✅ avatarUrl variable is now:', avatarUrl);
          } else {
            const errorMsg = uploadData.error || 'Unknown error';
            console.error('❌ Image upload failed:', errorMsg);
            console.error('❌ Upload response ok?:', uploadResponse.ok);
            console.error('❌ uploadData.avatar_url:', uploadData.avatar_url);
            if (Platform.OS === 'web') {
              setNotification({ type: 'error', message: `Image upload failed: ${errorMsg}` });
              setTimeout(() => setNotification(null), 4000);
            } else {
              Alert.alert('Upload Warning', `Image upload failed: ${errorMsg}. Profile will be saved without new image.`);
            }
          }
        } catch (uploadError: any) {
          console.error('❌ Failed to upload image (exception):', uploadError);
          console.error('❌ Error details:', uploadError.message);
          const errorMsg = uploadError.message || 'Unknown error';
          if (Platform.OS === 'web') {
            setNotification({ type: 'error', message: `Image upload failed: ${errorMsg}` });
            setTimeout(() => setNotification(null), 4000);
          } else {
            Alert.alert('Upload Error', `Failed to upload image: ${errorMsg}`);
          }
        }
      } else if (imageUri === null) {
        // User removed the image
        avatarUrl = undefined;
        console.log('🗑️ Image removed, avatarUrl set to undefined');
      } else {
        console.log('ℹ️ No new image to upload, keeping existing avatar_url:', avatarUrl);
      }
      
      console.log('📤 Final avatarUrl before profile update:', avatarUrl);
      
      const accessToken = await AsyncStorage.getItem('access_token');
      if (!accessToken) {
        console.error('❌ No access token found');
        throw new Error('No token');
      }
      console.log('🔐 Access token found');

      const profileUpdateUrl = api.teacherProfile(user.id);
      console.log('📝 Profile update URL:', profileUpdateUrl);
      
      const updatePayload = {
        full_name: profile.full_name,
        phone: profile.phone,
        avatar_url: avatarUrl,
        bio: profile.bio,
        subjects: profile.subjects,
        hourly_rate: profile.hourly_rate,
        languages: profile.languages,
        gender: profile.gender,
      };
      console.log('📝 Update payload:', JSON.stringify(updatePayload, null, 2));

      const response = await fetch(profileUpdateUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(updatePayload),
      });

      console.log('📝 Profile update response status:', response.status);
      const data = await response.json();
      console.log('📝 Profile update response:', JSON.stringify(data, null, 2));

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      // Show success notification
      if (Platform.OS === 'web') {
        setNotification({ type: 'success', message: 'Profile updated successfully!' });
        setTimeout(() => {
          setNotification(null);
          router.back();
        }, 2000);
      } else {
        Alert.alert('Success', 'Profile updated successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      if (Platform.OS === 'web') {
        setNotification({ type: 'error', message: 'Failed to save profile. Please try again.' });
        setTimeout(() => setNotification(null), 3000);
      } else {
        Alert.alert('Error', 'Failed to save profile. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Notification Banner for Web */}
      {notification && (
        <View style={[
          styles.notificationBanner,
          notification.type === 'success' ? styles.notificationSuccess : styles.notificationError
        ]}>
          <Ionicons 
            name={notification.type === 'success' ? 'checkmark-circle' : 'alert-circle'} 
            size={20} 
            color="#FFFFFF" 
          />
          <ThemedText style={styles.notificationText}>{notification.message}</ThemedText>
        </View>
      )}
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Edit Profile</ThemedText>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton}>
          {saving ? (
            <ActivityIndicator size="small" color="#4ECDC4" />
          ) : (
            <ThemedText style={styles.saveText}>Save</ThemedText>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Picture */}
        <View style={styles.avatarSection}>
          <TouchableOpacity 
            onPress={() => {
              console.log('👆 Avatar TouchableOpacity pressed!');
              showImageOptions();
            }} 
            style={styles.avatarContainer}
            activeOpacity={0.7}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name={profile.gender === 'female' ? 'person' : 'person'} size={60} color="#9CA3AF" />
              </View>
            )}
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={18} color="#4ECDC4" />
            </View>
          </TouchableOpacity>
          <ThemedText style={styles.changePhotoText}>Tap to change photo</ThemedText>
        </View>

        {/* Basic Info */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Basic Information</ThemedText>
          
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Full Name</ThemedText>
            <TextInput
              style={styles.input}
              value={profile.full_name}
              onChangeText={(text) => setProfile({ ...profile, full_name: text })}
              placeholder="Enter your full name"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Email</ThemedText>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={profile.email}
              editable={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Phone Number</ThemedText>
            <TextInput
              style={styles.input}
              value={profile.phone}
              onChangeText={(text) => setProfile({ ...profile, phone: text })}
              placeholder="Enter your phone number"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Gender</ThemedText>
            <View style={styles.genderRow}>
              <TouchableOpacity
                style={[styles.genderOption, profile.gender === 'male' && styles.genderOptionActive]}
                onPress={() => setProfile({ ...profile, gender: 'male' })}
              >
                <Ionicons name="man" size={24} color={profile.gender === 'male' ? '#FFFFFF' : '#374151'} />
                <ThemedText style={[styles.genderText, profile.gender === 'male' && styles.genderTextActive]}>
                  Male
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderOption, profile.gender === 'female' && styles.genderOptionActive]}
                onPress={() => setProfile({ ...profile, gender: 'female' })}
              >
                <Ionicons name="woman" size={24} color={profile.gender === 'female' ? '#FFFFFF' : '#374151'} />
                <ThemedText style={[styles.genderText, profile.gender === 'female' && styles.genderTextActive]}>
                  Female
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Bio */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>About You</ThemedText>
          <TextInput
            style={styles.textArea}
            value={profile.bio}
            onChangeText={(text) => setProfile({ ...profile, bio: text })}
            placeholder="Tell parents about yourself, your teaching experience, and your approach..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Subjects */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Subjects You Teach</ThemedText>
          <View style={styles.chipContainer}>
            {AVAILABLE_SUBJECTS.map((subject) => (
              <TouchableOpacity
                key={subject}
                style={[styles.chip, profile.subjects.includes(subject) && styles.chipActive]}
                onPress={() => toggleSubject(subject)}
              >
                <ThemedText style={[styles.chipText, profile.subjects.includes(subject) && styles.chipTextActive]}>
                  {subject}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Languages */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Languages</ThemedText>
          <View style={styles.inputGroup}>
            <LanguagesMultiSelectDropdown
              values={profile.languages}
              onChange={(languages) => setProfile({ ...profile, languages })}
              label=""
            />
          </View>
        </View>

        {/* Hourly Rate */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Pricing</ThemedText>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Hourly Rate (USD)</ThemedText>
            <View style={styles.priceInputContainer}>
              <ThemedText style={styles.currencySymbol}>$</ThemedText>
              <TextInput
                style={styles.priceInput}
                value={profile.hourly_rate > 0 ? profile.hourly_rate.toString() : ''}
                onChangeText={(text) => setProfile({ ...profile, hourly_rate: parseFloat(text) || 0 })}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
              <ThemedText style={styles.perHour}>/hour</ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Image Options Modal for Web */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowImageModal(false)}
        >
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Profile Picture</ThemedText>
            <ThemedText style={styles.modalSubtitle}>Choose an option</ThemedText>
            
            <TouchableOpacity 
              style={styles.modalOption} 
              onPress={() => {
                console.log('📷 Take Photo selected (web modal)');
                setShowImageModal(false);
                takePhoto();
              }}
            >
              <Ionicons name="camera" size={24} color="#4ECDC4" />
              <ThemedText style={styles.modalOptionText}>Take Photo</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalOption} 
              onPress={() => {
                console.log('🖼️ Choose from Library selected (web modal)');
                setShowImageModal(false);
                pickImage();
              }}
            >
              <Ionicons name="image" size={24} color="#4ECDC4" />
              <ThemedText style={styles.modalOptionText}>Choose from Library</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalOption, styles.modalOptionDestructive]} 
              onPress={() => {
                console.log('🗑️ Remove Photo selected (web modal)');
                setShowImageModal(false);
                setImageUri(null);
              }}
            >
              <Ionicons name="trash" size={24} color="#EF4444" />
              <ThemedText style={[styles.modalOptionText, { color: '#EF4444' }]}>Remove Photo</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalOption, styles.modalOptionCancel]} 
              onPress={() => {
                console.log('❌ Cancel selected (web modal)');
                setShowImageModal(false);
              }}
            >
              <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    padding: 4,
  },
  backText: {
    fontSize: 28,
    color: '#000',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  saveButton: {
    padding: 4,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4ECDC4',
  },
  scrollView: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 60,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editIcon: {
    fontSize: 18,
  },
  changePhotoText: {
    fontSize: 14,
    color: '#4ECDC4',
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000',
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000',
    minHeight: 120,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  genderOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  genderOptionActive: {
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4',
  },
  genderEmoji: {
    fontSize: 24,
  },
  genderText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  genderTextActive: {
    color: '#FFFFFF',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: {
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4ECDC4',
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  perHour: {
    fontSize: 14,
    color: '#6B7280',
  },
  bottomPadding: {
    height: 40,
  },
  // Modal styles for web image picker
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 320,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    marginBottom: 10,
  },
  modalOptionDestructive: {
    backgroundColor: '#FEF2F2',
  },
  modalOptionCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 8,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginLeft: 12,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    width: '100%',
  },
  // Notification banner styles
  notificationBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
  },
  notificationSuccess: {
    backgroundColor: '#10B981',
  },
  notificationError: {
    backgroundColor: '#EF4444',
  },
  notificationText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
