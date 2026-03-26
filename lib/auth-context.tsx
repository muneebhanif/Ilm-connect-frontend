import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { api } from './config';

interface User {
  id: string;
  email: string;
  role: 'parent' | 'teacher' | 'admin';
  full_name: string;
  verification_status?: string;
}

interface AuthContextType {
  user: User | null;
  session: null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, role: 'parent' | 'teacher', fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage keys for user profile data
const STORAGE_KEYS = {
  USER_PROFILE: 'user_profile',
  USER_ID: 'userId', // Keep for backward compatibility
  USER_ROLE: 'userRole',
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // Initialize auth state from cached profile or backend.
  // Keep `loading` true until the user's role is confirmed to avoid
  // rendering the wrong role view on refresh.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
        const cachedRole = await AsyncStorage.getItem(STORAGE_KEYS.USER_ROLE);

        if (cached) {
          try {
            const parsed = JSON.parse(cached) as User;
            // If cached profile already contains a role, accept it immediately.
            if (parsed && parsed.role) {
              if (mounted) setUser(parsed);
              if (mounted) setLoading(false);
              return;
            }
            // If role is stored separately, merge it in
            if (parsed && !parsed.role && cachedRole) {
              parsed.role = cachedRole as any;
              if (mounted) setUser(parsed);
              if (mounted) setLoading(false);
              return;
            }
            // Otherwise fall back to authoritative fetch by id
            if (parsed && parsed.id) {
              await loadUserProfile(parsed.id);
              return;
            }
          } catch (e) {
            // ignore parse errors and continue
          }
        }

        // No cached profile with role; try stored user id
        const storedId = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
        if (storedId) {
          await loadUserProfile(storedId);
          return;
        }

        // nothing to restore
        if (mounted) setUser(null);
      } catch (e) {
        console.error('Error initializing auth state', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Handle routing based on auth state
  useEffect(() => {
    if (loading) return;
    const current = segments[0];
    const authGroups = ['(parent)', '(teacher)'];
    const publicPages = [undefined, 'login', 'signup-parent', 'signup-teacher', 'role-selection'];

    // If user is missing but trying to access an auth-only group, send to login
    if (!user && authGroups.includes(current as string)) {
      router.replace('/login');
      return;
    }

    if (!user) return;

    // Define allowed top-level page names for each role so routes that
    // exist both at root and inside the layout group are accepted.
    const parentPages = ['browse-teachers', 'classes', 'dashboard', 'profile', 'edit-profile', 'teacher-profile', 'child-profile', 'book-teacher', 'class-room', 'chat', 'messages'];
    const teacherPages = ['teacher-dashboard', 'students', 'schedule', 'profile', 'availability', 'edit-profile', 'class-room', 'chat', 'messages', 'parent-profile'];

    // If already inside the correct layout group or a top-level page for the user's role, do nothing.
    if ((current === '(teacher)' || teacherPages.includes(current as string)) && user.role === 'teacher') return;
    if ((current === '(parent)' || parentPages.includes(current as string)) && user.role === 'parent') return;

    // If on a public page (or root) redirect into the appropriate layout.
    if (publicPages.includes(current as any)) {
      if (user.role === 'teacher') {
        router.replace('/(teacher)/teacher-dashboard');
      } else {
        router.replace('/(parent)/dashboard');
      }
      return;
    }

    // If user is in the wrong layout group (e.g. parent UI while a teacher), force redirect.
    if (user.role === 'teacher' && !(current === '(teacher)' || teacherPages.includes(current as string))) {
      router.replace('/(teacher)/teacher-dashboard');
      return;
    }

    if (user.role !== 'teacher' && !(current === '(parent)' || parentPages.includes(current as string))) {
      router.replace('/(parent)/dashboard');
      return;
    }
  }, [user, loading, segments]);

  const loadUserProfile = async (userId: string) => {
    setLoading(true);
    try {
      // Fetch authoritative profile
      const res = await fetch(api.profile(userId));
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      const profile = data.profile || {};
      const validRoles: User['role'][] = ['parent', 'teacher', 'admin'];
      const backendRole = typeof profile.role === 'string' && profile.role.length > 0 ? (profile.role as User['role']) : undefined;
      const resolvedRole = validRoles.includes(backendRole as User['role'])
        ? backendRole as User['role']
        : 'parent';

      const userData: User = {
        id: profile.id || userId,
        email: profile.email || '',
        role: resolvedRole,
        full_name: profile.full_name || '',
        verification_status: profile.verification_status || undefined,
      };
      setUser(userData);
      await saveUserProfile(userData);
    } catch (error) {
      console.error('Error loading user profile:', error);
      // Avoid leaving stale user/role in memory when profile load fails.
      setUser(null);
      await clearUserProfile();
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const saveUserProfile = async (userData: User) => {
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(userData)),
      AsyncStorage.setItem(STORAGE_KEYS.USER_ID, userData.id),
      AsyncStorage.setItem(STORAGE_KEYS.USER_ROLE, userData.role),
    ]);
  };

  const clearUserProfile = async () => {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.USER_PROFILE),
      AsyncStorage.removeItem(STORAGE_KEYS.USER_ID),
      AsyncStorage.removeItem(STORAGE_KEYS.USER_ROLE),
      AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN),
    ]);
  };

  const signIn = async (email: string, password: string) => {
    // Clear previous auth cache first to avoid role leakage between accounts.
    await clearUserProfile();
    setUser(null);

    const response = await fetch(api.login(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    if (data.session?.access_token) {
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.session.access_token);
    }

    if (data.session?.refresh_token) {
      await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.session.refresh_token);
    }

    if (data.user?.id) {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, data.user.id);
      await loadUserProfile(data.user.id);
      return;
    }

    throw new Error('Login failed: user record missing');
  };

  const signUp = async (email: string, password: string, role: 'parent' | 'teacher', fullName: string) => {
    const endpoint = role === 'parent' ? api.signupParent() : api.signupTeacher();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Signup failed');
    }

    // IMPORTANT: signup endpoints create the user but don't return a session.
    // Immediately sign in to obtain and persist the access token so protected
    // endpoints (classes/profile/start-class/agora) work after refresh.
    await signIn(email, password);
  };

  const signOut = async () => {
    await clearUserProfile();
    setUser(null);
    router.replace('/login');
  };

  const refreshSession = async () => {
    try {
      const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) {
        // No refresh token available - user needs to sign in
        console.log('No refresh token available');
        return;
      }

      const res = await fetch(api.refreshToken(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn('Failed to refresh session:', data?.error);
        return;
      }

      if (data.session?.access_token) {
        await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.session.access_token);
      }
      if (data.session?.refresh_token) {
        await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.session.refresh_token);
      }
    } catch (e) {
      console.error('Error refreshing session', e);
      // Don't throw - just log and continue
    }
  };

  // Keep this for backward compatibility with existing API calls
  const legacySignIn = async (email: string, password: string) => {
    try {
      const response = await fetch(api.login(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');

      if (data.session?.access_token) {
        await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.session.access_token);
      }

      if (data.user?.id) {
        await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, data.user.id);
        await loadUserProfile(data.user.id);
      }
    } catch (error) {
      console.error('Legacy sign in failed', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, session: null, loading, signIn, signUp, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
