import { StyleSheet, View, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { Fonts, LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';

const ROLES = [
  {
    title: "I'm a Parent",
    description: "Find trusted teachers, book classes, and support your child's learning journey.",
    icon: 'people' as const, // Switched to solid icons for better visual weight
    iconColor: '#0D9488',
    iconBg: '#E6F9F6',
    route: '/signup-parent',
  },
  {
    title: "I'm a Teacher",
    description: 'Build your teaching profile, set your availability, and connect with students worldwide.',
    icon: 'school' as const,
    iconColor: '#EA580C',
    iconBg: '#FFEDD5',
    route: '/signup-teacher',
  },
] as const;

export default function RoleSelectionScreen() {
  const router = useRouter();
  const { topPadding, bottomPadding } = useSafePadding();

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      
      {/* --- TOP HEADER SECTION --- */}
      <View style={styles.topHeader}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()} 
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <ThemedText style={styles.title}>Join IlmConnect</ThemedText>
          <ThemedText style={styles.subtitle}>
            Choose how you will use the platform to get started.
          </ThemedText>
        </View>
      </View>

      {/* --- BOTTOM SHEET CONTENT --- */}
      <View style={styles.bottomSheetContainer}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.bottomSheetContent, 
            { paddingBottom: bottomPadding + 32 }
          ]}
        >
          {/* Role Cards */}
          <View style={styles.cards}>
            {ROLES.map((role) => (
              <TouchableOpacity
                key={role.title}
                activeOpacity={0.6}
                onPress={() => router.push(role.route as any)}
                style={styles.card}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.iconWrap, { backgroundColor: role.iconBg }]}>
                    <Ionicons name={role.icon} size={24} color={role.iconColor} />
                  </View>
                  <View style={styles.cardArrow}>
                    <Ionicons name="arrow-forward" size={20} color={LingoTheme.colors.ink} />
                  </View>
                </View>
                <ThemedText style={styles.cardTitle}>{role.title}</ThemedText>
                <ThemedText style={styles.cardDesc}>{role.description}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Info Note for Students */}
          <View style={styles.note}>
            <View style={styles.noteIconWrap}>
              <Ionicons name="information" size={20} color="#3B82F6" />
            </View>
            <ThemedText style={styles.noteText}>
              <ThemedText style={{ fontWeight: '700', color: LingoTheme.colors.ink }}>Student accounts</ThemedText> are created by parents from their dashboard — no separate sign-up needed.
            </ThemedText>
          </View>

          {/* Footer Action */}
          <View style={styles.footer}>
            <ThemedText style={styles.footerText}>Already have an account?</ThemedText>
            <TouchableOpacity onPress={() => router.push('/login')} activeOpacity={0.7}>
              <ThemedText style={styles.footerLink}>Log in</ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    backgroundColor: LingoTheme.colors.primary || '#2DD4BF', 
  },
  
  // --- Top Header ---
  topHeader: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  titleContainer: {
    gap: 8,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontFamily: Fonts.rounded,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    paddingRight: 20,
  },

  // --- Bottom Sheet ---
  bottomSheetContainer: {
    flex: 1,
    backgroundColor: LingoTheme.colors.background,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  bottomSheetContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
  },

  // --- Cards ---
  cards: {
    gap: 16,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: LingoTheme.colors.border,
    ...Platform.select({
      ios: {
        shadowColor: LingoTheme.colors.ink,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LingoTheme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: LingoTheme.colors.border,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: Fonts.rounded,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 15,
    lineHeight: 22,
    color: LingoTheme.colors.muted,
    fontWeight: '500',
  },

  // --- Note ---
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF', // Soft blue
    borderRadius: 20,
    padding: 16,
    gap: 12,
    marginBottom: 32,
  },
  noteIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DBEAFE', // Slightly darker blue
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
    fontWeight: '500',
  },

  // --- Footer ---
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 'auto',
  },
  footerText: {
    fontSize: 15,
    color: LingoTheme.colors.muted,
    fontWeight: '600',
  },
  footerLink: {
    fontSize: 15,
    color: LingoTheme.colors.primaryDark || '#0D9488',
    fontWeight: '800',
  },
});