import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Returns the correct top padding based on the device's safe area insets.
 * Replaces hardcoded `paddingTop: 60` across all screens.
 * 
 * Usage:
 *   const { topPadding } = useSafePadding();
 *   <View style={{ paddingTop: topPadding }}>
 * 
 * On iOS notch devices: ~59px (safe area inset ~47 + 12 extra)
 * On Android: status bar height + 12 extra
 * On web: 20px fallback
 */
export function useSafePadding() {
  const insets = useSafeAreaInsets();

  // Add a bit of extra breathing room beyond the safe area
  const topPadding = Platform.select({
    ios: insets.top + 12,
    android: insets.top + 12,
    default: 20,
  });

  const bottomPadding = Platform.select({
    ios: Math.max(insets.bottom, 16),
    android: Math.max(insets.bottom, 16),
    default: 16,
  });

  return { topPadding, bottomPadding, insets };
}
