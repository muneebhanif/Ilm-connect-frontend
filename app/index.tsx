import { StyleSheet, View, TouchableOpacity, Dimensions, Platform, Image, Animated } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SkeletonScreen } from '@/components/ui/skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const logo = require('@/assets/images/logo.png');

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
      return;
    }
    const target = user.role === 'teacher'
      ? '/(teacher)/teacher-dashboard'
      : user.role === 'student'
        ? '/(student)/dashboard'
        : '/(parent)/dashboard';
    router.replace(target);
  }, [user, loading]);

  if (loading) {
    return <SkeletonScreen />;
  }

  if (user) return null;

  return (
    <View style={styles.container}>
      {/* Full gradient background */}
      <LinearGradient
        colors={['#0D9488', '#2BCBBA', '#4ECDC4', '#86EFAC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientFull}
      >
        {/* Decorative elements */}
        <View style={styles.decorContainer}>
          <View style={[styles.decorCircle, { top: '5%', left: -40, width: 120, height: 120 }]} />
          <View style={[styles.decorCircle, { top: '15%', right: -30, width: 80, height: 80 }]} />
          <View style={[styles.decorCircle, { bottom: '40%', left: '20%', width: 60, height: 60 }]} />
          <Ionicons name="moon-outline" size={28} color="rgba(255,255,255,0.08)" style={{ position: 'absolute', top: '8%', left: '15%' }} />
          <Ionicons name="star-outline" size={20} color="rgba(255,255,255,0.1)" style={{ position: 'absolute', top: '20%', right: '12%' }} />
          <Ionicons name="book-outline" size={24} color="rgba(255,255,255,0.06)" style={{ position: 'absolute', top: '35%', left: '8%' }} />
        </View>

        {/* Logo section */}
        <View style={[styles.logoSection, { paddingTop: insets.top + 40 }]}>
          <View style={styles.logoOuter}>
            <View style={styles.logoGlow} />
            <View style={styles.logoInner}>
              <Image source={logo} style={styles.logoImg} resizeMode="contain" />
            </View>
          </View>
          <View style={styles.trustBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#FFF" />
            <ThemedText style={styles.trustText}>Verified & Trusted</ThemedText>
          </View>
        </View>
      </LinearGradient>

      {/* Bottom card */}
      <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.cardContent}>
          <View style={styles.brandPill}>
            <ThemedText style={styles.brandPillText}>ILM CONNECT</ThemedText>
          </View>

          <ThemedText style={styles.headline}>
            Nurturing{' '}<ThemedText style={styles.accent}>Faith</ThemedText>
            {'\n'}Through Knowledge
          </ThemedText>

          <ThemedText style={styles.tagline}>
            Connect with verified tutors for Quran,{'\n'}Arabic, and Islamic studies.
          </ThemedText>

          {/* Feature chips */}
          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#0D9488" />
              <ThemedText style={styles.chipText}>Verified Tutors</ThemedText>
            </View>
            <View style={styles.chip}>
              <Ionicons name="videocam-outline" size={14} color="#0D9488" />
              <ThemedText style={styles.chipText}>Live Classes</ThemedText>
            </View>
            <View style={styles.chip}>
              <Ionicons name="people-outline" size={14} color="#0D9488" />
              <ThemedText style={styles.chipText}>1-on-1</ThemedText>
            </View>
          </View>

          {/* CTA buttons */}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/role-selection')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#0D9488', '#14B8A6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryGrad}
            >
              <ThemedText style={styles.primaryText}>Get Started</ThemedText>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/login')}
            activeOpacity={0.7}
          >
            <ThemedText style={styles.secondaryText}>Already have an account? <ThemedText style={styles.loginLink}>Log In</ThemedText></ThemedText>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FDF9',
  },
  gradientFull: {
    height: height * 0.42,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  decorContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  logoSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  logoOuter: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  logoGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  logoInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  logoImg: {
    width: 62,
    height: 62,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  trustText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Card */
  card: {
    flex: 1,
    marginTop: -28,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandPill: {
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  brandPillText: {
    color: '#0D9488',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  headline: {
    fontSize: 30,
    fontFamily: Fonts.rounded,
    fontWeight: '800',
    color: '#1A202C',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 10,
  },
  accent: {
    color: '#0D9488',
  },
  tagline: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0D9488',
  },
  primaryBtn: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 16,
  },
  primaryGrad: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: 12,
  },
  secondaryText: {
    color: '#64748B',
    fontSize: 14,
  },
  loginLink: {
    color: '#0D9488',
    fontWeight: '700',
  },
});