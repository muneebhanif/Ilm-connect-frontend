// API Configuration


const ENV = {
  development: {
    API_URL: 'http://127.0.0.1:3000',
  },
  production: {
    API_URL: 'https://backend-ilm.vercel.app', 
  },
};

// Set to 'production' when deploying
const currentEnv = __DEV__ ? 'development' : 'production';

export const API_URL = ENV[currentEnv].API_URL;

// Helper function to build API endpoints
export const api = {
  // Auth endpoints
  login: () => `${API_URL}/api/login`,
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
  teacherNotifications: (teacherId: string) => `${API_URL}/api/teachers/${teacherId}/notifications`,

  // Student endpoints
  studentProfile: (profileId: string) => `${API_URL}/api/student/${profileId}/profile`,
  studentClasses: (profileId: string) => `${API_URL}/api/student/${profileId}/classes`,
  studentRecordings: (profileId: string) => `${API_URL}/api/student/${profileId}/recordings`,
  
  // Booking endpoints
  bookings: () => `${API_URL}/api/bookings`,
  booking: (bookingId: string) => `${API_URL}/api/bookings/${bookingId}`,
  
  // Upload endpoints
  uploadProfileImage: (userId: string) => `${API_URL}/api/upload/${userId}/profile-image`,
  uploadTeacherDocument: (teacherId: string) => `${API_URL}/api/upload/teacher/${teacherId}/document`,
  getTeacherDocuments: (teacherId: string) => `${API_URL}/api/upload/teacher/${teacherId}/documents`,
  uploadClassRecording: (teacherId: string) => `${API_URL}/api/upload/teacher/${teacherId}/recording`,
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
};
