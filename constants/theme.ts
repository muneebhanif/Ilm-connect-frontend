/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/ ), [Tamagui](https://tamagui.dev/ ), [unistyles](https://reactnativeunistyles.vercel.app ), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// ============================================================
// LINGO DESIGN SYSTEM - ENHANCED THEME
// Duolingo-inspired: playful, minimal, bright colors, rounded shapes
// ============================================================
export const LingoTheme = {
  colors: {
    // Primary brand colors
    primary: '#58CC02',
    primaryDark: '#3F9A00',
    primaryLight: '#ECFCD8',
    softPrimary: '#ECFCD8',

    // Secondary accents
    secondary: '#CE82FF',
    secondaryLight: '#F2E8FF',
    purple: '#CE82FF',
    softPurple: '#F2E8FF',

    // Accent colors
    teal: '#14B8A6',
    softTeal: '#DDF7F4',
    gold: '#FFC800',
    softGold: '#FFF7D6',

    // Semantic colors
    success: '#58CC02',
    warning: '#FFC800',
    danger: '#FF4B4B',
    dangerLight: '#FEE2E2',
    softDanger: '#FEE2E2',

    // Neutral scale
    ink: '#25313C',
    text: '#3c3c3c',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    textInverse: '#FFFFFF',
    muted: '#6B7280',

    // Surfaces
    surface: '#FFFFFF',
    surfaceAlt: '#F9FAFB',
    background: '#F7F7F2',
    border: '#EDE5D8',
    borderLight: '#F3F4F6',

    // Overlays
    overlay: 'rgba(0, 0, 0, 0.4)',
    scrim: 'rgba(0, 0, 0, 0.6)',
  },

  // Typography scale: 12/14/16/20/24/32
  typography: {
    primary: 'Nunito',
    display: 'Nunito',
    mono: 'JetBrains Mono',

    sizes: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 20,
      xl: 24,
      '2xl': 32,
      '3xl': 40,
    },

    weights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
      black: '900',
    },
  },

  // Spacing scale: 4/8/12/16/24/32
  spacing: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 24,
    6: 32,
    8: 48,
    10: 64,
  },

  // Border radius: 12/18/24/30/999
  radius: {
    sm: 12,
    md: 18,
    lg: 24,
    xl: 30,
    pill: 999,
  },

  // Shadows: tactile 3D-like bottom borders or soft drop shadows
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 4,
    },
    elevated: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 8,
    },
    floating: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 6,
    },
  },

  // Animation presets
  animation: {
    spring: {
      damping: 15,
      stiffness: 150,
      mass: 1,
    },
    bounce: {
      damping: 10,
      stiffness: 200,
    },
  },
} as const;

// Type helpers for TypeScript
export type LingoColor = keyof typeof LingoTheme.colors;
export type LingoSpacing = keyof typeof LingoTheme.spacing;
export type LingoRadius = keyof typeof LingoTheme.radius;