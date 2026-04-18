import { StyleSheet, View, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Platform, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Image } from 'react-native';
import { TeacherCoursesSkeleton } from '@/components/ui/dashboard-skeletons';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/config';
import { authFetch } from '@/lib/auth-fetch';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

interface Course {
  id: string;
  title: string;
  description: string;
  subject: string;
  level: string;
  price: number;
  is_free: boolean;
  status: string;
  total_lessons: number;
  thumbnail_url?: string;
  created_at: string;
}

interface CourseLesson {
  id: string;
  title: string;
  description?: string;
  content_type: 'video' | 'pdf' | 'audio' | 'document' | 'link';
  content_url: string;
  file_name?: string;
  file_size_bytes?: number;
  is_preview?: boolean;
  sort_order?: number;
  status?: string;
  created_at?: string;
}

const SUBJECTS = ['Quran Memorization', 'Tajweed', 'Arabic Language', 'Islamic Studies', 'Fiqh', 'Hadith', 'Seerah'];
const LEVELS = ['beginner', 'intermediate', 'advanced'];

export default function TeacherCoursesScreen() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [uploadingContent, setUploadingContent] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
  const [lessonPreview, setLessonPreview] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);
  const [thumbnailAsset, setThumbnailAsset] = useState<{ uri: string; name: string; mimeType?: string; fileSize?: number } | null>(null);
  const [publishingCourseId, setPublishingCourseId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [level, setLevel] = useState('beginner');
  const [price, setPrice] = useState('0');
  const [isFree, setIsFree] = useState(true);
  const [totalLessons, setTotalLessons] = useState('0');

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useFocusEffect(
    useCallback(() => {
      loadCourses();
    }, [user?.id])
  );

  const loadCourses = async (mode = 'initial') => {
    if (!user?.id) return;
    try {
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);

      const response = await authFetch(api.courses.byTeacher(user.id));
      const data = await response.json();
      if (response.ok) setCourses(data.courses || []);
    } catch (e) {
      console.error('Load courses error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const isLocalAssetUri = (uri?: string | null) => {
    if (!uri) return false;
    return uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('blob:') || uri.startsWith('data:');
  };

  const isCourseReadyToPublish = (course: Course) => !!course.thumbnail_url && Number(course.total_lessons || 0) > 0;

  const publishedCount = courses.filter((course) => course.status === 'published').length;
  const draftCount = courses.filter((course) => course.status !== 'published').length;
  const needsSetupCount = courses.filter((course) => !isCourseReadyToPublish(course)).length;

  const isVideoFile = (fileName: string, mimeType?: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mime = String(mimeType || '').toLowerCase();
    return mime.startsWith('video/') || ['mp4', 'mov', 'm4v', 'webm'].includes(ext);
  };

  const loadCourseLessons = async (courseId: string) => {
    if (!user?.id) return;
    try {
      setLoadingLessons(true);
      const response = await authFetch(api.courses.lessons(courseId, user.id));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load course content');
      setLessons(data.lessons || []);
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Failed to load course content' });
    } finally {
      setLoadingLessons(false);
    }
  };

  const openContentModal = async (course: Course) => {
    setSelectedCourse(course);
    setLessonTitle('');
    setLessonDescription('');
    setLessonPreview(false);
    setSelectedFile(null);
    setContentModalOpen(true);
    await loadCourseLessons(course.id);
  };

  const pickThumbnailImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.status !== 'granted') {
        setNotification({ type: 'error', message: 'Allow photo access to upload a thumbnail' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const sizeMB = (asset.fileSize || 0) / (1024 * 1024);
      if (asset.fileSize && sizeMB > 10) {
        setNotification({ type: 'error', message: `Thumbnail is too large (${sizeMB.toFixed(1)}MB). Maximum size is 10MB.` });
        return;
      }

      setThumbnailAsset({
        uri: asset.uri,
        name: asset.fileName || `thumbnail-${Date.now()}.jpg`,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize,
      });
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Failed to pick thumbnail image' });
    }
  };

  const uploadCourseThumbnail = async (courseId: string) => {
    if (!user?.id || !thumbnailAsset?.uri || !isLocalAssetUri(thumbnailAsset.uri)) {
      return thumbnailAsset?.uri || null;
    }

    let base64Image: string;
    let fileExtension = thumbnailAsset.name?.split('.').pop()?.toLowerCase() || 'jpg';

    if (Platform.OS === 'web') {
      const response = await fetch(thumbnailAsset.uri);
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read selected thumbnail'));
        reader.readAsDataURL(blob);
      });
      base64Image = dataUrl;
      if (!thumbnailAsset.name && thumbnailAsset.mimeType?.includes('/')) {
        fileExtension = thumbnailAsset.mimeType.split('/')[1] || fileExtension;
      }
    } else {
      const rawBase64 = await FileSystem.readAsStringAsync(thumbnailAsset.uri, { encoding: 'base64' });
      const mimeType = thumbnailAsset.mimeType || `image/${fileExtension}`;
      base64Image = `data:${mimeType};base64,${rawBase64}`;
    }

    const uploadResponse = await authFetch(api.uploadCourseThumbnail(user.id, courseId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64Image,
        fileExtension,
      }),
    });

    const uploadData = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok) {
      throw new Error(uploadData.error || 'Failed to upload course thumbnail');
    }

    const thumbnailUrl = String(uploadData.thumbnail_url || '');
    if (thumbnailUrl) {
      setThumbnailAsset({ uri: thumbnailUrl, name: thumbnailAsset.name, mimeType: thumbnailAsset.mimeType, fileSize: thumbnailAsset.fileSize });
    }

    return thumbnailUrl;
  };

  const pickContentFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: ['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm'],
      });

      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!isVideoFile(asset.name || '', asset.mimeType)) {
        setNotification({ type: 'error', message: 'Only video files are allowed (mp4, mov, m4v, webm)' });
        return;
      }

      // Check file size on native
      if (Platform.OS !== 'web') {
        const fileInfo = await FileSystem.getInfoAsync(asset.uri);
        if (fileInfo.exists && fileInfo.size) {
          const sizeMB = fileInfo.size / (1024 * 1024);
          if (sizeMB > 50) {
            setNotification({ type: 'error', message: `Video is too large (${sizeMB.toFixed(1)}MB). Maximum size is 50MB.` });
            return;
          }
        }
      }

      setSelectedFile({
        uri: asset.uri,
        name: asset.name || `content-${Date.now()}`,
        mimeType: asset.mimeType,
      });
      if (!lessonTitle.trim()) {
        setLessonTitle((asset.name || 'Lesson Content').replace(/\.[^/.]+$/, ''));
      }
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Failed to pick file' });
    }
  };

  const uploadLessonContent = async () => {
    if (!user?.id || !selectedCourse?.id) return;
    if (!lessonTitle.trim()) {
      setNotification({ type: 'error', message: 'Lesson title is required' });
      return;
    }
    if (!selectedFile?.uri) {
      setNotification({ type: 'error', message: 'Please choose a file to upload' });
      return;
    }

    setUploadingContent(true);
    try {
      // File size validation (50MB max for videos)
      if (Platform.OS !== 'web') {
        const fileInfo = await FileSystem.getInfoAsync(selectedFile.uri);
        if (fileInfo.exists && fileInfo.size) {
          const sizeMB = fileInfo.size / (1024 * 1024);
          if (sizeMB > 50) {
            setNotification({ type: 'error', message: `Video is too large (${sizeMB.toFixed(1)}MB). Maximum size is 50MB.` });
            setUploadingContent(false);
            return;
          }
        }
      }

      const base64 = await (async () => {
        if (Platform.OS === 'web') {
          const response = await fetch(selectedFile.uri);
          const blob = await response.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Failed to read selected file'));
            reader.readAsDataURL(blob);
          });
          return dataUrl.replace(/^data:[^;]+;base64,/, '');
        }

        return FileSystem.readAsStringAsync(selectedFile.uri, { encoding: 'base64' });
      })();
      const ext = selectedFile.name.split('.').pop()?.toLowerCase() || 'bin';
      const mime = selectedFile.mimeType || 'application/octet-stream';

      const response = await authFetch(api.courses.uploadLesson(selectedCourse.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: user.id,
          title: lessonTitle.trim(),
          description: lessonDescription.trim() || null,
          content: `data:${mime};base64,${base64}`,
          fileExtension: ext,
          fileName: selectedFile.name,
          content_type: 'video',
          is_preview: lessonPreview,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to upload content');

      setNotification({ type: 'success', message: 'Course content uploaded successfully' });
      setLessonTitle('');
      setLessonDescription('');
      setLessonPreview(false);
      setSelectedFile(null);
      await loadCourseLessons(selectedCourse.id);
      await loadCourses('refresh');
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Failed to upload content' });
    } finally {
      setUploadingContent(false);
    }
  };

  const deleteLesson = async (lesson: CourseLesson) => {
    if (!user?.id || !selectedCourse?.id) return;

    const run = async () => {
      try {
        const response = await authFetch(api.courses.deleteLesson(selectedCourse.id, lesson.id), {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teacher_id: user.id }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Failed to delete lesson');
        setNotification({ type: 'success', message: 'Content deleted' });
        await loadCourseLessons(selectedCourse.id);
        await loadCourses('refresh');
      } catch (e: any) {
        setNotification({ type: 'error', message: e?.message || 'Failed to delete lesson' });
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete content "${lesson.title}"?`)) await run();
    } else {
      Alert.alert('Delete Content', `Delete "${lesson.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void run() },
      ]);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSubject(SUBJECTS[0]);
    setLevel('beginner');
    setPrice('0');
    setIsFree(true);
    setTotalLessons('0');
    setThumbnailAsset(null);
    setEditingCourse(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (course: Course) => {
    setEditingCourse(course);
    setTitle(course.title);
    setDescription(course.description || '');
    setSubject(course.subject);
    setLevel(course.level);
    setPrice(String(course.price || 0));
    setIsFree(course.is_free);
    setTotalLessons(String(course.total_lessons || 0));
    setThumbnailAsset(course.thumbnail_url ? { uri: course.thumbnail_url, name: 'current-thumbnail' } : null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!user?.id || !title.trim() || !subject.trim()) {
      setNotification({ type: 'error', message: 'Title and subject are required' });
      return;
    }

    if (!thumbnailAsset?.uri) {
      setNotification({ type: 'error', message: 'Course thumbnail is required' });
      return;
    }

    setSaving(true);
    try {
      const body = {
        teacher_id: user.id,
        title: title.trim(),
        description: description.trim(),
        subject,
        level,
        price: isFree ? 0 : parseFloat(price) || 0,
        is_free: isFree,
        total_lessons: parseInt(totalLessons) || 0,
        ...(!editingCourse ? { status: 'draft' } : {}),
      };

      let response;
      if (editingCourse) {
        response = await authFetch(api.courses.update(editingCourse.id), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        response = await authFetch(api.courses.create(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save course');

      let nextCourse: Course = data.course;
      if (thumbnailAsset?.uri && isLocalAssetUri(thumbnailAsset.uri)) {
        const uploadedThumbnailUrl = await uploadCourseThumbnail(nextCourse.id);
        if (uploadedThumbnailUrl) {
          nextCourse = { ...nextCourse, thumbnail_url: uploadedThumbnailUrl };
        }
      }

      const wasEditing = !!editingCourse;

      setShowModal(false);
      resetForm();
      await loadCourses('refresh');

      if (wasEditing) {
        setNotification({ type: 'success', message: 'Course details updated' });
      } else {
        setNotification({ type: 'success', message: 'Draft created. Upload your first lesson before publishing.' });
        await openContentModal(nextCourse);
      }
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handlePublishCourse = async (course: Course) => {
    if (!user?.id) return;

    if (!course.thumbnail_url) {
      setNotification({ type: 'error', message: 'Upload a thumbnail before publishing this course' });
      openEditModal(course);
      return;
    }

    if ((course.total_lessons || 0) < 1) {
      setNotification({ type: 'error', message: 'Upload at least one video lesson before publishing' });
      await openContentModal(course);
      return;
    }

    try {
      setPublishingCourseId(course.id);
      const response = await authFetch(api.courses.update(course.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: user.id,
          status: 'published',
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to publish course');

      setNotification({ type: 'success', message: 'Course published successfully' });
      await loadCourses('refresh');
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Failed to publish course' });
    } finally {
      setPublishingCourseId(null);
    }
  };

  const handleDelete = (course: Course) => {
    const doDelete = async () => {
      try {
        const response = await authFetch(api.courses.delete(course.id), {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teacher_id: user?.id }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Delete failed');
        }
        setNotification({ type: 'success', message: 'Course deleted' });
        loadCourses();
      } catch (e: any) {
        setNotification({ type: 'error', message: e.message });
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${course.title}"?`)) doDelete();
    } else {
      Alert.alert('Delete Course', `Delete "${course.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const getLevelColor = (lvl: string) => {
    switch (lvl) {
      case 'beginner': return '#10B981';
      case 'intermediate': return '#F59E0B';
      case 'advanced': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getSubjectIcon = (subj: string): string => {
    if (subj.includes('Quran')) return 'book';
    if (subj.includes('Tajweed')) return 'mic';
    if (subj.includes('Arabic')) return 'language';
    if (subj.includes('Fiqh')) return 'library';
    if (subj.includes('Hadith')) return 'document-text';
    return 'school';
  };

  if (loading) {
    return <TeacherCoursesSkeleton />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
        scrollEnabled={!showModal && !contentModalOpen}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadCourses('refresh')} tintColor="#FF6B6B" />
        }
      >
        {/* Header */}
        <LinearGradient
          colors={['#FF6B6B', '#EE5A24']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <View>
              <ThemedText style={styles.headerTitle}>My Courses</ThemedText>
              <ThemedText style={styles.headerSubtitle}>
                {courses.length} course{courses.length !== 1 ? 's' : ''} published
              </ThemedText>
            </View>
            <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
              <Ionicons name="add" size={24} color="#FF6B6B" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Notification Banner */}
        {notification && (
          <View style={[styles.notifBanner, notification.type === 'success' ? styles.successBanner : styles.errorBanner]}>
            <Ionicons name={notification.type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={18} color="#fff" />
            <ThemedText style={styles.notifText}>{notification.message}</ThemedText>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.miniStat, { backgroundColor: '#FEF3C7' }]}>
            <ThemedText style={styles.miniStatValue}>
              {publishedCount}
            </ThemedText>
            <ThemedText style={styles.miniStatLabel}>Published</ThemedText>
          </View>
          <View style={[styles.miniStat, { backgroundColor: '#ECFDF5' }]}>
            <ThemedText style={styles.miniStatValue}>
              {draftCount}
            </ThemedText>
            <ThemedText style={styles.miniStatLabel}>Drafts</ThemedText>
          </View>
          <View style={[styles.miniStat, { backgroundColor: '#EFF6FF' }]}>
            <ThemedText style={styles.miniStatValue}>
              {needsSetupCount}
            </ThemedText>
            <ThemedText style={styles.miniStatLabel}>Need setup</ThemedText>
          </View>
        </View>

        {/* Courses List */}
        <View style={styles.contentPad}>
          {courses.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="library-outline" size={40} color="#D1D5DB" />
              </View>
              <ThemedText style={styles.emptyTitle}>No courses yet</ThemedText>
              <ThemedText style={styles.emptyDesc}>Create your first course to share your knowledge</ThemedText>
              <TouchableOpacity style={styles.emptyButton} onPress={openCreateModal}>
                <Ionicons name="add-circle" size={20} color="#FFF" />
                <ThemedText style={styles.emptyButtonText}>Create Course</ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            courses.map((course) => (
              <View key={course.id} style={styles.courseCard}>
                <View style={styles.courseMediaWrap}>
                  {course.thumbnail_url ? (
                    <Image source={{ uri: course.thumbnail_url }} style={styles.courseThumbnail} />
                  ) : (
                    <LinearGradient colors={['#FFF1F2', '#FFE4E6']} style={styles.courseThumbnailPlaceholder}>
                      <View style={[styles.courseIconWrap, { backgroundColor: '#FFFFFFAA' }]}>
                        <Ionicons name={getSubjectIcon(course.subject) as any} size={22} color={getLevelColor(course.level)} />
                      </View>
                      <ThemedText style={styles.courseThumbnailPlaceholderText}>Thumbnail required</ThemedText>
                    </LinearGradient>
                  )}
                  <View style={[styles.statusBadge, course.status === 'published' ? styles.statusBadgePublished : styles.statusBadgeDraft]}>
                    <Ionicons name={course.status === 'published' ? 'checkmark-circle' : 'time-outline'} size={12} color={course.status === 'published' ? '#065F46' : '#9A3412'} />
                    <ThemedText style={[styles.statusBadgeText, course.status === 'published' ? styles.statusBadgeTextPublished : styles.statusBadgeTextDraft]}>
                      {course.status === 'published' ? 'Published' : 'Draft'}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.courseHeader}>
                  <View style={[styles.courseIconWrap, { backgroundColor: `${getLevelColor(course.level)}15` }]}> 
                    <Ionicons name={getSubjectIcon(course.subject) as any} size={22} color={getLevelColor(course.level)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.courseTitle} numberOfLines={1}>{course.title}</ThemedText>
                    <ThemedText style={styles.courseSubject}>{course.subject}</ThemedText>
                  </View>
                </View>

                {course.description ? (
                  <ThemedText style={styles.courseDesc} numberOfLines={2}>{course.description}</ThemedText>
                ) : null}

                <View style={styles.requirementsRow}>
                  <View style={[styles.requirementChip, course.thumbnail_url ? styles.requirementChipDone : styles.requirementChipPending]}>
                    <Ionicons name={course.thumbnail_url ? 'image' : 'image-outline'} size={12} color={course.thumbnail_url ? '#065F46' : '#9A3412'} />
                    <ThemedText style={[styles.requirementChipText, course.thumbnail_url ? styles.requirementChipTextDone : styles.requirementChipTextPending]}>
                      Thumbnail
                    </ThemedText>
                  </View>
                  <View style={[styles.requirementChip, course.total_lessons > 0 ? styles.requirementChipDone : styles.requirementChipPending]}>
                    <Ionicons name={course.total_lessons > 0 ? 'videocam' : 'videocam-outline'} size={12} color={course.total_lessons > 0 ? '#065F46' : '#9A3412'} />
                    <ThemedText style={[styles.requirementChipText, course.total_lessons > 0 ? styles.requirementChipTextDone : styles.requirementChipTextPending]}>
                      Content
                    </ThemedText>
                  </View>
                </View>

                {!isCourseReadyToPublish(course) ? (
                  <ThemedText style={styles.requirementHint}>
                    Add a thumbnail and at least one video lesson before publishing this course.
                  </ThemedText>
                ) : null}

                <View style={styles.courseFooter}>
                  <View style={[styles.levelBadge, { backgroundColor: `${getLevelColor(course.level)}15` }]}>
                    <ThemedText style={[styles.levelText, { color: getLevelColor(course.level) }]}>
                      {course.level.charAt(0).toUpperCase() + course.level.slice(1)}
                    </ThemedText>
                  </View>
                  <View style={styles.courseMeta}>
                    <Ionicons name="book-outline" size={14} color="#6B7280" />
                    <ThemedText style={styles.courseMetaText}>{course.total_lessons} lessons</ThemedText>
                  </View>
                  <View style={styles.priceBadge}>
                    <ThemedText style={styles.priceText}>
                      {course.is_free ? 'Free' : `$${course.price}`}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.primaryActionRow}>
                  <TouchableOpacity style={styles.manageContentButton} onPress={() => openContentModal(course)} activeOpacity={0.85}>
                    <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.manageContentButtonText}>
                      {course.total_lessons > 0 ? 'Manage Content' : 'Upload Content'}
                    </ThemedText>
                  </TouchableOpacity>

                  {course.status === 'published' ? (
                    <View style={styles.publishedPill}>
                      <Ionicons name="checkmark-circle" size={16} color="#059669" />
                      <ThemedText style={styles.publishedPillText}>Live</ThemedText>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.publishButton, !isCourseReadyToPublish(course) && styles.publishButtonDisabled]}
                      onPress={() => handlePublishCourse(course)}
                      activeOpacity={0.85}
                    >
                      {publishingCourseId === course.id ? (
                        <ActivityIndicator size="small" color="#111827" />
                      ) : (
                        <>
                          <Ionicons name="rocket-outline" size={16} color="#111827" />
                          <ThemedText style={styles.publishButtonText}>Publish</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.courseActions}> 
                  <TouchableOpacity style={styles.editActionButton} onPress={() => openEditModal(course)}>
                    <Ionicons name="create-outline" size={16} color="#475569" />
                    <ThemedText style={styles.editActionText}>Edit</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteActionButton} onPress={() => handleDelete(course)}>
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    <ThemedText style={styles.deleteActionText}>Delete</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Floating Add Button */}
      {courses.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={openCreateModal} activeOpacity={0.8}>
          <LinearGradient colors={['#FF6B6B', '#EE5A24']} style={styles.fabGradient}>
            <Ionicons name="add" size={28} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Course Content Modal */}
      <Modal visible={contentModalOpen} animationType="slide" transparent onRequestClose={() => setContentModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
          >
          <View style={styles.modalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
            >
              <View style={styles.modalHeader}>
                <View>
                  <ThemedText style={styles.modalTitle}>Course Content</ThemedText>
                  <ThemedText style={styles.modalSubtitle} numberOfLines={1}>
                    {selectedCourse?.title || 'Selected course'}
                  </ThemedText>
                </View>
                <TouchableOpacity onPress={() => setContentModalOpen(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.publishChecklistCard}>
                <ThemedText style={styles.publishChecklistTitle}>Publish checklist</ThemedText>
                <View style={styles.publishChecklistRow}>
                  <View style={[styles.publishChecklistItem, selectedCourse?.thumbnail_url ? styles.publishChecklistDone : styles.publishChecklistPending]}>
                    <Ionicons name={selectedCourse?.thumbnail_url ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={selectedCourse?.thumbnail_url ? '#065F46' : '#9A3412'} />
                    <ThemedText style={[styles.publishChecklistText, selectedCourse?.thumbnail_url ? styles.publishChecklistTextDone : styles.publishChecklistTextPending]}>
                      Thumbnail uploaded
                    </ThemedText>
                  </View>
                  <View style={[styles.publishChecklistItem, lessons.length > 0 ? styles.publishChecklistDone : styles.publishChecklistPending]}>
                    <Ionicons name={lessons.length > 0 ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={lessons.length > 0 ? '#065F46' : '#9A3412'} />
                    <ThemedText style={[styles.publishChecklistText, lessons.length > 0 ? styles.publishChecklistTextDone : styles.publishChecklistTextPending]}>
                      At least one lesson
                    </ThemedText>
                  </View>
                </View>
              </View>

              <ThemedText style={styles.inputLabel}>Lesson Title *</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="e.g. Lesson 1 - Introduction"
                placeholderTextColor="#9CA3AF"
                value={lessonTitle}
                onChangeText={setLessonTitle}
              />

              <ThemedText style={styles.inputLabel}>Description</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Optional lesson description"
                placeholderTextColor="#9CA3AF"
                value={lessonDescription}
                onChangeText={setLessonDescription}
                multiline
                scrollEnabled={false}
                numberOfLines={3}
                textAlignVertical="top"
              />

              <View style={styles.toggleRow}>
                <ThemedText style={styles.inputLabel}>Preview lesson (free)</ThemedText>
                <TouchableOpacity
                  style={[styles.toggle, lessonPreview && styles.toggleActive]}
                  onPress={() => setLessonPreview(!lessonPreview)}
                >
                  <View style={[styles.toggleDot, lessonPreview && styles.toggleDotActive]} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.filePickBtn} onPress={pickContentFile}>
                <Ionicons name="attach" size={18} color="#111827" />
                <ThemedText style={styles.filePickText}>
                  {selectedFile?.name ? `Selected: ${selectedFile.name}` : 'Choose video file (mp4/mov/m4v/webm)'}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, uploadingContent && { opacity: 0.6 }]}
                onPress={uploadLessonContent}
                disabled={uploadingContent}
              >
                {uploadingContent ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <ThemedText style={styles.saveButtonText}>Upload Content</ThemedText>
                )}
              </TouchableOpacity>

              <ThemedText style={styles.sectionLabel}>Uploaded Content</ThemedText>
              {loadingLessons ? (
                <ActivityIndicator size="small" color="#FF6B6B" style={{ marginTop: 12 }} />
              ) : lessons.length === 0 ? (
                <ThemedText style={styles.emptyInlineText}>No lessons uploaded yet.</ThemedText>
              ) : (
                lessons.map((lesson) => (
                  <View key={lesson.id} style={styles.lessonCard}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.lessonTitle}>{lesson.title}</ThemedText>
                      <ThemedText style={styles.lessonMeta}>
                        {String(lesson.content_type || '').toUpperCase()} • {lesson.file_name || 'Content'}
                      </ThemedText>
                    </View>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteLesson(lesson)}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
          >
          <View style={styles.modalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
            >
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>
                  {editingCourse ? 'Edit Course' : 'New Course'}
                </ThemedText>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.setupNotice}>
                <Ionicons name="information-circle" size={20} color="#C2410C" />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.setupNoticeTitle}>Draft first, publish after setup</ThemedText>
                  <ThemedText style={styles.setupNoticeText}>
                    Thumbnail is required. Upload at least one video lesson before publishing your course.
                  </ThemedText>
                </View>
              </View>

              {/* Title */}
              <ThemedText style={styles.inputLabel}>Course Title *</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="e.g. Quran Memorization for Beginners"
                placeholderTextColor="#9CA3AF"
                value={title}
                onChangeText={setTitle}
              />

              {/* Description */}
              <ThemedText style={styles.inputLabel}>Description</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe what students will learn..."
                placeholderTextColor="#9CA3AF"
                value={description}
                onChangeText={setDescription}
                multiline
                scrollEnabled={false}
                numberOfLines={4}
                textAlignVertical="top"
              />

              <ThemedText style={styles.inputLabel}>Thumbnail *</ThemedText>
              <TouchableOpacity style={styles.thumbnailPicker} onPress={pickThumbnailImage} activeOpacity={0.85}>
                {thumbnailAsset?.uri ? (
                  <Image source={{ uri: thumbnailAsset.uri }} style={styles.thumbnailPreview} />
                ) : (
                  <View style={styles.thumbnailPlaceholder}>
                    <Ionicons name="image-outline" size={24} color="#F97316" />
                    <ThemedText style={styles.thumbnailPlaceholderTitle}>Upload course thumbnail</ThemedText>
                    <ThemedText style={styles.thumbnailPlaceholderText}>16:9 image recommended</ThemedText>
                  </View>
                )}
                <View style={styles.thumbnailOverlayButton}>
                  <Ionicons name="cloud-upload-outline" size={16} color="#111827" />
                  <ThemedText style={styles.thumbnailOverlayButtonText}>
                    {thumbnailAsset?.uri ? 'Change image' : 'Choose image'}
                  </ThemedText>
                </View>
              </TouchableOpacity>

              {/* Subject */}
              <ThemedText style={styles.inputLabel}>Subject *</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                <View style={styles.pillRow}>
                  {SUBJECTS.map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.pill, subject === s && styles.pillActive]}
                      onPress={() => setSubject(s)}
                    >
                      <ThemedText style={[styles.pillText, subject === s && styles.pillTextActive]}>{s}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Level */}
              <ThemedText style={styles.inputLabel}>Level</ThemedText>
              <View style={styles.pillRow}>
                {LEVELS.map(l => (
                  <TouchableOpacity
                    key={l}
                    style={[styles.pill, level === l && styles.pillActive]}
                    onPress={() => setLevel(l)}
                  >
                    <ThemedText style={[styles.pillText, level === l && styles.pillTextActive]}>
                      {l.charAt(0).toUpperCase() + l.slice(1)}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Free toggle */}
              <View style={styles.toggleRow}>
                <ThemedText style={styles.inputLabel}>Free Course</ThemedText>
                <TouchableOpacity
                  style={[styles.toggle, isFree && styles.toggleActive]}
                  onPress={() => setIsFree(!isFree)}
                >
                  <View style={[styles.toggleDot, isFree && styles.toggleDotActive]} />
                </TouchableOpacity>
              </View>

              {/* Price */}
              {!isFree && (
                <>
                  <ThemedText style={styles.inputLabel}>Price ($)</ThemedText>
                  <TextInput
                    style={styles.input}
                    placeholder="29.99"
                    placeholderTextColor="#9CA3AF"
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="numeric"
                  />
                </>
              )}

              {/* Total Lessons */}
              <ThemedText style={styles.inputLabel}>Total Lessons</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="10"
                placeholderTextColor="#9CA3AF"
                value={totalLessons}
                onChangeText={setTotalLessons}
                keyboardType="numeric"
              />

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <ThemedText style={styles.saveButtonText}>
                    {editingCourse ? 'Save Changes' : 'Create Draft'}
                  </ThemedText>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },

  /* Header */
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  /* Notification */
  notifBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 8,
  },
  successBanner: { backgroundColor: '#10B981' },
  errorBanner: { backgroundColor: '#EF4444' },
  notifText: { color: '#FFF', fontSize: 14, fontWeight: '500', flex: 1 },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  miniStat: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  miniStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  miniStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },

  /* Content */
  contentPad: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  /* Course Card */
  courseCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  courseMediaWrap: {
    position: 'relative',
    marginBottom: 14,
  },
  courseThumbnail: {
    width: '100%',
    height: 144,
    borderRadius: 16,
  },
  courseThumbnailPlaceholder: {
    height: 144,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  courseThumbnailPlaceholderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9F1239',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgePublished: {
    backgroundColor: '#D1FAE5',
  },
  statusBadgeDraft: {
    backgroundColor: '#FFEDD5',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadgeTextPublished: {
    color: '#065F46',
  },
  statusBadgeTextDraft: {
    color: '#9A3412',
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  courseIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  courseSubject: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  courseActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  editBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
    marginBottom: 12,
  },
  courseFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '700',
  },
  courseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  courseMetaText: {
    fontSize: 12,
    color: '#6B7280',
  },
  priceBadge: {
    marginLeft: 'auto',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  requirementsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  requirementChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  requirementChipDone: {
    backgroundColor: '#DCFCE7',
  },
  requirementChipPending: {
    backgroundColor: '#FFEDD5',
  },
  requirementChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  requirementChipTextDone: {
    color: '#166534',
  },
  requirementChipTextPending: {
    color: '#9A3412',
  },
  requirementHint: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
    marginBottom: 12,
  },
  primaryActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  manageContentButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#111827',
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  manageContentButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  publishButton: {
    minWidth: 116,
    borderRadius: 14,
    backgroundColor: '#FDE68A',
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  publishButtonDisabled: {
    opacity: 0.7,
  },
  publishButtonText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
  },
  publishedPill: {
    minWidth: 116,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  publishedPillText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '800',
  },
  editActionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 11,
  },
  editActionText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteActionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 11,
  },
  deleteActionText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Empty State */
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFF',
    borderRadius: 20,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  emptyButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },

  /* FAB */
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalKeyboardAvoid: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'android' ? 18 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  setupNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    padding: 14,
    marginBottom: 4,
  },
  setupNoticeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#9A3412',
    marginBottom: 2,
  },
  setupNoticeText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#C2410C',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  publishChecklistCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 4,
  },
  publishChecklistTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  publishChecklistRow: {
    gap: 8,
  },
  publishChecklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  publishChecklistDone: {
    backgroundColor: '#DCFCE7',
  },
  publishChecklistPending: {
    backgroundColor: '#FFEDD5',
  },
  publishChecklistText: {
    fontSize: 12,
    fontWeight: '700',
  },
  publishChecklistTextDone: {
    color: '#166534',
  },
  publishChecklistTextPending: {
    color: '#9A3412',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginTop: 18,
    marginBottom: 8,
  },
  emptyInlineText: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 8,
  },
  filePickBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
  },
  filePickText: {
    color: '#111827',
    fontSize: 13,
    flex: 1,
  },
  lessonCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lessonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  lessonMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  thumbnailPicker: {
    marginTop: 2,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
  },
  thumbnailPreview: {
    width: '100%',
    height: 170,
  },
  thumbnailPlaceholder: {
    height: 170,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
  },
  thumbnailPlaceholderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#9A3412',
  },
  thumbnailPlaceholderText: {
    fontSize: 12,
    color: '#C2410C',
  },
  thumbnailOverlayButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  thumbnailOverlayButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
  },
  pillScroll: {
    marginBottom: 4,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  pillActive: {
    backgroundColor: '#111827',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  pillTextActive: {
    color: '#FFF',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleActive: {
    backgroundColor: '#10B981',
  },
  toggleDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF',
  },
  toggleDotActive: {
    alignSelf: 'flex-end',
  },
  saveButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
