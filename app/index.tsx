import { Image, StyleSheet, TouchableOpacity, View, Platform, useWindowDimensions } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { LingoButton } from '@/components/ui/lingo-mobile';
import { Fonts, LingoTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useSafePadding } from '@/hooks/use-safe-padding';
import { SkeletonScreen } from '@/components/ui/skeleton';

const logo = require('@/assets/images/logo.png');

export default function HomeScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { topPadding, bottomPadding } = useSafePadding();
  const { height } = useWindowDimensions();

  // --------------------------------------------------------
  // BACKEND LOGIC (Unchanged)
  // --------------------------------------------------------
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    const target = user.role === 'teacher'
      ? '/(teacher)/teacher-dashboard'
      : user.role === 'student'
        ? '/(student)/dashboard'
        : '/(parent)/dashboard';
    router.replace(target);
  }, [user, loading, router]);

  if (loading) return <SkeletonScreen />;
  if (user) return null;

  // --------------------------------------------------------
  // UI PRESENTATION
  // --------------------------------------------------------
  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      
      {/* --- TOP HERO SECTION --- */}
      <View style={styles.topHero}>
        {/* Subtle decorative background icons to mimic the reference image */}
        <Ionicons name="moon" size={32} color="rgba(255,255,255,0.15)" style={[styles.bgIcon, { top: '15%', left: '10%' }]} />
        <Ionicons name="star" size={24} color="rgba(255,255,255,0.15)" style={[styles.bgIcon, { top: '25%', right: '15%' }]} />
        <Ionicons name="book" size={36} color="rgba(255,255,255,0.1)" style={[styles.bgIcon, { bottom: '20%', left: '20%' }]} />
        <Ionicons name="grid" size={28} color="rgba(255,255,255,0.1)" style={[styles.bgIcon, { bottom: '30%', right: '10%' }]} />

        {/* Central Graphic */}
        <View style={styles.graphicOuterRing}>
          <View style={styles.graphicInnerCircle}>
            {/* Using your actual logo instead of a generic icon for better branding */}
            <Image source={logo} style={styles.logo} resizeMode="contain" />
          </View>
          
          {/* "Trusted" / "Verified" Badge */}
          <View style={styles.trustedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
            <ThemedText style={styles.trustedText}>Verified</ThemedText>
          </View>
        </View>
      </View>

      {/* --- BOTTOM SHEET SECTION --- */}
      <View style={[styles.bottomSheet, { paddingBottom: bottomPadding + 32 }]}>
        
        {/* Brand Pill */}
        <View style={styles.pill}>
          <ThemedText style={styles.pillText}>ILM CONNECT</ThemedText>
        </View>

        {/* Headline */}
        <ThemedText style={styles.headline}>
          Nurturing <ThemedText style={styles.headlineHighlight}>Faith</ThemedText>{'\n'}
          Through{'\n'}
          Knowledge
        </ThemedText>

        {/* Subtitle */}
        <ThemedText style={styles.subline}>
          Connect with verified tutors for Quran, Arabic, and Islamic studies.
        </ThemedText>

        {/* Actions Area */}
        <View style={styles.actionsContainer}>
          <LingoButton
            label="Get Started"
            icon="arrow-forward"
            onPress={() => router.push('/role-selection')}
          />

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <ThemedText style={styles.dividerText}>or</ThemedText>
            <View style={styles.dividerLine} />
          </View>

          {/* Secondary "Log In" Button */}
          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={() => router.push('/login')} 
            activeOpacity={0.7}
          >
            <ThemedText style={styles.secondaryButtonText}>Log In</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// --------------------------------------------------------
// STYLES
// --------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Using a fallback primary color. If you have a specific gradient color in your theme, apply it here.
    backgroundColor: LingoTheme.colors.primary || '#2DD4BF', 
  },
  
  // --- Top Hero ---
  topHero: {
    flex: 0.6,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bgIcon: {
    position: 'absolute',
  },
  graphicOuterRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.2)', // Semi-transparent ring
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  graphicInnerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  trustedBadge: {
    position: 'absolute',
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14B8A6', // Distinct trust color (teal/green)
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  trustedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: Fonts.rounded,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // --- Bottom Sheet ---
  bottomSheet: {
    flex: 1.4,
    backgroundColor: LingoTheme.colors.background,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 32,
    paddingTop: 32,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  pill: {
    backgroundColor: LingoTheme.colors.softPrimary || '#E6F9F6',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 24,
  },
  pillText: {
    fontSize: 11,
    fontFamily: Fonts.rounded,
    fontWeight: '800',
    color: LingoTheme.colors.primaryDark || '#0D9488',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: 36,
    lineHeight: 44,
    fontFamily: Fonts.rounded,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  headlineHighlight: {
    color: LingoTheme.colors.primary || '#2DD4BF',
  },
  subline: {
    fontSize: 15,
    lineHeight: 24,
    color: LingoTheme.colors.muted,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  
  // --- Actions ---
  actionsContainer: {
    width: '100%',
    gap: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: LingoTheme.colors.border,
  },
  dividerText: {
    fontSize: 14,
    color: LingoTheme.colors.muted,
    fontWeight: '500',
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: '#F8FAFC', // Very light grey/blue
    borderWidth: 1,
    borderColor: LingoTheme.colors.border,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 17,
    fontFamily: Fonts.rounded,
    fontWeight: '700',
    color: LingoTheme.colors.ink,
  },
});