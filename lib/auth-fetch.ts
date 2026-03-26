/**
 * Authenticated fetch utility
 * Handles token management and automatic refresh on 401 errors
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './config';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
};

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(): Promise<string | null> {
  // If already refreshing, wait for that to complete
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) {
        console.log('No refresh token available');
        return null;
      }

      console.log('Refreshing access token...');
      const res = await fetch(api.refreshToken(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn('Failed to refresh token:', data?.error);
        return null;
      }

      if (data.session?.access_token) {
        await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.session.access_token);
        console.log('Access token refreshed successfully');
        
        if (data.session?.refresh_token) {
          await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.session.refresh_token);
        }
        
        return data.session.access_token;
      }

      return null;
    } catch (e) {
      console.error('Error refreshing token:', e);
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Get the current access token
 */
export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * Authenticated fetch that automatically handles token refresh
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get current access token
  let accessToken = await getAccessToken();
  
  // Set up headers with authorization
  const headers = new Headers(options.headers || {});
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  
  // Make the initial request
  let response = await fetch(url, {
    ...options,
    headers,
  });

  // If we get a 401, try to refresh the token and retry
  if (response.status === 401 && accessToken) {
    console.log('Got 401, attempting token refresh...');
    const newToken = await refreshAccessToken();
    
    if (newToken) {
      // Retry the request with the new token
      headers.set('Authorization', `Bearer ${newToken}`);
      response = await fetch(url, {
        ...options,
        headers,
      });
    }
  }

  return response;
}

/**
 * Helper for JSON API calls with automatic auth
 */
export async function authFetchJson<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
  try {
    const response = await authFetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => null);
    
    if (!response.ok) {
      return {
        data: null,
        error: data?.error || data?.message || `Request failed with status ${response.status}`,
        status: response.status,
      };
    }

    return { data, error: null, status: response.status };
  } catch (e: any) {
    return {
      data: null,
      error: e.message || 'Network error',
      status: 0,
    };
  }
}
