import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { BackButton } from '@/components/back-button';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/config';
import { LinearGradient } from 'expo-linear-gradient';

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
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
      setBusy(true);
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
      setBusy(false);
    }
  };

  const openStripeDashboard = async () => {
    try {
      setBusy(true);
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
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#111827', '#0F766E']} style={styles.header}>
        <View style={styles.headerTop}>
          <BackButton />
        </View>
        <ThemedText style={styles.headerTitle}>Payout Settings</ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          Connect Stripe to receive teacher payouts and manage payout details.
        </ThemedText>
      </LinearGradient>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#14B8A6" />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadStatus('refresh')} tintColor="#14B8A6" />}
        >
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle}>Stripe account</ThemedText>
              <View style={[styles.statusPill, status.payoutsEnabled ? styles.statusPillSuccess : styles.statusPillPending]}>
                <ThemedText style={[styles.statusPillText, status.payoutsEnabled ? styles.statusPillTextSuccess : styles.statusPillTextPending]}>
                  {status.payoutsEnabled ? 'Ready' : status.connected ? 'Setup needed' : 'Not connected'}
                </ThemedText>
              </View>
            </View>

            <View style={styles.checklist}>
              <View style={styles.checklistRow}>
                <Ionicons name={status.connected ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={status.connected ? '#059669' : '#9CA3AF'} />
                <ThemedText style={styles.checklistText}>Connected account created</ThemedText>
              </View>
              <View style={styles.checklistRow}>
                <Ionicons name={status.detailsSubmitted ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={status.detailsSubmitted ? '#059669' : '#9CA3AF'} />
                <ThemedText style={styles.checklistText}>Details submitted</ThemedText>
              </View>
              <View style={styles.checklistRow}>
                <Ionicons name={status.chargesEnabled ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={status.chargesEnabled ? '#059669' : '#9CA3AF'} />
                <ThemedText style={styles.checklistText}>Charges enabled</ThemedText>
              </View>
              <View style={styles.checklistRow}>
                <Ionicons name={status.payoutsEnabled ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={status.payoutsEnabled ? '#059669' : '#9CA3AF'} />
                <ThemedText style={styles.checklistText}>Payouts enabled</ThemedText>
              </View>
            </View>

            {status.country || status.defaultCurrency ? (
              <View style={styles.metaRow}>
                {status.country ? <ThemedText style={styles.metaText}>Country: {status.country}</ThemedText> : null}
                {status.defaultCurrency ? <ThemedText style={styles.metaText}>Currency: {String(status.defaultCurrency).toUpperCase()}</ThemedText> : null}
              </View>
            ) : null}

            {status.requirementsDue?.length ? (
              <View style={styles.warningBox}>
                <Ionicons name="alert-circle" size={18} color="#C2410C" />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.warningTitle}>Action required</ThemedText>
                  <ThemedText style={styles.warningText}>
                    {status.requirementsDue.join(', ')}
                  </ThemedText>
                </View>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </View>
            ) : null}

            <TouchableOpacity style={[styles.primaryButton, busy && styles.buttonDisabled]} onPress={openOnboarding} disabled={busy}>
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.primaryButtonText}>{status.connected ? 'Continue Stripe setup' : 'Connect Stripe'}</ThemedText>}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.secondaryButton, busy && styles.buttonDisabled]} onPress={openStripeDashboard} disabled={busy || !status.connected}>
              <ThemedText style={styles.secondaryButtonText}>Open Stripe dashboard</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <ThemedText style={styles.infoTitle}>How payouts work</ThemedText>
            <ThemedText style={styles.infoText}>Booking amounts are calculated on the server from your hourly rate and selected package.</ThemedText>
            <ThemedText style={styles.infoText}>IlmConnect stores gross amount, platform fee, and teacher net amount in Stripe metadata for each payment.</ThemedText>
            <ThemedText style={styles.infoText}>Once Stripe enables payouts, your verified account can receive transfers based on your payout schedule.</ThemedText>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: {
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40, gap: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusPillSuccess: { backgroundColor: '#DCFCE7' },
  statusPillPending: { backgroundColor: '#FFEDD5' },
  statusPillText: { fontSize: 11, fontWeight: '800' },
  statusPillTextSuccess: { color: '#166534' },
  statusPillTextPending: { color: '#9A3412' },
  checklist: { gap: 10 },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checklistText: { fontSize: 14, color: '#334155', fontWeight: '600' },
  metaRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', marginTop: 14 },
  metaText: { fontSize: 12, color: '#64748B', fontWeight: '700' },
  warningBox: { marginTop: 16, backgroundColor: '#FFF7ED', borderRadius: 14, padding: 12, flexDirection: 'row', gap: 8 },
  warningTitle: { fontSize: 13, fontWeight: '800', color: '#C2410C', marginBottom: 2 },
  warningText: { fontSize: 12, color: '#9A3412', lineHeight: 18 },
  errorBox: { marginTop: 16, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 12, flexDirection: 'row', gap: 8 },
  errorText: { flex: 1, color: '#DC2626', fontSize: 13, lineHeight: 18 },
  primaryButton: { marginTop: 18, backgroundColor: '#111827', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryButton: { marginTop: 10, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  secondaryButtonText: { color: '#111827', fontSize: 14, fontWeight: '800' },
  buttonDisabled: { opacity: 0.65 },
  infoCard: { backgroundColor: '#ECFEFF', borderRadius: 20, padding: 18 },
  infoTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  infoText: { fontSize: 13, color: '#155E75', lineHeight: 20, marginBottom: 6 },
});