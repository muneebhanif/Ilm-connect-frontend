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

interface ProfileData {
  full_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: '',
    email: '',
    phone: '',
    avatar_url: '',
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

      const accessToken = await AsyncStorage.getItem('access_token');
      if (!accessToken) throw new Error('No token');

      const response = await fetch(api.parentProfile(user.id), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await response.json();

      if (response.ok && data.profile) {
        setProfile({
          full_name: data.profile.full_name || '',
          email: data.profile.email || '',
          phone: data.profile.phone || '',
          avatar_url: data.profile.avatar_url || '',
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

  const pickImage = async () => {
    console.log('🖼️ pickImage called');
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        if (Platform.OS === 'web') {
          setNotification({ type: 'error', message: 'Please allow access to your photo library.' });
          setTimeout(() => setNotification(null), 3000);
        } else {
          Alert.alert('Permission Required', 'Please allow access to your photo library.');
        }
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      console.log('🖼️ Image picker result:', result);
      if (!result.canceled && result.assets[0]) {
        console.log('🖼️ Setting image URI:', result.assets[0].uri);
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('🖼️ pickImage error:', error);
    }
  };

  const takePhoto = async () => {
    console.log('📷 takePhoto called');
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permissionResult.granted) {
        if (Platform.OS === 'web') {
          setNotification({ type: 'error', message: 'Please allow camera access.' });
          setTimeout(() => setNotification(null), 3000);
        } else {
          Alert.alert('Permission Required', 'Please allow camera access.');
        }
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      console.log('📷 Camera result:', result);
      if (!result.canceled && result.assets[0]) {
        console.log('📷 Setting image URI:', result.assets[0].uri);
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('📷 takePhoto error:', error);
    }
  };

  const showImageOptions = () => {
    console.log('👆 showImageOptions called - Platform:', Platform.OS);
    if (Platform.OS === 'web') {
      setShowImageModal(true);
    } else {
      Alert.alert(
        'Profile Picture',
        'Choose an option',
        [
          { text: 'Take Photo', onPress: takePhoto },
          { text: 'Choose from Library', onPress: pickImage },
          { text: 'Remove Photo', onPress: () => setImageUri(null), style: 'destructive' },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const handleSave = async () => {
    if (!profile.full_name.trim()) {
      if (Platform.OS === 'web') {
        setNotification({ type: 'error', message: 'Please enter your name' });
        setTimeout(() => setNotification(null), 3000);
      } else {
        Alert.alert('Error', 'Please enter your name');
      }
      return;
    }

    if (!user?.id) {
      router.replace('/login');
      return;
    }

    setSaving(true);
    try {
      let avatarUrl: string | undefined = profile.avatar_url;
      
      const isNewLocalImage = imageUri && (
        imageUri.startsWith('file://') || 
        imageUri.startsWith('blob:') ||
        imageUri.startsWith('data:')
      );
      
      console.log('📸 Image check:', { imageUri, isNewLocalImage });
      
      if (isNewLocalImage) {
        console.log('📸 Starting image upload...');
        
        try {
          let base64: string;
          let extension: string;
          
          if (Platform.OS === 'web') {
            console.log('📸 Web platform: fetching blob...');
            const response = await fetch(imageUri);
            const blob = await response.blob();
            
            const mimeType = blob.type;
            extension = mimeType.split('/')[1] || 'jpg';
            console.log('📸 Blob type:', mimeType, 'Extension:', extension);
            
            base64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const result = reader.result as string;
                const base64Data = result.split(',')[1];
                resolve(base64Data);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            console.log('📸 Base64 length (web):', base64.length);
          } else {
            console.log('📸 Mobile platform: reading file...');
            base64 = await FileSystem.readAsStringAsync(imageUri, {
              encoding: 'base64',
            });
            extension = imageUri.split('.').pop() || 'jpg';
            console.log('📸 Base64 length (mobile):', base64.length);
          }
          
          const uploadUrl = api.uploadProfileImage(user.id);
          console.log('📸 Upload URL:', uploadUrl);
          
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
          
          const contentType = uploadResponse.headers.get('content-type');
          let uploadData: any;
          
          if (contentType && contentType.includes('application/json')) {
            uploadData = await uploadResponse.json();
            console.log('📸 Upload response data:', JSON.stringify(uploadData, null, 2));
          } else {
            const text = await uploadResponse.text();
            console.log('📸 Upload response (non-JSON):', text);
            uploadData = { error: uploadResponse.status === 413 ? 'Image too large.' : `Server error: ${uploadResponse.status}` };
          }
          
          if (uploadResponse.ok && uploadData.avatar_url) {
            avatarUrl = uploadData.avatar_url;
            console.log('✅ Image uploaded successfully:', avatarUrl);
          } else {
            const errorMsg = uploadData.error || 'Unknown error';
            console.error('❌ Image upload failed:', errorMsg);
            if (Platform.OS === 'web') {
              setNotification({ type: 'error', message: `Upload failed: ${errorMsg}` });
              setTimeout(() => setNotification(null), 4000);
            } else {
              Alert.alert('Upload Warning', errorMsg);
            }
          }
        } catch (uploadError: any) {
          console.error('❌ Failed to upload image:', uploadError);
          if (Platform.OS === 'web') {
            setNotification({ type: 'error', message: `Upload failed: ${uploadError.message}` });
            setTimeout(() => setNotification(null), 4000);
          }
        }
      } else if (imageUri === null) {
        avatarUrl = undefined;
        console.log('🗑️ Image removed');
      }
      
      console.log('📤 Final avatarUrl:', avatarUrl);
      
      const accessToken = await AsyncStorage.getItem('access_token');
      if (!accessToken) throw new Error('No token');

      const response = await fetch(api.parentProfile(user.id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          full_name: profile.full_name,
          avatar_url: avatarUrl,
        }),
      });

      const data = await response.json();
      console.log('📝 Profile update response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

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
        setNotification({ type: 'error', message: 'Failed to save profile.' });
        setTimeout(() => setNotification(null), 3000);
      } else {
        Alert.alert('Error', 'Failed to save profile.');
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
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={showImageOptions} style={styles.avatarContainer}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <ThemedText style={styles.avatarInitial}>
                  {profile.full_name?.charAt(0).toUpperCase() || 'P'}
                </ThemedText>
              </View>
            )}
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={18} color="#4ECDC4" />
            </View>
          </TouchableOpacity>
          <ThemedText style={styles.changePhotoText}>Tap to change photo</ThemedText>
        </View>

        <View style={styles.formSection}>
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
              placeholder="Email address"
              placeholderTextColor="#9CA3AF"
            />
            <ThemedText style={styles.helperText}>Email cannot be changed</ThemedText>
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
        </View>
      </ScrollView>

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
              onPress={() => { setShowImageModal(false); takePhoto(); }}
            >
              <Ionicons name="camera" size={24} color="#4ECDC4" />
              <ThemedText style={styles.modalOptionText}>Take Photo</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalOption} 
              onPress={() => { setShowImageModal(false); pickImage(); }}
            >
              <Ionicons name="image" size={24} color="#4ECDC4" />
              <ThemedText style={styles.modalOptionText}>Choose from Library</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalOption, styles.modalOptionDestructive]} 
              onPress={() => { setShowImageModal(false); setImageUri(null); }}
            >
              <Ionicons name="trash" size={24} color="#EF4444" />
              <ThemedText style={[styles.modalOptionText, { color: '#EF4444' }]}>Remove Photo</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalOption, styles.modalOptionCancel]} 
              onPress={() => setShowImageModal(false)}
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
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
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
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#000' },
  saveButton: { padding: 4 },
  saveText: { fontSize: 16, fontWeight: '600', color: '#4ECDC4' },
  scrollView: { flex: 1 },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatarImage: { width: 120, height: 120, borderRadius: 60 },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 48, fontWeight: '700', color: '#FFFFFF' },
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
  changePhotoText: { fontSize: 14, color: '#4ECDC4', fontWeight: '500' },
  formSection: { backgroundColor: '#FFFFFF', padding: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
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
  inputDisabled: { backgroundColor: '#F3F4F6', color: '#9CA3AF' },
  helperText: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
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
  notificationSuccess: { backgroundColor: '#10B981' },
  notificationError: { backgroundColor: '#EF4444' },
  notificationText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
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
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
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
  modalOptionDestructive: { backgroundColor: '#FEF2F2' },
  modalOptionCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 8,
  },
  modalOptionText: { fontSize: 16, fontWeight: '500', color: '#374151', marginLeft: 12 },
  modalCancelText: { fontSize: 16, fontWeight: '500', color: '#6B7280', textAlign: 'center', width: '100%' },
});
