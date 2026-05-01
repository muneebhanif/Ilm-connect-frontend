import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/config';
import { LingoBadge, LingoButton, LingoCard, LingoEmptyState } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';

interface ConnectStatus {
  connected: boolean;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string[];
  payoutsBlockedReason?: string | null;
  defaultCurrency?: string | null;
  country?: string | null;
}

const defaultStatus: ConnectStatus = {
  connected: false,
  onboardingComplete: false,
  chargesEnabled: false,
  payoutsEnabled: false,
  detailsSubmitted: false,
  requirementsDue: [],
  payoutsBlockedReason: null,
  defaultCurrency: null,
  country: null,
};

export default function TeacherPayoutSettingsScreen() {
  const router = useRouter();
  const { topPadding, bottomPadding } = useSafePadding();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState<'onboarding' | 'dashboard' | null>(null);
  const [status, setStatus] = useState<ConnectStatus>(defaultStatus);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async (mode: 'initial' | 'refresh' = 'initial') => {
    try {
      setError(null);
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);

      const response = await authFetch(api.payments.teacherConnectStatus());
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load payout settings');
      }

      setStatus({ ...defaultStatus, ...data });
    } catch (e: any) {
      setError(e?.message || 'Failed to load payout settings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [])
  );

  const openOnboarding = async () => {
    try {
      setBusyAction('onboarding');
      const response = await authFetch(api.payments.teacherConnectOnboarding(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshUrl: 'ilmconnect://payout-settings?refresh=1',
          returnUrl: 'ilmconnect://payout-settings?connected=1',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.onboardingUrl) {
        throw new Error(data.error || 'Failed to open Stripe onboarding');
      }

      await Linking.openURL(data.onboardingUrl);
    } catch (e: any) {
      setError(e?.message || 'Failed to open Stripe onboarding');
    } finally {
      setBusyAction(null);
    }
  };

  const openStripeDashboard = async () => {
    try {
      setBusyAction('dashboard');
      const response = await authFetch(api.payments.teacherDashboardLink(), {
        method: 'POST',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.dashboardUrl) {
        throw new Error(data.error || 'Failed to open Stripe dashboard');
      }

      await Linking.openURL(data.dashboardUrl);
    } catch (e: any) {
      setError(e?.message || 'Failed to open Stripe dashboard');
    } finally {
      setBusyAction(null);
    }
  };

  const actionNeededCount = status.requirementsDue?.length || 0;
  const statusLabel = status.payoutsEnabled ? 'Ready for payouts' : status.connected ? 'Setup still needed' : 'Not connected';

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={LingoTheme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding, paddingBottom: bottomPadding + (Platform.OS === 'ios' ? 120 : 100) }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadStatus('refresh')} tintColor={LingoTheme.colors.primary} />}
        >
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={22} color="#3C3C3C" />
            </TouchableOpacity>
            <View style={styles.topBarCenter}>
              <ThemedText style={styles.topBarTitle}>Payout Settings</ThemedText>
              <ThemedText style={styles.topBarSub}>Stripe earnings setup</ThemedText>
            </View>
            <View style={{ width: 44 }} />
          </View>
          <View style={styles.statsRow}>
            <View style={styles.metricPill}>
              <Ionicons name={status.payoutsEnabled ? 'checkmark-circle' : 'alert-circle'} size={20} color={status.payoutsEnabled ? '#10B981' : '#F59E0B'} />
              <ThemedText style={styles.pillValue}>{status.payoutsEnabled ? 'Ready' : 'Setup'}</ThemedText>
              <ThemedText style={styles.pillLabel}>Status</ThemedText>
            </View>
            <View style={styles.metricPill}>
              <Ionicons name="document-text-outline" size={20} color="#F59E0B" />
              <ThemedText style={styles.pillValue}>{actionNeededCount}</ThemedText>
              <ThemedText style={styles.pillLabel}>Actions</ThemedText>
            </View>
            <View style={styles.metricPill}>
              <Ionicons name="globe-outline" size={20} color="#F59E0B" />
              <ThemedText style={styles.pillValue}>{(status.country || '--').slice(0, 2).toUpperCase()}</ThemedText>
              <ThemedText style={styles.pillLabel}>Country</ThemedText>
            </View>
          </View>

          <View style={styles.card}>
            <LingoCard>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cardTitle}>Stripe account</ThemedText>
                  <ThemedText style={styles.cardSubtitle}>{statusLabel}</ThemedText>
                </View>
                <LingoBadge
                  label={status.payoutsEnabled ? 'Ready' : status.connected ? 'Needs setup' : 'Connect'}
                  icon={status.payoutsEnabled ? 'checkmark-circle' : 'alert-circle'}
                  tone={status.payoutsEnabled ? 'primary' : 'gold'}
                />
              </View>

              <View style={styles.checklist}>
                <View style={styles.checklistRow}>
                  <Ionicons name={status.connected ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={status.connected ? LingoTheme.colors.primary : LingoTheme.colors.muted} />
                  <ThemedText style={styles.checklistText}>Connected account created</ThemedText>
                </View>
                <View style={styles.checklistRow}>
                  <Ionicons name={status.detailsSubmitted ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={status.detailsSubmitted ? LingoTheme.colors.primary : LingoTheme.colors.muted} />
                  <ThemedText style={styles.checklistText}>Details submitted</ThemedText>
                </View>
                <View style={styles.checklistRow}>
                  <Ionicons name={status.chargesEnabled ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={status.chargesEnabled ? LingoTheme.colors.primary : LingoTheme.colors.muted} />
                  <ThemedText style={styles.checklistText}>Charges enabled</ThemedText>
                </View>
                <View style={styles.checklistRow}>
                  <Ionicons name={status.payoutsEnabled ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={status.payoutsEnabled ? LingoTheme.colors.primary : LingoTheme.colors.muted} />
                  <ThemedText style={styles.checklistText}>Payouts enabled</ThemedText>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaPill}>
                  <ThemedText style={styles.metaLabel}>Country</ThemedText>
                  <ThemedText style={styles.metaValue}>{status.country || '--'}</ThemedText>
                </View>
                <View style={styles.metaPill}>
                  <ThemedText style={styles.metaLabel}>Currency</ThemedText>
                  <ThemedText style={styles.metaValue}>{status.defaultCurrency ? String(status.defaultCurrency).toUpperCase() : '--'}</ThemedText>
                </View>
              </View>

              {status.requirementsDue?.length ? (
                <View style={styles.warningBox}>
                  <Ionicons name="alert-circle" size={18} color="#B7791F" />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.warningTitle}>Still needed from Stripe</ThemedText>
                    <ThemedText style={styles.warningText}>{status.requirementsDue.join(', ')}</ThemedText>
                  </View>
                </View>
              ) : null}

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color={LingoTheme.colors.danger} />
                  <ThemedText style={styles.errorText}>{error}</ThemedText>
                </View>
              ) : null}

              <View style={styles.actionsWrap}>
                <LingoButton
                  label={status.connected ? 'Continue Stripe setup' : 'Connect Stripe'}
                  icon="arrow-forward"
                  onPress={openOnboarding}
                  loading={busyAction === 'onboarding'}
                />
                <LingoButton
                  label="Open Stripe dashboard"
                  variant="secondary"
                  onPress={openStripeDashboard}
                  loading={busyAction === 'dashboard'}
                  disabled={!status.connected}
                />
              </View>
            </LingoCard>
          </View>

          <LingoCard style={styles.infoCard}>
            <ThemedText style={styles.infoTitle}>How payouts work</ThemedText>
            <View style={styles.infoRows}>
              <View style={styles.infoRow}>
                <Ionicons name="calculator-outline" size={18} color={LingoTheme.colors.teal} />
                <ThemedText style={styles.infoText}>Booking totals are calculated on the server from your hourly rate and the chosen package.</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="shield-checkmark-outline" size={18} color={LingoTheme.colors.teal} />
                <ThemedText style={styles.infoText}>Gross amount, platform fee, and teacher net amount are stored in Stripe metadata for each payment.</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="cash-outline" size={18} color={LingoTheme.colors.teal} />
                <ThemedText style={styles.infoText}>Once Stripe enables payouts, transfers follow your verified account and payout schedule.</ThemedText>
              </View>
            </View>
          </LingoCard>

          {!status.connected ? (
            <LingoCard>
              <LingoEmptyState
                icon="wallet-outline"
                title="Connect Stripe when you’re ready"
                subtitle="You only need a few onboarding steps to start receiving teacher payouts securely."
                tone="gold"
              />
            </LingoCard>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LingoTheme.colors.background },
  loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: LingoTheme.colors.background },
  scrollContent: { paddingHorizontal: 16, gap: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  backButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 2, borderColor: '#E5E5E5', borderBottomWidth: 4,
    justifyContent: 'center', alignItems: 'center',
  },
  topBarCenter: { flex: 1, alignItems: 'center' },
  topBarTitle: { fontSize: 20, fontWeight: '800', color: '#3C3C3C' },
  topBarSub: { fontSize: 13, color: '#AFAFAF', fontWeight: '600', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginBottom: 8 },
  metricPill: {
    flex: 1, alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, borderWidth: 2, borderColor: '#E5E5E5', borderBottomWidth: 4,
    paddingVertical: 12, paddingHorizontal: 4, gap: 2,
  },
  pillValue: { fontSize: 15, fontWeight: '800', color: '#3C3C3C' },
  pillLabel: { fontSize: 10, fontWeight: '700', color: '#AFAFAF', textTransform: 'uppercase' },
  card: { marginBottom: 0 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 },
  cardTitle: { fontSize: 20, fontWeight: '800', color: LingoTheme.colors.ink },
  cardSubtitle: { marginTop: 4, fontSize: 14, lineHeight: 20, color: LingoTheme.colors.muted },
  checklist: { gap: 10 },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checklistText: { fontSize: 14, color: LingoTheme.colors.ink, fontWeight: '700' },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  metaPill: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: LingoTheme.colors.border,
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  metaLabel: { fontSize: 11, fontWeight: '800', color: LingoTheme.colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { marginTop: 6, fontSize: 16, fontWeight: '800', color: LingoTheme.colors.ink },
  warningBox: { marginTop: 16, backgroundColor: LingoTheme.colors.softGold, borderRadius: 18, padding: 14, flexDirection: 'row', gap: 10, borderWidth: 2, borderColor: '#F4D778' },
  warningTitle: { fontSize: 13, fontWeight: '800', color: '#B7791F', marginBottom: 2 },
  warningText: { fontSize: 13, color: '#8A5A13', lineHeight: 19 },
  errorBox: { marginTop: 16, backgroundColor: LingoTheme.colors.softDanger, borderRadius: 18, padding: 14, flexDirection: 'row', gap: 10, borderWidth: 2, borderColor: '#F7A7A7' },
  errorText: { flex: 1, color: '#B42318', fontSize: 13, lineHeight: 19 },
  actionsWrap: { marginTop: 18, gap: 10 },
  infoCard: { backgroundColor: '#FFFFFF' },
  infoTitle: { fontSize: 18, fontWeight: '800', color: LingoTheme.colors.ink, marginBottom: 12 },
  infoRows: { gap: 12 },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 13, color: LingoTheme.colors.muted, lineHeight: 20 },
});