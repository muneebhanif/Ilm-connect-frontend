import { ReactNode } from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { Fonts, LingoTheme } from '@/constants/theme';

export function LingoCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function LingoBadge({ label, icon, tone = 'primary', style }: { label: string; icon?: keyof typeof Ionicons.glyphMap; tone?: 'primary' | 'teal' | 'gold' | 'purple' | 'danger'; style?: StyleProp<ViewStyle> }) {
  const colors = badgeTone[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg, borderColor: colors.border }, style]}> 
      {icon ? <Ionicons name={icon} size={14} color={colors.text} /> : null}
      <ThemedText style={[styles.badgeText, { color: colors.text }]}>{label}</ThemedText>
    </View>
  );
}

export function LingoHero({ icon, title, subtitle, badge }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; badge?: string }) {
  return (
    <LinearGradient colors={['#ECFCD8', '#FFFFFF', '#F2E8FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      {badge ? <LingoBadge label={badge} icon="sparkles" /> : null}
      <View style={styles.heroIconWrap}>
        <LinearGradient colors={['#58CC02', '#14B8A6']} style={styles.heroIconBubble}>
          <Ionicons name={icon} size={28} color="#FFFFFF" />
        </LinearGradient>
      </View>
      <ThemedText style={styles.heroTitle}>{title}</ThemedText>
      <ThemedText style={styles.heroSubtitle}>{subtitle}</ThemedText>
    </LinearGradient>
  );
}

export function LingoScreenHeader({
  title,
  subtitle,
  badge,
  icon,
  onBack,
  children,
  style,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onBack?: () => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient colors={['#ECFCD8', '#FFFFFF', '#F2E8FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.screenHeader, style]}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={20} color={LingoTheme.colors.ink} />
        </TouchableOpacity>
      ) : null}

      {badge ? <LingoBadge label={badge} icon="sparkles" style={styles.screenHeaderBadge} /> : null}

      {icon ? (
        <View style={styles.screenHeaderIconWrap}>
          <LinearGradient colors={[LingoTheme.colors.primary, LingoTheme.colors.teal]} style={styles.screenHeaderIconBubble}>
            <Ionicons name={icon} size={22} color="#FFFFFF" />
          </LinearGradient>
        </View>
      ) : null}

      <ThemedText style={styles.screenHeaderTitle}>{title}</ThemedText>
      <ThemedText style={styles.screenHeaderSubtitle}>{subtitle}</ThemedText>

      {children ? <View style={styles.screenHeaderFooter}>{children}</View> : null}
    </LinearGradient>
  );
}

export function LingoEmptyState({
  icon,
  title,
  subtitle,
  tone = 'teal',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  tone?: 'primary' | 'teal' | 'gold' | 'purple' | 'danger';
}) {
  const colors = badgeTone[tone];

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyStateIconWrap, { backgroundColor: colors.bg, borderColor: colors.border }]}> 
        <Ionicons name={icon} size={28} color={colors.text} />
      </View>
      <ThemedText style={styles.emptyStateTitle}>{title}</ThemedText>
      <ThemedText style={styles.emptyStateSubtitle}>{subtitle}</ThemedText>
    </View>
  );
}

export function LingoButton({ label, onPress, variant = 'primary', loading = false, disabled = false, icon, style }: { label: string; onPress?: () => void; variant?: 'primary' | 'secondary'; loading?: boolean; disabled?: boolean; icon?: keyof typeof Ionicons.glyphMap; style?: StyleProp<ViewStyle> }) {
  const isDisabled = loading || disabled;

  if (variant === 'secondary') {
    return (
      <TouchableOpacity style={[styles.secondaryButton, style, isDisabled && styles.buttonDisabled]} onPress={onPress} activeOpacity={0.85} disabled={isDisabled}>
        {loading ? <ActivityIndicator color={LingoTheme.colors.ink} /> : <ThemedText style={styles.secondaryButtonText}>{label}</ThemedText>}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={[styles.primaryWrap, style, isDisabled && styles.buttonDisabled]} onPress={onPress} activeOpacity={0.9} disabled={isDisabled}>
      <LinearGradient colors={[LingoTheme.colors.primary, '#3F9A00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryButton}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <>
          <ThemedText style={styles.primaryButtonText}>{label}</ThemedText>
          {icon ? <Ionicons name={icon} size={18} color="#FFFFFF" /> : null}
        </>}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function LingoStatPill({ icon, value, label, tone = 'primary' }: { icon: string; value: string; label: string; tone?: 'primary' | 'teal' | 'gold' | 'purple' }) {
  const colors = badgeTone[tone];
  return (
    <View style={styles.statPill}>
      <View style={[styles.statIconWrap, { backgroundColor: colors.bg }]}> 
        <ThemedText style={styles.statEmoji}>{icon}</ThemedText>
      </View>
      <View>
        <ThemedText style={styles.statValue}>{value}</ThemedText>
        <ThemedText style={styles.statLabel}>{label}</ThemedText>
      </View>
    </View>
  );
}

const badgeTone = {
  primary: { bg: '#ECFCD8', border: '#B7E889', text: '#3F9A00' },
  teal: { bg: '#DDF7F4', border: '#90E2D8', text: '#0F8F80' },
  gold: { bg: '#FFF7D6', border: '#F4D778', text: '#B7791F' },
  purple: { bg: '#F2E8FF', border: '#D7B7FF', text: '#8B5CF6' },
  danger: { bg: '#FEE2E2', border: '#F7A7A7', text: '#DC2626' },
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    padding: 20,
    ...LingoTheme.shadow.card,
  },
  badge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 14,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  hero: {
    borderRadius: 30,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    marginBottom: 22,
    ...LingoTheme.shadow.card,
  },
  heroIconWrap: {
    marginBottom: 14,
  },
  heroIconBubble: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.14)',
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 34,
    textAlign: 'center',
    fontFamily: Fonts.rounded,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    marginBottom: 8,
  },
  heroSubtitle: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    color: LingoTheme.colors.muted,
    maxWidth: 320,
  },
  screenHeader: {
    borderRadius: 30,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 20,
    ...LingoTheme.shadow.card,
  },
  backButton: {
    alignSelf: 'flex-start',
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  screenHeaderBadge: {
    marginBottom: 12,
  },
  screenHeaderIconWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  screenHeaderIconBubble: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.14)',
  },
  screenHeaderTitle: {
    fontSize: 28,
    lineHeight: 32,
    textAlign: 'center',
    fontFamily: Fonts.rounded,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
  },
  screenHeaderSubtitle: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    color: LingoTheme.colors.muted,
  },
  screenHeaderFooter: {
    marginTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  emptyStateIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyStateTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    color: LingoTheme.colors.muted,
    maxWidth: 280,
  },
  primaryWrap: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 18,
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.16)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: LingoTheme.colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 148,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statEmoji: {
    fontSize: 20,
    lineHeight: 22,
  },
  statValue: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
  },
  statLabel: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: LingoTheme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
