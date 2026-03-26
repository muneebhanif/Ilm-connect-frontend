import React, { useEffect, useState } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView,
  Platform,
  Modal,
  Alert
} from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/config';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

interface Document {
  type: string;
  url: string;
  fileName: string;
  uploadedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

const REQUIRED_DOCUMENTS = [
  { type: 'id_proof', label: 'ID Proof (CNIC/Passport)', icon: 'card-outline' },
  { type: 'qualification', label: 'Qualification Certificate', icon: 'school-outline' },
  { type: 'experience', label: 'Experience Letter (Optional)', icon: 'briefcase-outline', optional: true },
];

export default function WaitingVerification() {
  const { user, refreshSession } = useAuth();
  const [status, setStatus] = useState<string | null>(user?.verification_status || null);
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // Fetch profile and documents
        const [profileRes, docsRes] = await Promise.all([
          fetch(api.teacherProfile(user.id)),
          fetch(api.getTeacherDocuments(user.id))
        ]);
        
        if (profileRes.ok) {
          const data = await profileRes.json();
          if (mounted) setStatus(data.profile?.verification_status || null);
        }
        
        if (docsRes.ok) {
          const docsData = await docsRes.json();
          if (mounted) setDocuments(docsData.documents || []);
        }
      } catch (e) {
        console.error('Error polling:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    poll();
    const t = setInterval(poll, 30000); // Poll every 30 seconds
    return () => { mounted = false; clearInterval(t); };
  }, [user]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
  };

  const getDocumentForType = (type: string): Document | undefined => {
    return documents.find(doc => doc.type === type);
  };

  const handleDocumentUpload = (docType: string) => {
    setSelectedDocType(docType);
    if (Platform.OS === 'web') {
      setShowPickerModal(true);
    } else {
      Alert.alert(
        'Upload Document',
        'Choose how to upload your document',
        [
          { text: 'Take Photo', onPress: () => pickImage(docType, 'camera') },
          { text: 'Choose Image', onPress: () => pickImage(docType, 'library') },
          { text: 'Choose PDF', onPress: () => pickDocument(docType) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const pickImage = async (docType: string, source: 'camera' | 'library') => {
    try {
      // On web for library, use native file input for better compatibility
      if (Platform.OS === 'web' && source === 'library') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (!file) return;
          
          const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
          
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Data = (reader.result as string).split(',')[1];
            await uploadDocument(docType, base64Data, ext, file.name);
          };
          reader.onerror = () => {
            showNotification('error', 'Failed to read file');
          };
          reader.readAsDataURL(file);
        };
        
        input.click();
        setShowPickerModal(false);
        return;
      }

      let result;
      
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          showNotification('error', 'Camera permission is required');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: Platform.OS !== 'web',
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: Platform.OS !== 'web',
        });
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        let base64Data: string;
        
        if (Platform.OS === 'web') {
          // Web: fetch blob and convert to base64
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } else {
          base64Data = asset.base64 || '';
          if (!base64Data && asset.uri) {
            base64Data = await FileSystem.readAsStringAsync(asset.uri, {
              encoding: 'base64',
            });
          }
        }

        const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
        await uploadDocument(docType, base64Data, ext, `${docType}.${ext}`);
      }
    } catch (error: any) {
      console.error('Image pick error:', error);
      showNotification('error', error.message || 'Failed to pick image');
    }
  };

  const pickDocument = async (docType: string) => {
    try {
      if (Platform.OS === 'web') {
        // On web, create a file input and trigger click
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
            showNotification('error', 'Failed to read file');
          };
          reader.readAsDataURL(file);
        };
        
        input.click();
        setShowPickerModal(false);
        return;
      }

      // Native platforms
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const ext = asset.name.split('.').pop()?.toLowerCase() || 'pdf';
        
        const base64Data = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: 'base64',
        });

        await uploadDocument(docType, base64Data, ext, asset.name);
      }
    } catch (error: any) {
      console.error('Document pick error:', error);
      showNotification('error', error.message || 'Failed to pick document');
    }
  };

  const uploadDocument = async (docType: string, base64Data: string, ext: string, fileName: string) => {
    if (!user?.id) return;

    setUploading(docType);
    setShowPickerModal(false);

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
      showNotification('success', 'Document uploaded successfully!');
    } catch (error: any) {
      console.error('Upload error:', error);
      showNotification('error', error.message || 'Failed to upload document');
    } finally {
      setUploading(null);
    }
  };

  const getStatusColor = (docStatus: string) => {
    switch (docStatus) {
      case 'approved': return '#10B981';
      case 'rejected': return '#EF4444';
      default: return '#F59E0B';
    }
  };

  const getStatusIcon = (docStatus: string) => {
    switch (docStatus) {
      case 'approved': return 'checkmark-circle';
      case 'rejected': return 'close-circle';
      default: return 'time';
    }
  };

  const requiredDocsUploaded = REQUIRED_DOCUMENTS
    .filter(d => !d.optional)
    .every(d => getDocumentForType(d.type));

  return (
    <ThemedView style={styles.container}>
      {/* Notification Banner */}
      {notification && (
        <View style={[
          styles.notificationBanner,
          notification.type === 'success' ? styles.successBanner : styles.errorBanner
        ]}>
          <Ionicons 
            name={notification.type === 'success' ? 'checkmark-circle' : 'alert-circle'} 
            size={20} 
            color="#fff" 
          />
          <ThemedText style={styles.notificationText}>{notification.message}</ThemedText>
        </View>
      )}

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons 
              name={status === 'verified' ? 'checkmark-circle' : 'hourglass-outline'} 
              size={48} 
              color={status === 'verified' ? '#10B981' : '#FF6B6B'} 
            />
          </View>
          <ThemedText style={styles.title}>
            {status === 'verified' ? 'Account Verified!' : 'Verification Pending'}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {status === 'verified' 
              ? 'Your account has been verified. You can now access all features.'
              : 'Upload your documents below to complete verification. Our team will review them shortly.'}
          </ThemedText>
        </View>

        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <ThemedText style={styles.statusLabel}>Current Status:</ThemedText>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status || 'pending') + '20' }]}>
              <Ionicons name={getStatusIcon(status || 'pending') as any} size={16} color={getStatusColor(status || 'pending')} />
              <ThemedText style={[styles.statusText, { color: getStatusColor(status || 'pending') }]}>
                {(status || 'pending').charAt(0).toUpperCase() + (status || 'pending').slice(1)}
              </ThemedText>
            </View>
          </View>
          {loading && <ActivityIndicator size="small" color="#FF6B6B" style={{ marginTop: 8 }} />}
        </View>

        {/* Documents Section */}
        {status !== 'verified' && (
          <View style={styles.documentsSection}>
            <ThemedText style={styles.sectionTitle}>Required Documents</ThemedText>
            <ThemedText style={styles.sectionSubtitle}>
              Upload the following documents to verify your identity and qualifications
            </ThemedText>

            {REQUIRED_DOCUMENTS.map((doc) => {
              const uploadedDoc = getDocumentForType(doc.type);
              const isUploading = uploading === doc.type;

              return (
                <View key={doc.type} style={styles.documentCard}>
                  <View style={styles.documentHeader}>
                    <View style={styles.documentInfo}>
                      <View style={[styles.documentIcon, uploadedDoc && { backgroundColor: getStatusColor(uploadedDoc.status) + '20' }]}>
                        <Ionicons 
                          name={doc.icon as any} 
                          size={24} 
                          color={uploadedDoc ? getStatusColor(uploadedDoc.status) : '#6B7280'} 
                        />
                      </View>
                      <View style={styles.documentText}>
                        <ThemedText style={styles.documentLabel}>{doc.label}</ThemedText>
                        {uploadedDoc ? (
                          <View style={styles.uploadedInfo}>
                            <Ionicons 
                              name={getStatusIcon(uploadedDoc.status) as any} 
                              size={14} 
                              color={getStatusColor(uploadedDoc.status)} 
                            />
                            <ThemedText style={[styles.uploadedStatus, { color: getStatusColor(uploadedDoc.status) }]}>
                              {uploadedDoc.status.charAt(0).toUpperCase() + uploadedDoc.status.slice(1)}
                            </ThemedText>
                          </View>
                        ) : (
                          <ThemedText style={styles.notUploaded}>
                            {doc.optional ? 'Optional' : 'Not uploaded'}
                          </ThemedText>
                        )}
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity 
                    style={[
                      styles.uploadButton,
                      uploadedDoc && styles.reuploadButton,
                      isUploading && styles.uploadingButton
                    ]}
                    onPress={() => handleDocumentUpload(doc.type)}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons 
                          name={uploadedDoc ? 'refresh-outline' : 'cloud-upload-outline'} 
                          size={18} 
                          color="#fff" 
                        />
                        <ThemedText style={styles.uploadButtonText}>
                          {uploadedDoc ? 'Re-upload' : 'Upload'}
                        </ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}

            {!requiredDocsUploaded && (
              <View style={styles.warningBox}>
                <Ionicons name="information-circle-outline" size={20} color="#F59E0B" />
                <ThemedText style={styles.warningText}>
                  Please upload all required documents to complete verification
                </ThemedText>
              </View>
            )}
          </View>
        )}

        {/* Refresh Button */}
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={refreshSession}
        >
          <Ionicons name="refresh-outline" size={20} color="#FF6B6B" />
          <ThemedText style={styles.refreshButtonText}>Refresh Status</ThemedText>
        </TouchableOpacity>
      </ScrollView>

      {/* Web Modal for Document Picker */}
      <Modal
        visible={showPickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Upload Document</ThemedText>
            <ThemedText style={styles.modalSubtitle}>Choose how to upload your document</ThemedText>
            
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => selectedDocType && pickImage(selectedDocType, 'library')}
            >
              <Ionicons name="image-outline" size={24} color="#FF6B6B" />
              <ThemedText style={styles.modalOptionText}>Choose Image</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => selectedDocType && pickDocument(selectedDocType)}
            >
              <Ionicons name="document-outline" size={24} color="#FF6B6B" />
              <ThemedText style={styles.modalOptionText}>Choose PDF</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalCancel}
              onPress={() => setShowPickerModal(false)}
            >
              <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFB' 
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  notificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    gap: 8,
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
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  title: { 
    fontSize: 24, 
    fontWeight: '700', 
    marginBottom: 8,
    color: '#1F2937',
  },
  subtitle: { 
    fontSize: 14, 
    color: '#6B7280', 
    textAlign: 'center', 
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  statusRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  statusText: { 
    fontSize: 14, 
    fontWeight: '600',
  },
  documentsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  documentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentText: {
    flex: 1,
  },
  documentLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  uploadedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  uploadedStatus: {
    fontSize: 13,
    fontWeight: '500',
  },
  notUploaded: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  reuploadButton: {
    backgroundColor: '#6B7280',
  },
  uploadingButton: {
    opacity: 0.7,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 14,
    borderRadius: 10,
    gap: 10,
    marginTop: 8,
  },
  warningText: {
    fontSize: 13,
    color: '#92400E',
    flex: 1,
  },
  refreshButton: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14, 
    paddingHorizontal: 24, 
    borderRadius: 12, 
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#FF6B6B',
    gap: 8,
  },
  refreshButtonText: { 
    color: '#FF6B6B', 
    fontWeight: '600',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  modalCancel: {
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
});
