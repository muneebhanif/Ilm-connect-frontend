import { StyleSheet, View, ScrollView, TouchableOpacity, Image, Platform, Alert, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { LinearGradient } from 'expo-linear-gradient';
import { Fonts } from '@/constants/theme';
import { TeacherDashboardSkeleton } from '@/components/ui/dashboard-skeletons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useFocusEffect } from '@react-navigation/native';

interface TeacherStats {
  totalStudents: number;
  totalEarnings: number;
  completedClasses: number;
  upcomingClasses: number;
}

interface TeacherProfile {
  full_name: string;
  email: string;
  avatar_url?: string;
  bio: string;
  subjects: string[];
  hourly_rate: number;
  rating: number;
  verification_status: string;
  rejection_reason?: string;
  availability?: Record<string, string[]>;
  documents?: UploadedDocument[];
}

interface UploadedDocument {
  type: string;
  url: string;
  fileName: string;
  uploadedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

const REQUIRED_DOCUMENTS = [
  { type: 'id_proof', label: 'ID Proof (CNIC/Passport)', icon: 'card-outline', description: 'Upload a clear photo of your ID' },
  { type: 'qualification', label: 'Qualification Certificate', icon: 'school-outline', description: 'Teaching certificate or degree' },
];

const formatTime12h = (time24: string) => {
  const [hh, mm] = String(time24 || '').split(':');
  const hour24 = Number(hh);
  if (!Number.isFinite(hour24)) return String(time24 || '');
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = ((hour24 + 11) % 12) + 1;
  return `${hour12}:${mm || '00'} ${suffix}`;
};

export default function TeacherDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notificationCount, setNotificationCount] = useState(0);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [stats, setStats] = useState<TeacherStats>({
    totalStudents: 0,
    totalEarnings: 0,
    completedClasses: 0,
    upcomingClasses: 0,
  });
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (user?.role === 'parent') {
      router.replace('/(parent)/dashboard');
      return;
    }
    loadDashboardData();
  }, [user?.id, user?.role]);

  useFocusEffect(
    useCallback(() => {
      loadNotificationCount();
    }, [user?.id])
  );

  const loadNotificationCount = async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(api.teacherNotifications(user.id));
      const data = await response.json();
      if (response.ok && Number.isFinite(Number(data.unreadCount))) {
        setNotificationCount(Number(data.unreadCount));
      }
    } catch (error) {
      console.error('Error loading notification count:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      if (!user?.id) {
        return;
      }

      const [profileRes, docsRes] = await Promise.all([
        fetch(api.teacherProfile(user.id)),
        fetch(api.getTeacherDocuments(user.id))
      ]);

      loadNotificationCount();

      if (!profileRes.ok) {
        console.error('API Error:', profileRes.status);
        setLoading(false);
        return;
      }

      const data = await profileRes.json();
      console.log('📊 Dashboard API response:', JSON.stringify(data, null, 2));
      console.log('📷 Avatar URL from API:', data.profile?.avatar_url);

      if (data.profile) {
        setProfile(data.profile);
      }

      if (data.stats) {
        setStats(data.stats);
      }

      // Load documents
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setDocuments(docsData.documents || []);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDocumentForType = (type: string): UploadedDocument | undefined => {
    return documents.find(doc => doc.type === type);
  };

  const handleDocumentUpload = async (docType: string) => {
    if (Platform.OS === 'web') {
      // On web, create a file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,image/*';
      
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
        
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Data = (reader.result as string).split(',')[1];
          await uploadDocument(docType, base64Data, ext, file.name);
        };
        reader.onerror = () => {
          setNotification({ type: 'error', message: 'Failed to read file' });
        };
        reader.readAsDataURL(file);
      };
      
      input.click();
    } else {
      // Native: show options
      Alert.alert(
        'Upload Document',
        'Choose how to upload',
        [
          { text: 'Take Photo', onPress: () => pickImage(docType, 'camera') },
          { text: 'Choose from Gallery', onPress: () => pickImage(docType, 'library') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const pickImage = async (docType: string, source: 'camera' | 'library') => {
    try {
      let result;
      
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          setNotification({ type: 'error', message: 'Camera permission required' });
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: true,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: true,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        let base64Data = asset.base64 || '';
        
        if (!base64Data && asset.uri) {
          base64Data = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: 'base64',
          });
        }

        const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
        await uploadDocument(docType, base64Data, ext, `${docType}.${ext}`);
      }
    } catch (error: any) {
      console.error('Pick image error:', error);
      setNotification({ type: 'error', message: error.message || 'Failed to pick image' });
    }
  };

  const uploadDocument = async (docType: string, base64Data: string, ext: string, fileName: string) => {
    if (!user?.id) return;

    setUploadingDoc(docType);

    try {
      const response = await fetch(api.uploadTeacherDocument(user.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document: base64Data,
          fileExtension: ext,
          documentType: docType,
          fileName,
        }),
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server error: ${text.substring(0, 100)}`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setDocuments(data.documents || []);
      setNotification({ type: 'success', message: 'Document uploaded successfully!' });
    } catch (error: any) {
      console.error('Upload error:', error);
      setNotification({ type: 'error', message: error.message || 'Failed to upload' });
    } finally {
      setUploadingDoc(null);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return <TeacherDashboardSkeleton />;
  }

  if (!profile) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="alert-circle-outline" size={64} color="#9CA3AF" style={{ marginBottom: 16 }} />
        <ThemedText style={styles.errorText}>Teacher Profile Not Found</ThemedText>
        <ThemedText style={styles.errorSubtext}>
          Your teacher record may not exist. Please sign up again.
        </ThemedText>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.replace('/role-selection')}>
          <ThemedText style={styles.retryButtonText}>Go to Sign Up</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View>
              <ThemedText style={styles.greetingText}>{getGreeting()},</ThemedText>
              <ThemedText style={styles.userNameText}>{profile.full_name}</ThemedText>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => router.push('/(teacher)/notifications')}
              >
                <Ionicons name="notifications-outline" size={24} color="#1F2937" />
                {notificationCount > 0 && <View style={styles.notificationDot} />}
              </TouchableOpacity>
                <TouchableOpacity 
                style={styles.profileButton}
                onPress={() => router.push('/(teacher)/my-profile')}
                >
                {profile.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={styles.profileImage}
                  />
                ) : (
                  <Image
                    source={{
                      uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || 'T')}&background=FF6B6B&color=fff`,
                    }}
                    style={styles.profileImage}
                  />
                )}
                </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Notification Banner */}
        {notification && (
          <View style={[
            styles.notificationBanner,
            notification.type === 'success' ? styles.successBanner : styles.errorBanner
          ]}>
            <Ionicons 
              name={notification.type === 'success' ? 'checkmark-circle' : 'alert-circle'} 
              size={18} 
              color="#fff" 
            />
            <ThemedText style={styles.notificationText}>{notification.message}</ThemedText>
          </View>
        )}

        {/* Verification Section - Shows when pending */}
        {profile.verification_status === 'pending' && (
          <View style={styles.verificationSection}>
            <LinearGradient
              colors={['#FEF3C7', '#FDE68A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.verificationCard}
            >
              <View style={styles.verificationHeader}>
                <View style={styles.verificationIconCircle}>
                  <Ionicons name="shield-checkmark-outline" size={28} color="#D97706" />
                </View>
                <View style={styles.verificationHeaderText}>
                  <ThemedText style={styles.verificationTitle}>Complete Your Verification</ThemedText>
                  <ThemedText style={styles.verificationSubtitle}>
                    Upload documents to get verified and start teaching
                  </ThemedText>
                </View>
              </View>

              {/* Document Upload Cards */}
              <View style={styles.documentsGrid}>
                {REQUIRED_DOCUMENTS.map((doc) => {
                  const uploadedDoc = getDocumentForType(doc.type);
                  const isUploading = uploadingDoc === doc.type;

                  return (
                    <TouchableOpacity
                      key={doc.type}
                      style={[
                        styles.documentUploadCard,
                        uploadedDoc && styles.documentUploaded
                      ]}
                      onPress={() => handleDocumentUpload(doc.type)}
                      disabled={isUploading}
                      activeOpacity={0.7}
                    >
                      {isUploading ? (
                        <ActivityIndicator size="small" color="#D97706" />
                      ) : uploadedDoc ? (
                        <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                      ) : (
                        <Ionicons name={doc.icon as any} size={24} color="#D97706" />
                      )}
                      <ThemedText style={[
                        styles.documentUploadLabel,
                        uploadedDoc && styles.documentUploadLabelDone
                      ]}>
                        {uploadedDoc ? 'Uploaded ✓' : doc.label}
                      </ThemedText>
                      {!uploadedDoc && (
                        <ThemedText style={styles.documentUploadHint}>Tap to upload</ThemedText>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Progress indicator */}
              <View style={styles.verificationProgress}>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${(documents.length / REQUIRED_DOCUMENTS.length) * 100}%` }
                    ]} 
                  />
                </View>
                <ThemedText style={styles.progressText}>
                  {documents.length}/{REQUIRED_DOCUMENTS.length} documents uploaded
                </ThemedText>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Rejection Section - Shows when rejected */}
        {profile.verification_status === 'rejected' && (
          <View style={styles.verificationSection}>
            <LinearGradient
              colors={['#FEE2E2', '#FECACA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.verificationCard}
            >
              <View style={styles.verificationHeader}>
                <View style={[styles.verificationIconCircle, { backgroundColor: '#FCA5A5' }]}>
                  <Ionicons name="close-circle-outline" size={28} color="#DC2626" />
                </View>
                <View style={styles.verificationHeaderText}>
                  <ThemedText style={[styles.verificationTitle, { color: '#DC2626' }]}>
                    Verification Rejected
                  </ThemedText>
                  <ThemedText style={[styles.verificationSubtitle, { color: '#7F1D1D' }]}>
                    Please review the feedback and re-upload your documents
                  </ThemedText>
                </View>
              </View>

              {/* Rejection Reason */}
              {profile.rejection_reason && (
                <View style={styles.rejectionReasonBox}>
                  <View style={styles.rejectionReasonHeader}>
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color="#DC2626" />
                    <ThemedText style={styles.rejectionReasonTitle}>Admin Feedback</ThemedText>
                  </View>
                  <ThemedText style={styles.rejectionReasonText}>
                    {profile.rejection_reason}
                  </ThemedText>
                </View>
              )}

              {/* Document Upload Cards - Allow re-upload */}
              <View style={styles.documentsGrid}>
                {REQUIRED_DOCUMENTS.map((doc) => {
                  const uploadedDoc = getDocumentForType(doc.type);
                  const isUploading = uploadingDoc === doc.type;

                  return (
                    <TouchableOpacity
                      key={doc.type}
                      style={[
                        styles.documentUploadCard,
                        { backgroundColor: '#fff', borderColor: '#FECACA' }
                      ]}
                      onPress={() => handleDocumentUpload(doc.type)}
                      disabled={isUploading}
                      activeOpacity={0.7}
                    >
                      {isUploading ? (
                        <ActivityIndicator size="small" color="#DC2626" />
                      ) : uploadedDoc ? (
                        <Ionicons name="refresh-circle" size={24} color="#DC2626" />
                      ) : (
                        <Ionicons name={doc.icon as any} size={24} color="#DC2626" />
                      )}
                      <ThemedText style={[styles.documentUploadLabel, { color: '#7F1D1D' }]}>
                        {uploadedDoc ? 'Re-upload' : doc.label}
                      </ThemedText>
                      <ThemedText style={[styles.documentUploadHint, { color: '#9CA3AF' }]}>
                        Tap to {uploadedDoc ? 're-upload' : 'upload'}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Progress indicator */}
              <View style={styles.verificationProgress}>
                <View style={[styles.progressBar, { backgroundColor: '#FCA5A5' }]}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${(documents.length / REQUIRED_DOCUMENTS.length) * 100}%`, backgroundColor: '#DC2626' }
                    ]} 
                  />
                </View>
                <ThemedText style={[styles.progressText, { color: '#7F1D1D' }]}>
                  {documents.length}/{REQUIRED_DOCUMENTS.length} documents uploaded
                </ThemedText>
              </View>
            </LinearGradient>
          </View>
        )}

        <View style={styles.contentContainer}>
          {/* 1. Main Stats Card */}
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={styles.sectionTitle}>Overview</ThemedText>
          </View>

          <LinearGradient
            colors={['#FF6B6B', '#EE5A24']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.mainStatsCard}
          >
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="people" size={20} color="#FFF" />
                </View>
                <ThemedText style={styles.statValueBig}>{stats.totalStudents}</ThemedText>
                <ThemedText style={styles.statLabelLight}>Active Students</ThemedText>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="wallet" size={20} color="#FFF" />
                </View>
                <ThemedText style={styles.statValueBig}>${stats.totalEarnings}</ThemedText>
                <ThemedText style={styles.statLabelLight}>Total Earnings</ThemedText>
              </View>
            </View>
          </LinearGradient>

          {/* 2. Secondary Stats Grid */}
          <View style={styles.gridContainer}>
            <View style={styles.gridCard}>
              <View style={[styles.gridIcon, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="checkmark-circle" size={20} color="#0284C7" />
              </View>
              <ThemedText style={styles.gridValue}>{stats.completedClasses}</ThemedText>
              <ThemedText style={styles.gridLabel}>Completed Classes</ThemedText>
            </View>

            <View style={styles.gridCard}>
              <View style={[styles.gridIcon, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="calendar" size={20} color="#9333EA" />
              </View>
              <ThemedText style={styles.gridValue}>{stats.upcomingClasses}</ThemedText>
              <ThemedText style={styles.gridLabel}>Upcoming Classes</ThemedText>
            </View>
          </View>

          {/* 3. Profile Summary */}
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={styles.sectionTitle}>Profile Details</ThemedText>
            <TouchableOpacity style={styles.editLinkBtn} onPress={() => router.push('/(teacher)/edit-profile')}>
              <ThemedText style={styles.editLinkText}>Edit</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.profileDetailRow}>
              <View style={styles.detailIconBox}>
                <Ionicons name="star" size={18} color="#F59E0B" />
              </View>
              <View style={styles.detailTextContainer}>
                <ThemedText style={styles.detailLabel}>Rating</ThemedText>
                <ThemedText style={styles.detailValue}>
                  {profile.rating > 0 ? `${profile.rating.toFixed(1)} / 5.0` : 'New Teacher'}
                </ThemedText>
              </View>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.profileDetailRow}>
              <View style={styles.detailIconBox}>
                <Ionicons name="pricetag" size={18} color="#10B981" />
              </View>
              <View style={styles.detailTextContainer}>
                <ThemedText style={styles.detailLabel}>Hourly Rate</ThemedText>
                <ThemedText style={styles.detailValue}>${profile.hourly_rate || 0}/hr</ThemedText>
              </View>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.profileDetailRow}>
              <View style={styles.detailIconBox}>
                <Ionicons name="book" size={18} color="#3B82F6" />
              </View>
              <View style={styles.detailTextContainer}>
                <ThemedText style={styles.detailLabel}>Subjects</ThemedText>
                <ThemedText style={styles.detailValue} numberOfLines={1}>
                  {profile.subjects && profile.subjects.length > 0 ? profile.subjects.join(', ') : 'None listed'}
                </ThemedText>
              </View>
            </View>
          </View>

          {/* 4. Availability Summary */}
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={styles.sectionTitle}>Weekly Availability</ThemedText>
          </View>
          <View style={styles.availabilityCard}>
            {profile.availability && Object.keys(profile.availability).length > 0 ? (
              Object.entries(profile.availability).slice(0, 3).map(([day, slots]: [string, any[]]) => (
                <View key={day} style={styles.availabilityRow}>
                  <View style={styles.dayBadge}>
                    <ThemedText style={styles.dayText}>{day.substring(0, 3)}</ThemedText>
                  </View>
                  <ThemedText style={styles.availabilitySlots} numberOfLines={1}>
                    {slots.length > 0 ? slots.map((t: any) => formatTime12h(String(t))).join(', ') : 'No slots'}
                  </ThemedText>
                </View>
              ))
            ) : (
              <View style={styles.emptyAvailability}>
                <Ionicons name="calendar-outline" size={24} color="#9CA3AF" />
                <ThemedText style={styles.availabilityNone}>No availability set yet.</ThemedText>
              </View>
            )}
            {profile.availability && Object.keys(profile.availability).length > 3 && (
              <ThemedText style={styles.moreDaysText}>
                + {Object.keys(profile.availability).length - 3} more days configured
              </ThemedText>
            )}
          </View>

          {/* 5. Quick Actions */}
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={styles.sectionTitle}>Quick Actions</ThemedText>
          </View>

          <View style={styles.actionsList}>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(teacher)/availability')}>
              <View style={styles.actionIcon}>
                <Ionicons name="time-outline" size={24} color="#FF6B6B" />
              </View>
              <View style={styles.actionContent}>
                <ThemedText style={styles.actionTitle}>Manage Availability</ThemedText>
                <ThemedText style={styles.actionDesc}>Set your teaching schedule</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(teacher)/students')}>
              <View style={styles.actionIcon}>
                <Ionicons name="people-outline" size={24} color="#FF6B6B" />
              </View>
              <View style={styles.actionContent}>
                <ThemedText style={styles.actionTitle}>My Students</ThemedText>
                <ThemedText style={styles.actionDesc}>View enrolled students</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Header Styles */
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
    fontWeight: '500',
  },
  userNameText: {
    fontSize: 22,
    fontFamily: Fonts.rounded,
    fontWeight: '700',
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },

  /* Banners */
  bannerContainer: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusIconWarning: {
    marginRight: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#9A3412',
    fontWeight: '500',
    lineHeight: 18,
  },

  /* Main Content */
  contentContainer: {
    padding: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  editLinkBtn: {
    padding: 4,
  },
  editLinkText: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '600',
  },

  /* Stats Card */
  mainStatsCard: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIconContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValueBig: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  statLabelLight: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 16,
  },

  /* Secondary Grid */
  gridContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  gridCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'flex-start',
  },
  gridIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gridValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  gridLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },

  /* Profile Card */
  profileCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 24,
  },
  profileDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
    marginLeft: 52,
  },

  /* Availability Card */
  availabilityCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 24,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayBadge: {
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 12,
    width: 50,
    alignItems: 'center',
  },
  dayText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF6B6B',
    textTransform: 'uppercase',
  },
  availabilitySlots: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  emptyAvailability: {
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  availabilityNone: {
    color: '#9CA3AF',
    fontStyle: 'italic',
    fontSize: 14,
  },
  moreDaysText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },

  /* Actions List */
  actionsList: {
    gap: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 13,
    color: '#6B7280',
  },

  /* Error/Loading Utilities */
  bottomPadding: {
    height: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  retryButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  /* Notification Banner */
  notificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
  },
  successBanner: {
    backgroundColor: '#10B981',
  },
  errorBanner: {
    backgroundColor: '#EF4444',
  },
  notificationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },

  /* Verification Section */
  verificationSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  verificationCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  verificationIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  verificationHeaderText: {
    flex: 1,
  },
  verificationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  verificationSubtitle: {
    fontSize: 13,
    color: '#A16207',
  },
  documentsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  documentUploadCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    borderWidth: 2,
    borderColor: 'transparent',
    borderStyle: 'dashed',
  },
  documentUploaded: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
    borderStyle: 'solid',
  },
  documentUploadLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    textAlign: 'center',
    marginTop: 8,
  },
  documentUploadLabelDone: {
    color: '#059669',
  },
  documentUploadHint: {
    fontSize: 10,
    color: '#B45309',
    marginTop: 4,
  },
  verificationProgress: {
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
  rejectionReasonBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rejectionReasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  rejectionReasonTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  rejectionReasonText: {
    fontSize: 14,
    color: '#7F1D1D',
    lineHeight: 20,
  },
});
