// API Configuration
const normalizeBaseUrl = (url: string) => url.replace(/\/$/, '');

const envApiUrl = (process.env.EXPO_PUBLIC_API_URL || '').trim();
const CLOUD_API_URL = 'https://backend-ilm.vercel.app';

const resolveDevApiUrl = () => {
  if (envApiUrl) return normalizeBaseUrl(envApiUrl);

  // Permanent default for device builds and Expo Go: always use hosted backend.
  // This avoids localhost/LAN mismatch issues on Android devices.
  return CLOUD_API_URL;
};


const ENV = {
  development: {
    API_URL: resolveDevApiUrl(),
  },
  production: {
    API_URL: CLOUD_API_URL, 
  },
};

// Set to 'production' when deploying
const currentEnv = __DEV__ ? 'development' : 'production';

export const API_URL = normalizeBaseUrl(envApiUrl || ENV[currentEnv].API_URL);

// Helper function to build API endpoints
export const api = {
  // Auth endpoints
  login: () => `${API_URL}/api/login`,
  forgotPassword: () => `${API_URL}/api/forgot-password`,
  signupParent: () => `${API_URL}/api/signup/parent`,
  signupTeacher: () => `${API_URL}/api/signup/teacher`,
  signupStudent: () => `${API_URL}/api/signup/student`,
  refreshToken: () => `${API_URL}/api/refresh-token`,
  profile: (userId: string) => `${API_URL}/api/profile/${userId}`,
  
  // Parent endpoints
  parentProfile: (parentId: string) => `${API_URL}/api/parent/${parentId}/profile`,
  parentChildren: (parentId: string) => `${API_URL}/api/parent/${parentId}/children`,
  parentClasses: (parentId: string) => `${API_URL}/api/parent/${parentId}/classes`,
  childProfile: (childId: string) => `${API_URL}/api/parent/child/${childId}`,
  addChild: (parentId: string) => `${API_URL}/api/parent/${parentId}/children`,
  deleteChild: (parentId: string, childId: string) => `${API_URL}/api/parent/${parentId}/children/${childId}`,
  
  // Teacher endpoints
  teachers: () => `${API_URL}/api/teachers`,
  teacherById: (teacherId: string) => `${API_URL}/api/teachers/${teacherId}`,
  teacherProfile: (teacherId: string) => `${API_URL}/api/teachers/${teacherId}/profile`,
  teacherSchedule: (teacherId: string) => `${API_URL}/api/teachers/${teacherId}/schedule`,
  teacherStudents: (teacherId: string) => `${API_URL}/api/teachers/${teacherId}/students`,
  teacherNotifications: (teacherId: string) => `${API_URL}/api/teachers/${teacherId}/notifications`,

  // Student endpoints
  studentProfile: (profileId: string) => `${API_URL}/api/student/${profileId}/profile`,
  studentClasses: (profileId: string) => `${API_URL}/api/student/${profileId}/classes`,
  studentRecordings: (profileId: string) => `${API_URL}/api/student/${profileId}/recordings`,
  
  // Booking endpoints
  bookings: () => `${API_URL}/api/bookings`,
  booking: (bookingId: string) => `${API_URL}/api/bookings/${bookingId}`,
  classSession: (sessionId: string) => `${API_URL}/api/class-session/${sessionId}`,
  classWindow: (sessionId: string) => `${API_URL}/api/bookings/class-session/${sessionId}/window`,
  startClass: (sessionId: string) => `${API_URL}/api/bookings/class-session/${sessionId}/start`,
  endClass: (sessionId: string) => `${API_URL}/api/bookings/class-session/${sessionId}/end`,

  // Payment endpoints (Stripe)
  payments: {
    createIntent: () => `${API_URL}/api/payments/create-intent`,
    verify: () => `${API_URL}/api/payments/verify`,
    teacherConnectStatus: () => `${API_URL}/api/payments/teacher/connect-status`,
    teacherConnectOnboarding: () => `${API_URL}/api/payments/teacher/connect-onboarding`,
    teacherManualPayoutInfo: () => `${API_URL}/api/payments/teacher/manual-payout-info`,
    teacherDashboardLink: () => `${API_URL}/api/payments/teacher/dashboard-link`,
  },

  // Agora endpoints
  agoraToken: (channel: string, uid: string, role: 'HOST' | 'STUDENT', agoraUid?: number) =>
    `${API_URL}/api/agora?channel=${encodeURIComponent(channel)}&uid=${encodeURIComponent(uid)}&role=${role}${typeof agoraUid === 'number' ? `&agoraUid=${encodeURIComponent(String(agoraUid))}` : ''}`,
  notifications: {
    registerDevice: () => `${API_URL}/api/notifications/device-token`,
  },
  
  // Upload endpoints
  uploadProfileImage: (userId: string) => `${API_URL}/api/upload/${userId}/profile-image`,
  uploadTeacherDocument: (teacherId: string) => `${API_URL}/api/upload/teacher/${teacherId}/document`,
  replaceTeacherDocument: (teacherId: string, docType: string) => `${API_URL}/api/upload/teacher/${teacherId}/document/${encodeURIComponent(docType)}`,
  getTeacherDocuments: (teacherId: string) => `${API_URL}/api/upload/teacher/${teacherId}/documents`,
  uploadCourseThumbnail: (teacherId: string, courseId: string) => `${API_URL}/api/upload/teacher/${teacherId}/course/${courseId}/thumbnail`,
  uploadTeacherPortfolioMedia: (teacherId: string) => `${API_URL}/api/upload/teacher/${teacherId}/portfolio-media`,
  deleteTeacherPortfolioMedia: (teacherId: string, mediaId: string) => `${API_URL}/api/upload/teacher/${teacherId}/portfolio-media/${mediaId}`,
  uploadClassRecording: (teacherId: string) => `${API_URL}/api/upload/teacher/${teacherId}/recording`,
  teacherRecordings: (teacherId: string) => `${API_URL}/api/upload/teacher/${teacherId}/recordings`,
  updateClassRecording: (teacherId: string, recordingId: string) => `${API_URL}/api/upload/teacher/${teacherId}/recording/${recordingId}`,
  deleteClassRecording: (teacherId: string, recordingId: string) => `${API_URL}/api/upload/teacher/${teacherId}/recording/${recordingId}`,
  recordingAccess: (recordingId: string) => `${API_URL}/api/upload/recording/${recordingId}/access`,
  
  // Review endpoints
  reviews: {
    forTeacher: (teacherId: string) => `${API_URL}/api/reviews/teacher/${teacherId}`,
    create: () => `${API_URL}/api/reviews`,
    update: (reviewId: string) => `${API_URL}/api/reviews/${reviewId}`,
    delete: (reviewId: string) => `${API_URL}/api/reviews/${reviewId}`,
    canReview: (sessionId: string) => `${API_URL}/api/reviews/can-review/${sessionId}`,
  },
  
  // Message endpoints
  messages: {
    conversations: () => `${API_URL}/api/messages/conversations`,
    conversation: (otherUserId: string) => `${API_URL}/api/messages/conversation/${otherUserId}`,
    send: () => `${API_URL}/api/messages/send`,
    markRead: (otherUserId: string) => `${API_URL}/api/messages/read/${otherUserId}`,
    unreadCount: () => `${API_URL}/api/messages/unread-count`,
  },

  // Course endpoints
  courses: {
    browse: () => `${API_URL}/api/courses`,
    byTeacher: (teacherId: string) => `${API_URL}/api/courses/teacher/${teacherId}`,
    byId: (courseId: string) => `${API_URL}/api/courses/${courseId}`,
    create: () => `${API_URL}/api/courses`,
    update: (courseId: string) => `${API_URL}/api/courses/${courseId}`,
    delete: (courseId: string) => `${API_URL}/api/courses/${courseId}`,
    lessons: (courseId: string, teacherId: string) => `${API_URL}/api/courses/${courseId}/lessons?teacher_id=${encodeURIComponent(teacherId)}`,
    createLesson: (courseId: string) => `${API_URL}/api/courses/${courseId}/lessons`,
    createLessonUploadUrl: (courseId: string) => `${API_URL}/api/courses/${courseId}/lessons/upload-url`,
    uploadLesson: (courseId: string) => `${API_URL}/api/courses/${courseId}/lessons/upload`,
    finalizeLessonUpload: (courseId: string) => `${API_URL}/api/courses/${courseId}/lessons/upload-complete`,
    deleteLesson: (courseId: string, lessonId: string) => `${API_URL}/api/courses/${courseId}/lessons/${lessonId}`,
  },
};
