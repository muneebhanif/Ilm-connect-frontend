import { useEffect } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/config';

/**
 * Detects the device's IANA timezone (e.g. "Asia/Karachi") using the
 * Intl API and silently syncs it to the backend if it differs from what
 * is already stored. Call this once after the user session is available.
 */
export function useDeviceTimezone(
  userId: string | null | undefined,
  role: 'teacher' | 'parent' | null | undefined,
  storedTimezone: string | null | undefined,
  token: string | null | undefined
) {
  useEffect(() => {
    if (!userId || !role || !token) return;

    const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!deviceTz) return;

    // No-op if already in sync
    if (storedTimezone && storedTimezone === deviceTz) return;

    const sync = async () => {
      try {
        if (role === 'teacher') {
          await authFetch(
            api.teacherProfile(userId),
            token,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ timezone: deviceTz }),
            }
          );
        } else if (role === 'parent') {
          await authFetch(
            api.parentProfile(userId),
            token,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ timezone: deviceTz }),
            }
          );
        }
        console.log(`✅ Timezone synced: ${deviceTz} (${role})`);
      } catch (e) {
        // Non-critical — swallow silently
        console.warn('⚠️ Timezone sync failed:', e);
      }
    };

    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, role, token]);
}

/** Returns the device IANA timezone string */
export function getDeviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
