import { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, FlatList, TextInput, TouchableOpacity, Platform, KeyboardAvoidingView, Image, Alert, Modal, ActivityIndicator, SafeAreaView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { BackButton } from '@/components/back-button';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/config';
import { authFetch } from '@/lib/auth-fetch';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

// Validation constants
const MAX_MESSAGE_LENGTH = 2000;
const MAX_IMAGE_SIZE_MB = 10;
const ALLOWED_IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  image_url?: string;
  message_type?: 'text' | 'image' | 'payment_screenshot';
}

export default function ChatScreen() {
  const { id, name, avatar } = useLocalSearchParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Validation function
  const validateImage = (uri: string, fileSize?: number): { valid: boolean; error?: string } => {
    if (uri.startsWith('blob:') || uri.startsWith('data:image')) {
      if (fileSize && fileSize > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        return { valid: false, error: `Image too large. Maximum ${MAX_IMAGE_SIZE_MB}MB` };
      }
      return { valid: true };
    }

    const extension = uri.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_IMAGE_TYPES.includes(extension)) {
      return { valid: false, error: `Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}` };
    }

    if (fileSize && fileSize > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      return { valid: false, error: `Image too large. Maximum ${MAX_IMAGE_SIZE_MB}MB` };
    }

    return { valid: true };
  };

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const validation = validateImage(asset.uri, asset.fileSize);
        
        if (!validation.valid) {
          Alert.alert('Invalid Image', validation.error);
          return;
        }
        setSelectedImage(asset.uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow camera access');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const showImageOptions = () => {
    if (Platform.OS === 'web') {
      pickImage();
    } else {
      Alert.alert(
        'Send Image',
        'Choose an option',
        [
          { text: 'Camera', onPress: takePhoto },
          { text: 'Photo Library', onPress: pickImage },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const sendImageMessage = async (isPaymentScreenshot: boolean = false) => {
    if (!selectedImage || sending) return;

    setSending(true);
    try {
      let base64Image: string;
      let fileExtension = 'jpg';

      if (Platform.OS === 'web') {
        const response = await fetch(selectedImage);
        const blob = await response.blob();
        base64Image = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        const mimeMatch = base64Image.match(/data:image\/(\w+);/);
        if (mimeMatch) {
          fileExtension = mimeMatch[1] === 'jpeg' ? 'jpg' : mimeMatch[1];
        }
      } else {
        const uriParts = selectedImage.split('.');
        fileExtension = uriParts[uriParts.length - 1]?.toLowerCase() || 'jpg';
        const rawBase64 = await FileSystem.readAsStringAsync(selectedImage, {
          encoding: 'base64',
        });
        base64Image = `data:image/${fileExtension};base64,${rawBase64}`;
      }

      const caption = newMessage.trim() || (isPaymentScreenshot ? 'Payment Screenshot' : '');

      const response = await authFetch(api.messages.send(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_id: id,
          content: caption,
          image: base64Image,
          fileExtension,
          message_type: isPaymentScreenshot ? 'payment_screenshot' : 'image',
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send image');
      }

      if (data.message) {
        setMessages([...messages, data.message]);
        setSelectedImage(null);
        setNewMessage('');
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error: any) {
      console.error('Error sending image:', error);
      Alert.alert('Error', error.message || 'Failed to send image');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    markMessagesAsRead();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [id, user?.id]);

  const markMessagesAsRead = async () => {
    if (!id) return;
    try {
      await authFetch(api.messages.markRead(id as string), { method: 'PUT' });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const fetchMessages = async () => {
    if (!id) return;
    try {
      const response = await authFetch(api.messages.conversation(id as string));
      const data = await response.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    if (newMessage.length > MAX_MESSAGE_LENGTH) {
      Alert.alert('Message Too Long', `Maximum ${MAX_MESSAGE_LENGTH} characters allowed`);
      return;
    }

    setSending(true);
    try {
      const response = await authFetch(api.messages.send(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_id: id,
          content: newMessage.trim(),
          message_type: 'text',
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      if (data.message) {
        setMessages([...messages, data.message]);
        setNewMessage('');
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      Alert.alert('Error', error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString(undefined, { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender_id === user?.id;
    const showDateHeader = index === 0 || 
      new Date(item.created_at).toDateString() !== 
      new Date(messages[index - 1].created_at).toDateString();
    const hasImage = !!item.image_url;
    const isPaymentScreenshot = item.message_type === 'payment_screenshot';

    return (
      <View>
        {showDateHeader && (
          <View style={styles.dateHeaderContainer}>
            <View style={styles.dateHeader}>
              <ThemedText style={styles.dateHeaderText}>
                {formatDateHeader(item.created_at)}
              </ThemedText>
            </View>
          </View>
        )}
        <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.theirMessageRow]}>
          <View style={[
            styles.messageBubble, 
            isMe ? styles.myMessage : styles.theirMessage,
            hasImage && styles.imageBubblePadding
          ]}>
            {/* Payment Screenshot Badge */}
            {isPaymentScreenshot && (
              <View style={[styles.paymentBadge, isMe ? styles.paymentBadgeMe : styles.paymentBadgeThem]}>
                <Ionicons name="receipt-outline" size={12} color={isMe ? '#FFF' : '#4ECDC4'} />
                <ThemedText style={[styles.paymentBadgeText, isMe && { color: '#FFF' }]}>
                  Payment Screenshot
                </ThemedText>
              </View>
            )}
            
            {/* Image Content */}
            {hasImage && (
              <TouchableOpacity 
                onPress={() => {
                  setPreviewImageUrl(item.image_url!);
                  setImagePreviewVisible(true);
                }}
                activeOpacity={0.9}
                style={styles.imageContainer}
              >
                <Image 
                  source={{ uri: item.image_url }} 
                  style={styles.messageImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}
            
            {/* Text Content */}
            {item.content && !item.content.startsWith('📷') && (
              <ThemedText style={[
                styles.messageText, 
                isMe ? styles.myMessageText : styles.theirMessageText,
                (hasImage || isPaymentScreenshot) && styles.textWithAttachment
              ]}>
                {item.content}
              </ThemedText>
            )}
            
            {/* Metadata (Time + Checkmarks) */}
            <View style={styles.metadataContainer}>
              <ThemedText style={[styles.timeText, isMe ? styles.myTimeText : styles.theirTimeText]}>
                {formatTime(item.created_at)}
              </ThemedText>
              {isMe && (
                <Ionicons 
                  name={item.is_read ? "checkmark-done" : "checkmark"} 
                  size={14} 
                  color="rgba(255,255,255,0.9)" 
                  style={styles.readIcon}
                />
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerContent}>
          {avatar ? (
            <Image 
              source={{ uri: avatar as string }} 
              style={styles.headerAvatarImage}
            />
          ) : (
            <View style={styles.headerAvatar}>
              <ThemedText style={styles.headerAvatarText}>
                {(name as string)?.charAt(0)?.toUpperCase() || 'U'}
              </ThemedText>
            </View>
          )}
          <View>
            <ThemedText style={styles.headerTitle} numberOfLines={1}>
              {name || 'Chat'}
            </ThemedText>
            <ThemedText style={styles.headerStatus}>
              Online
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ECDC4" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="chatbubbles-outline" size={32} color="#9CA3AF" />
              </View>
              <ThemedText style={styles.emptyText}>No messages yet</ThemedText>
              <ThemedText style={styles.emptySubtext}>Say hello to start the conversation!</ThemedText>
            </View>
          }
        />
      )}

      {/* Input Area */}
      <View style={styles.inputWrapper}>
        <View style={styles.inputContainer}>
          <TouchableOpacity 
            style={styles.attachButton}
            onPress={showImageOptions}
            disabled={sending}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={24} color="#6B7280" />
          </TouchableOpacity>
          
          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor="#9CA3AF"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
          />
          
          <TouchableOpacity 
            style={[
              styles.sendButton, 
              (!newMessage.trim() && !sending) ? styles.sendButtonInactive : {}
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Image Upload Preview Modal (ChatGPT Style) */}
      <Modal
        visible={!!selectedImage}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedImage(null)}
      >
        <SafeAreaView style={styles.uploadPreviewContainer}>
          <View style={styles.uploadPreviewHeader}>
            <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.iconButton}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <ThemedText style={styles.uploadPreviewTitle}>Send Image</ThemedText>
            <View style={styles.placeholderIcon} />
          </View>

          <View style={styles.uploadImageWrapper}>
            {selectedImage && (
              <Image 
                source={{ uri: selectedImage }} 
                style={styles.uploadImage}
                resizeMode="contain"
              />
            )}
          </View>

          <View style={styles.uploadFooter}>
             <TextInput
              style={styles.uploadCaptionInput}
              placeholder="Add a caption..."
              placeholderTextColor="#9CA3AF"
              value={newMessage}
              onChangeText={setNewMessage}
            />
            
            <View style={styles.uploadActions}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.paymentActionButton]}
                onPress={() => sendImageMessage(true)}
                disabled={sending}
              >
                <Ionicons name="receipt-outline" size={20} color="#FFF" />
                <ThemedText style={styles.actionButtonText}>Send as Payment</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, styles.sendActionButton]}
                onPress={() => sendImageMessage(false)}
                disabled={sending}
              >
                <Ionicons name="send" size={20} color="#FFF" />
                <ThemedText style={styles.actionButtonText}>Send</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Full Screen Image Viewer */}
      <Modal
        visible={imagePreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImagePreviewVisible(false)}
      >
        <View style={styles.fullScreenViewer}>
          <TouchableOpacity 
            style={styles.closeViewerButton}
            onPress={() => setImagePreviewVisible(false)}
          >
            <Ionicons name="close-circle" size={36} color="#FFF" />
          </TouchableOpacity>
          {previewImageUrl && (
            <Image 
              source={{ uri: previewImageUrl }} 
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Slightly darker background for chat contrast
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#F0FDFA',
  },
  headerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#F0FDFA',
  },
  headerAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerStatus: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '500',
  },
  
  // List
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 16,
  },
  
  // Date Header
  dateHeaderContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateHeader: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },

  // Message Bubbles
  messageRow: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  theirMessageRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    position: 'relative',
  },
  myMessage: {
    backgroundColor: '#4ECDC4',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    // Soft shadow for depth instead of border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 4, // Space for timestamp
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: '#1F2937',
  },
  textWithAttachment: {
    marginTop: 4,
  },

  // Images in Chat
  imageBubblePadding: {
    padding: 4,
  },
  imageContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  messageImage: {
    width: 220,
    height: 160,
    borderRadius: 14,
  },

  // Payment Badge
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
    gap: 4,
  },
  paymentBadgeMe: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  paymentBadgeThem: {
    backgroundColor: '#E0F2F1',
  },
  paymentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4ECDC4',
  },

  // Metadata (Timestamp + Read Receipt)
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  myTimeText: {
    color: 'rgba(255,255,255,0.8)',
  },
  theirTimeText: {
    color: '#9CA3AF',
  },
  readIcon: {
    marginTop: 1,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    transform: [{ scaleY: -1 }] // Counteract inverted list if necessary, but here normal list
  },
  emptyIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },

  // Input Area
  inputWrapper: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  attachButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingTop: 8,
    paddingBottom: 8,
    color: '#1F2937',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonInactive: {
    backgroundColor: '#D1D5DB',
  },

  // Upload Preview Modal (Dark Theme)
  uploadPreviewContainer: {
    flex: 1,
    backgroundColor: '#111827',
  },
  uploadPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  uploadPreviewTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  iconButton: {
    padding: 4,
  },
  placeholderIcon: {
    width: 32,
  },
  uploadImageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  uploadImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  uploadFooter: {
    padding: 20,
    backgroundColor: '#1F2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  uploadCaptionInput: {
    backgroundColor: '#374151',
    color: '#FFF',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  uploadActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  paymentActionButton: {
    backgroundColor: '#059669', // Emerald
  },
  sendActionButton: {
    backgroundColor: '#4ECDC4',
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },

  // Full Screen Viewer
  fullScreenViewer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeViewerButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 20,
  },
  fullScreenImage: {
    width: '100%',
    height: '80%',
  },
});