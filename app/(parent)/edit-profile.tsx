import { StyleSheet, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, Platform, Modal, KeyboardAvoidingView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LingoBadge, LingoButton, LingoCard, LingoScreenHeader } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';

interface ProfileData {
  full_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, refreshUserProfile } = useAuth();
  const { topPadding, bottomPadding } = useSafePadding();
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
        setLoading(false);
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

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('pickImage error:', error);
    }
  };

  const takePhoto = async () => {
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

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('takePhoto error:', error);
    }
  };

  const showImageOptions = () => {
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

      if (isNewLocalImage) {
        try {
          let base64: string;
          let extension: string;

          if (Platform.OS === 'web') {
            const response = await fetch(imageUri);
            const blob = await response.blob();

            const mimeType = blob.type;
            extension = mimeType.split('/')[1] || 'jpg';

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
          } else {
            base64 = await FileSystem.readAsStringAsync(imageUri, {
              encoding: 'base64',
            });
            extension = imageUri.split('.').pop() || 'jpg';
          }

          const uploadUrl = api.uploadProfileImage(user.id);

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

          const contentType = uploadResponse.headers.get('content-type');
          let uploadData: any;

          if (contentType && contentType.includes('application/json')) {
            uploadData = await uploadResponse.json();
          } else {
            const text = await uploadResponse.text();
            uploadData = { error: uploadResponse.status === 413 ? 'Image too large.' : `Server error: ${uploadResponse.status}` };
          }

          if (uploadResponse.ok && uploadData.avatar_url) {
            avatarUrl = uploadData.avatar_url;
          } else {
            const errorMsg = uploadData.error || 'Unknown error';
            if (Platform.OS === 'web') {
              setNotification({ type: 'error', message: `Upload failed: ${errorMsg}` });
              setTimeout(() => setNotification(null), 4000);
            } else {
              Alert.alert('Upload Warning', errorMsg);
            }
          }
        } catch (uploadError: any) {
          if (Platform.OS === 'web') {
            setNotification({ type: 'error', message: `Upload failed: ${uploadError.message}` });
            setTimeout(() => setNotification(null), 4000);
          }
        }
      } else if (imageUri === null) {
        avatarUrl = undefined;
      }

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

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      await refreshUserProfile();

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
        <LingoCard style={styles.loadingCard}>
          <ActivityIndicator size="large" color={LingoTheme.colors.primary} />
          <ThemedText style={styles.loadingText}>Loading your parent profile...</ThemedText>
        </LingoCard>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {notification && (
        <View style={[
          styles.notificationBanner,
          notification.type === 'success' ? styles.notificationSuccess : styles.notificationError,
          { top: Math.max(topPadding - 8, 12) },
        ]}>
          <Ionicons 
            name={notification.type === 'success' ? 'checkmark-circle' : 'alert-circle'} 
            size={20} 
            color={LingoTheme.colors.textInverse} 
          />
          <ThemedText style={styles.notificationText}>{notification.message}</ThemedText>
        </View>
      )}

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: topPadding, paddingBottom: bottomPadding + 24 }}>
        <View style={styles.content}>
          <LingoScreenHeader
            title="Edit profile"
            subtitle="Keep your parent profile polished so teachers and support can recognize your account quickly."
            badge="Parent account"
            icon="person-circle-outline"
            onBack={() => router.back()}
          >
            <View style={styles.headerBadges}>
              <LingoBadge label={profile.email || 'Email on file'} icon="mail-outline" tone="teal" />
              <LingoBadge label="Secure details" icon="shield-checkmark-outline" tone="purple" />
            </View>
          </LingoScreenHeader>

          <LingoCard style={styles.avatarSection}>
            <TouchableOpacity onPress={showImageOptions} style={styles.avatarContainer} activeOpacity={0.8}>
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
                <Ionicons name="camera" size={18} color={LingoTheme.colors.primary} />
              </View>
            </TouchableOpacity>
            <ThemedText style={styles.changePhotoText}>Tap to change photo</ThemedText>
            <ThemedText style={styles.photoHelpText}>Choose a clear picture so teachers can identify your family account.</ThemedText>
          </LingoCard>

          <LingoCard style={styles.formSection}>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Full Name</ThemedText>
              <TextInput
                style={styles.input}
                value={profile.full_name}
                onChangeText={(text) => setProfile({ ...profile, full_name: text })}
                placeholder="Enter your full name"
                placeholderTextColor={LingoTheme.colors.textTertiary}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.lockedLabelRow}>
                <ThemedText style={styles.label}>Email</ThemedText>
                <LingoBadge label="Locked" icon="lock-closed-outline" tone="gold" />
              </View>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={profile.email}
                editable={false}
                placeholder="Email address"
                placeholderTextColor={LingoTheme.colors.textTertiary}
              />
              <ThemedText style={styles.helperText}>Email cannot be changed from the app.</ThemedText>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Phone Number</ThemedText>
              <TextInput
                style={styles.input}
                value={profile.phone}
                onChangeText={(text) => setProfile({ ...profile, phone: text })}
                placeholder="Enter your phone number"
                placeholderTextColor={LingoTheme.colors.textTertiary}
                keyboardType="phone-pad"
              />
            </View>
          </LingoCard>

          <LingoButton label="Save changes" onPress={handleSave} loading={saving} icon="save-outline" style={styles.saveCta} />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

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
              activeOpacity={0.8}
            >
              <Ionicons name="camera" size={24} color={LingoTheme.colors.teal} />
              <ThemedText style={styles.modalOptionText}>Take Photo</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption} 
              onPress={() => { setShowImageModal(false); pickImage(); }}
              activeOpacity={0.8}
            >
              <Ionicons name="image" size={24} color={LingoTheme.colors.teal} />
              <ThemedText style={styles.modalOptionText}>Choose from Library</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modalOption, styles.modalOptionDestructive]} 
              onPress={() => { setShowImageModal(false); setImageUri(null); }}
              activeOpacity={0.8}
            >
              <Ionicons name="trash" size={24} color={LingoTheme.colors.danger} />
              <ThemedText style={[styles.modalOptionText, { color: LingoTheme.colors.danger }]}>Remove Photo</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modalOption, styles.modalOptionCancel]} 
              onPress={() => setShowImageModal(false)}
              activeOpacity={0.8}
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
    backgroundColor: LingoTheme.colors.background 
  },
  centerContent: { 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingCard: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    gap: 14,
  },
  loadingText: { 
    fontSize: 14, 
    color: LingoTheme.colors.muted, 
    fontWeight: '700' 
  },
  scrollView: { 
    flex: 1 
  },
  content: {
    paddingHorizontal: 20,
    gap: 18,
  },
  headerBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  avatarSection: {
    alignItems: 'center',
  },
  avatarContainer: { 
    position: 'relative', 
    marginBottom: 12 
  },
  avatarImage: { 
    width: 120, 
    height: 120, 
    borderRadius: LingoTheme.radius.pill, 
    borderWidth: 3, 
    borderColor: LingoTheme.colors.border 
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: LingoTheme.radius.pill,
    backgroundColor: LingoTheme.colors.softPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: LingoTheme.colors.border,
  },
  avatarInitial: { 
    fontSize: 48, 
    fontWeight: '800', 
    color: LingoTheme.colors.primaryDark 
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: LingoTheme.radius.pill,
    backgroundColor: LingoTheme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
  },
  changePhotoText: { 
    fontSize: 15, 
    color: LingoTheme.colors.ink, 
    fontWeight: '800' 
  },
  photoHelpText: { 
    fontSize: 13, 
    color: LingoTheme.colors.muted, 
    textAlign: 'center', 
    lineHeight: 18, 
    marginTop: 6 
  },
  formSection: { 
    gap: 20 
  },
  inputGroup: { 
    marginBottom: 20 
  },
  lockedLabelRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    gap: 12, 
    marginBottom: 8 
  },
  label: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: LingoTheme.colors.ink, 
    marginBottom: 8 
  },
  input: {
    backgroundColor: LingoTheme.colors.surface,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    borderRadius: LingoTheme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: LingoTheme.colors.ink,
  },
  inputDisabled: { 
    backgroundColor: LingoTheme.colors.surfaceAlt, 
    color: LingoTheme.colors.textTertiary 
  },
  helperText: { 
    fontSize: 12, 
    color: LingoTheme.colors.muted, 
    marginTop: 6 
  },
  notificationBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
    marginHorizontal: 20,
    borderRadius: LingoTheme.radius.md,
  },
  notificationSuccess: { 
    backgroundColor: LingoTheme.colors.success 
  },
  notificationError: { 
    backgroundColor: LingoTheme.colors.danger 
  },
  notificationText: { 
    color: LingoTheme.colors.textInverse, 
    fontSize: 14, 
    fontWeight: '600' 
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: LingoTheme.colors.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: LingoTheme.colors.surface,
    borderRadius: LingoTheme.radius.lg,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: LingoTheme.colors.ink, 
    marginBottom: 4 
  },
  modalSubtitle: { 
    fontSize: 14, 
    color: LingoTheme.colors.muted, 
    marginBottom: 20 
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: LingoTheme.radius.md,
    backgroundColor: LingoTheme.colors.surfaceAlt,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    marginBottom: 10,
  },
  modalOptionDestructive: { 
    backgroundColor: LingoTheme.colors.softDanger, 
    borderColor: LingoTheme.colors.softDanger 
  },
  modalOptionCancel: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    marginTop: 8,
  },
  modalOptionText: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: LingoTheme.colors.ink, 
    marginLeft: 12 
  },
  modalCancelText: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: LingoTheme.colors.muted, 
    textAlign: 'center', 
    width: '100%' 
  },
  saveCta: {
    marginTop: 4,
  },
});