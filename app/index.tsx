import { StyleSheet, View, TouchableOpacity, Dimensions, Platform, Image } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SkeletonScreen } from '@/components/ui/skeleton';

const logo = require('@/assets/images/logo.png');

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) return;
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
      {/* 1. Top Section: Height Reduced to 45% to pull content up */}
      <View style={styles.topSection}>
        <LinearGradient
          colors={['#4ECDC4', '#2BCBBA', '#2193b0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
        >
          <View style={styles.patternContainer}>
            <Ionicons name="moon" size={36} color="rgba(255,255,255,0.1)" style={[styles.floatingIcon, { top: '15%', left: '10%' }]} />
            <Ionicons name="star" size={20} color="rgba(255,255,255,0.15)" style={[styles.floatingIcon, { top: '25%', right: '15%' }]} />
            <Ionicons name="book" size={28} color="rgba(255,255,255,0.08)" style={[styles.floatingIcon, { top: '55%', left: '20%' }]} />
            <Ionicons name="grid" size={24} color="rgba(255,255,255,0.08)" style={[styles.floatingIcon, { top: '45%', right: '8%' }]} />
            
            <View style={styles.heroGraphicContainer}>
              <View style={styles.heroCircleOuter}>
                <View style={styles.heroCircleInner}>
                  <Image source={logo} style={styles.heroLogo} resizeMode="contain" />
                </View>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <ThemedText style={styles.verifiedText}>Trusted</ThemedText>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* 2. Bottom Section: Compact Layout */}
      <View style={styles.bottomSheet}>
        <View style={styles.contentContainer}>
          
          <View style={styles.textBlock}>
            <View style={styles.pillContainer}>
              <ThemedText style={styles.pillText}>ILM CONNECT</ThemedText>
            </View>
            <ThemedText style={styles.mainTitle}>
              Nurturing <ThemedText style={styles.highlightText}>Faith</ThemedText>{'\n'}
              Through Knowledge
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Connect with verified tutors for Quran, Arabic, and Islamic studies.
            </ThemedText>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={() => router.push('/role-selection')}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#1A202C', '#2D3748']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryGradient}
              >
                <ThemedText style={styles.primaryBtnText}>Get Started</ThemedText>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
               <View style={styles.dividerLine} />
               <ThemedText style={styles.dividerText}>or</ThemedText>
               <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={() => router.push('/login')}
              activeOpacity={0.7}
            >
              <ThemedText style={styles.secondaryBtnText}>Log In</ThemedText>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },

  /* Top Section - Reduced Height */
  topSection: {
    height: height * 0.45, // Reduced from 0.50 to 0.45 to save space
    width: '100%',
  },
  gradientBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  patternContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingIcon: {
    position: 'absolute',
  },
  
  /* Hero Graphic - Slightly Smaller */
  heroGraphicContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -10,
  },
  heroCircleOuter: {
    width: 140, // Reduced size
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  heroCircleInner: {
    width: 100, // Reduced size
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  heroLogo: {
    width: 70,
    height: 70,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: '#2BCBBA', 
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  verifiedText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  /* Bottom Sheet Section */
  bottomSheet: {
    flex: 1,
    marginTop: -30, 
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 28, // Slightly tighter horizontal padding
    paddingTop: 28,        // Reduced top padding to pull text up
    paddingBottom: 20,
    justifyContent: 'flex-start',
    gap: 16,               // Significantly reduced gap between blocks
  },
  textBlock: {
    alignItems: 'center',
  },
  pillContainer: {
    backgroundColor: '#E6FFFA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 12, // Reduced margin
  },
  pillText: {
    color: '#4ECDC4',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  mainTitle: {
    fontSize: 30, // Slightly smaller font to save vertical space
    fontFamily: Fonts.rounded,
    fontWeight: '800',
    color: '#1A202C',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 8, // Reduced margin
  },
  highlightText: {
    color: '#4ECDC4',
  },
  subtitle: {
    fontSize: 15,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },

  /* Actions */
  actions: {
    width: '100%',
    marginTop: 8, // Little push from text
  },
  primaryButton: {
    width: '100%',
    height: 54, // Standard touch target
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#1A202C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  
  /* Divider Styles - Compact */
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12, // Tighter vertical spacing
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#A0AEC0',
    fontSize: 13,
    fontWeight: '500',
  },

  secondaryButton: {
    width: '100%',
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#F7FAFC',
    borderWidth: 1,
    borderColor: '#EDF2F7', 
  },
  secondaryBtnText: {
    color: '#4A5568', 
    fontSize: 17, 
    fontWeight: '700',
  },
});