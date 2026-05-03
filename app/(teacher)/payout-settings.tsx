import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, Platform } from 'react-native';

// Countries where Stripe Connect payouts are supported.
// Pakistan (PK) and several others are NOT on this list → show manual payout form.
const STRIPE_SUPPORTED_COUNTRIES = new Set([
  'AU','AT','BE','BG','CA','HR','CY','CZ','DK','EE','FI','FR','DE','GI','GR',
  'HK','HU','IE','IT','JP','LV','LI','LT','LU','MT','MX','NL','NZ','NO','PL',
  'PT','RO','SG','SK','SI','ES','SE','CH','TH','AE','GB','US',
]);

const PAYOUT_METHODS = [
  { key: 'payoneer' as const, label: 'Payoneer', icon: 'card-outline' as const },
  { key: 'wise'     as const, label: 'Wise',     icon: 'swap-horizontal-outline' as const },
  { key: 'bank'     as const, label: 'Bank',     icon: 'business-outline' as const },
];
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/config';
import { LingoBadge, LingoButton, LingoCard, LingoEmptyState } from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';

interface ManualPayoutInfo {
  method: 'payoneer' | 'wise' | 'bank';
  accountEmail?: string;
  accountName?: string;
  bankName?: string;
  iban?: string;
  swiftBic?: string;
  currency?: string;
  notes?: string;
}

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
  profileCountry?: string | null;
  manualPayoutInfo?: ManualPayoutInfo | null;
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
  profileCountry: null,
  manualPayoutInfo: null,
};

const defaultManualForm: ManualPayoutInfo = {
  method: 'payoneer',
  accountEmail: '',
  accountName: '',
  bankName: '',
  iban: '',
  swiftBic: '',
  currency: 'USD',
  notes: '',
};

export default function TeacherPayoutSettingsScreen() {
  const router = useRouter();
  const { topPadding, bottomPadding } = useSafePadding();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState<'onboarding' | 'dashboard' | 'savingManual' | null>(null);
  const [status, setStatus] = useState<ConnectStatus>(defaultStatus);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Manual payout form state
  const [manualForm, setManualForm] = useState<ManualPayoutInfo>(defaultManualForm);
  const [editingManual, setEditingManual] = useState(false);

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
      if (data.manualPayoutInfo) {
        setManualForm({ ...defaultManualForm, ...data.manualPayoutInfo });
      }
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

  // Determine if Stripe Connect is available for this teacher's country
  const profileCountry = (status.profileCountry || '').toUpperCase();
  const stripeSupported = !profileCountry || STRIPE_SUPPORTED_COUNTRIES.has(profileCountry);

  const saveManualPayout = async () => {
    if (!manualForm.method) return;
    try {
      setError(null);
      setSuccessMsg(null);
      setBusyAction('savingManual');
      const response = await authFetch(api.payments.teacherManualPayoutInfo(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualForm),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to save payout info');
      setStatus((prev) => ({ ...prev, manualPayoutInfo: data.manualPayoutInfo }));
      setEditingManual(false);
      setSuccessMsg('Payout details saved. The admin will process your earnings manually.');
    } catch (e: any) {
      setError(e?.message || 'Failed to save payout info');
    } finally {
      setBusyAction(null);
    }
  };

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
              <Ionicons name="chevron-back" size={26} color="#111827" />
            </TouchableOpacity>
            <ThemedText style={styles.topBarTitle}>Payout Settings</ThemedText>
          </View>
          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <View style={[styles.statIconBox, { backgroundColor: (stripeSupported ? status.payoutsEnabled : !!status.manualPayoutInfo) ? '#F0FDF4' : '#FFF7ED' }]}>
                <Ionicons name={(stripeSupported ? status.payoutsEnabled : !!status.manualPayoutInfo) ? 'checkmark-circle' : 'alert-circle'} size={22} color={(stripeSupported ? status.payoutsEnabled : !!status.manualPayoutInfo) ? '#22C55E' : '#F97316'} />
              </View>
              <ThemedText style={[styles.pillValue, { color: (stripeSupported ? status.payoutsEnabled : !!status.manualPayoutInfo) ? '#22C55E' : '#F97316' }]}>{(stripeSupported ? status.payoutsEnabled : !!status.manualPayoutInfo) ? 'Ready' : 'Setup'}</ThemedText>
              <ThemedText style={styles.pillLabel}>Status</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statChip}>
              <View style={[styles.statIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="card-outline" size={22} color="#3B82F6" />
              </View>
              <ThemedText style={[styles.pillValue, { color: '#3B82F6' }]}>{stripeSupported ? 'Stripe' : 'Manual'}</ThemedText>
              <ThemedText style={styles.pillLabel}>Method</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statChip}>
              <View style={[styles.statIconBox, { backgroundColor: '#F5F3FF' }]}>
                <Ionicons name="globe" size={22} color="#8B5CF6" />
              </View>
              <ThemedText style={[styles.pillValue, { color: '#8B5CF6' }]}>{(profileCountry || '--').slice(0, 2).toUpperCase()}</ThemedText>
              <ThemedText style={styles.pillLabel}>Country</ThemedText>
            </View>
          </View>

          {/* Stripe not supported banner */}
          {!stripeSupported && profileCountry ? (
            <View style={styles.warningBox}>
              <Ionicons name="information-circle" size={20} color="#B7791F" />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.warningTitle}>Stripe not available in {profileCountry}</ThemedText>
                <ThemedText style={styles.warningText}>Stripe Connect does not support payouts to your country. Provide your Payoneer, Wise, or bank details below and the admin will transfer your earnings manually.</ThemedText>
              </View>
            </View>
          ) : null}

          {stripeSupported ? (
            /* ── STRIPE FLOW ── */
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
                <LingoButton label={status.connected ? 'Continue Stripe setup' : 'Connect Stripe'} icon="arrow-forward" onPress={openOnboarding} loading={busyAction === 'onboarding'} />
                <LingoButton label="Open Stripe dashboard" variant="secondary" onPress={openStripeDashboard} loading={busyAction === 'dashboard'} disabled={!status.connected} />
              </View>
            </LingoCard>
          </View>) : (
            /* ── MANUAL PAYOUT FLOW ── */
            <LingoCard style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cardTitle}>Manual payout details</ThemedText>
                  <ThemedText style={styles.cardSubtitle}>
                    {status.manualPayoutInfo && !editingManual ? 'Your details are saved. Admin will send your earnings.' : 'Choose your preferred method and enter your details.'}
                  </ThemedText>
                </View>
                <LingoBadge label={status.manualPayoutInfo ? 'Saved' : 'Needed'} icon={status.manualPayoutInfo ? 'checkmark-circle' : 'alert-circle'} tone={status.manualPayoutInfo ? 'primary' : 'gold'} />
              </View>

              {status.manualPayoutInfo && !editingManual ? (
                <View style={styles.savedSummary}>
                  {([
                    { label: 'Method', value: PAYOUT_METHODS.find(m => m.key === status.manualPayoutInfo?.method)?.label ?? status.manualPayoutInfo!.method },
                    status.manualPayoutInfo!.accountEmail ? { label: 'Email / Account', value: status.manualPayoutInfo!.accountEmail } : null,
                    status.manualPayoutInfo!.accountName  ? { label: 'Account name',   value: status.manualPayoutInfo!.accountName }  : null,
                    status.manualPayoutInfo!.bankName     ? { label: 'Bank',            value: status.manualPayoutInfo!.bankName }     : null,
                    status.manualPayoutInfo!.iban         ? { label: 'IBAN / Acct #',   value: status.manualPayoutInfo!.iban }         : null,
                    status.manualPayoutInfo!.currency     ? { label: 'Currency',         value: status.manualPayoutInfo!.currency }    : null,
                  ] as Array<{label: string; value: string} | null>).filter(Boolean).map((row) => (
                    <View key={row!.label} style={styles.savedRow}>
                      <ThemedText style={styles.savedLabel}>{row!.label}</ThemedText>
                      <ThemedText style={styles.savedValue}>{row!.value}</ThemedText>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.editBtn} onPress={() => setEditingManual(true)} activeOpacity={0.8}>
                    <Ionicons name="pencil-outline" size={16} color={LingoTheme.colors.primary} />
                    <ThemedText style={styles.editBtnText}>Edit details</ThemedText>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.manualForm}>
                  <ThemedText style={styles.fieldLabel}>Payout method</ThemedText>
                  <View style={styles.methodRow}>
                    {PAYOUT_METHODS.map(({ key, label, icon }) => (
                      <TouchableOpacity key={key} style={[styles.methodBtn, manualForm.method === key && styles.methodBtnActive]} onPress={() => setManualForm(f => ({ ...f, method: key }))} activeOpacity={0.8}>
                        <Ionicons name={icon} size={18} color={manualForm.method === key ? LingoTheme.colors.primary : '#6B7280'} />
                        <ThemedText style={[styles.methodBtnText, manualForm.method === key && styles.methodBtnTextActive]}>{label}</ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {manualForm.method !== 'bank' ? (
                    <>
                      <ThemedText style={styles.fieldLabel}>{manualForm.method === 'payoneer' ? 'Payoneer email' : 'Wise email'} *</ThemedText>
                      <TextInput style={styles.input} value={manualForm.accountEmail} onChangeText={v => setManualForm(f => ({ ...f, accountEmail: v }))} placeholder="your@email.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#9CA3AF" />
                      <ThemedText style={styles.fieldLabel}>Account name</ThemedText>
                      <TextInput style={styles.input} value={manualForm.accountName} onChangeText={v => setManualForm(f => ({ ...f, accountName: v }))} placeholder="Full name" placeholderTextColor="#9CA3AF" />
                    </>
                  ) : (
                    <>
                      <ThemedText style={styles.fieldLabel}>Account holder name *</ThemedText>
                      <TextInput style={styles.input} value={manualForm.accountName} onChangeText={v => setManualForm(f => ({ ...f, accountName: v }))} placeholder="Full legal name" placeholderTextColor="#9CA3AF" />
                      <ThemedText style={styles.fieldLabel}>Bank name *</ThemedText>
                      <TextInput style={styles.input} value={manualForm.bankName} onChangeText={v => setManualForm(f => ({ ...f, bankName: v }))} placeholder="e.g. HBL, Meezan Bank" placeholderTextColor="#9CA3AF" />
                      <ThemedText style={styles.fieldLabel}>Account number / IBAN *</ThemedText>
                      <TextInput style={styles.input} value={manualForm.iban} onChangeText={v => setManualForm(f => ({ ...f, iban: v }))} placeholder="IBAN or account number" autoCapitalize="characters" placeholderTextColor="#9CA3AF" />
                      <ThemedText style={styles.fieldLabel}>SWIFT / BIC code</ThemedText>
                      <TextInput style={styles.input} value={manualForm.swiftBic} onChangeText={v => setManualForm(f => ({ ...f, swiftBic: v }))} placeholder="e.g. HABBPKKA" autoCapitalize="characters" placeholderTextColor="#9CA3AF" />
                    </>
                  )}

                  <ThemedText style={styles.fieldLabel}>Preferred currency</ThemedText>
                  <TextInput style={styles.input} value={manualForm.currency} onChangeText={v => setManualForm(f => ({ ...f, currency: v.toUpperCase() }))} placeholder="USD" autoCapitalize="characters" maxLength={3} placeholderTextColor="#9CA3AF" />
                  <ThemedText style={styles.fieldLabel}>Notes (optional)</ThemedText>
                  <TextInput style={[styles.input, styles.inputMulti]} value={manualForm.notes} onChangeText={v => setManualForm(f => ({ ...f, notes: v }))} placeholder="Any instructions for the admin" multiline numberOfLines={3} placeholderTextColor="#9CA3AF" />

                  {error ? (
                    <View style={styles.errorBox}>
                      <Ionicons name="alert-circle" size={18} color={LingoTheme.colors.danger} />
                      <ThemedText style={styles.errorText}>{error}</ThemedText>
                    </View>
                  ) : null}

                  <View style={styles.actionsWrap}>
                    <LingoButton label="Save payout details" icon="checkmark" onPress={saveManualPayout} loading={busyAction === 'savingManual'} />
                    {editingManual ? <LingoButton label="Cancel" variant="secondary" onPress={() => { setEditingManual(false); setError(null); }} /> : null}
                  </View>
                </View>
              )}

              {successMsg ? (
                <View style={styles.successBox}>
                  <Ionicons name="checkmark-circle" size={18} color="#15803D" />
                  <ThemedText style={styles.successText}>{successMsg}</ThemedText>
                </View>
              ) : null}
            </LingoCard>
          )}

          <LingoCard style={styles.infoCard}>
            <ThemedText style={styles.infoTitle}>How payouts work</ThemedText>
            <View style={styles.infoRows}>
              {stripeSupported ? (
                <>
                  <View style={styles.infoRow}><Ionicons name="calculator-outline" size={18} color={LingoTheme.colors.teal} /><ThemedText style={styles.infoText}>Booking totals are calculated from your hourly rate and chosen package.</ThemedText></View>
                  <View style={styles.infoRow}><Ionicons name="shield-checkmark-outline" size={18} color={LingoTheme.colors.teal} /><ThemedText style={styles.infoText}>Gross amount, platform fee, and your net are stored in Stripe for every payment.</ThemedText></View>
                  <View style={styles.infoRow}><Ionicons name="cash-outline" size={18} color={LingoTheme.colors.teal} /><ThemedText style={styles.infoText}>Once payouts are enabled, transfers follow your Stripe payout schedule.</ThemedText></View>
                </>
              ) : (
                <>
                  <View style={styles.infoRow}><Ionicons name="calculator-outline" size={18} color={LingoTheme.colors.teal} /><ThemedText style={styles.infoText}>Booking totals are calculated from your hourly rate. A platform fee is deducted.</ThemedText></View>
                  <View style={styles.infoRow}><Ionicons name="time-outline" size={18} color={LingoTheme.colors.teal} /><ThemedText style={styles.infoText}>Earnings accumulate in your account. The admin reviews and sends them periodically (typically weekly).</ThemedText></View>
                  <View style={styles.infoRow}><Ionicons name="mail-outline" size={18} color={LingoTheme.colors.teal} /><ThemedText style={styles.infoText}>You will be notified by email when a transfer is sent to your Payoneer, Wise, or bank account.</ThemedText></View>
                  <View style={styles.infoRow}><Ionicons name="help-circle-outline" size={18} color={LingoTheme.colors.teal} /><ThemedText style={styles.infoText}>For payout questions contact support via the chat screen.</ThemedText></View>
                </>
              )}
            </View>
          </LingoCard>

          {stripeSupported && !status.connected ? (
            <LingoCard>
              <LingoEmptyState icon="wallet-outline" title="Connect Stripe when you're ready" subtitle="You only need a few onboarding steps to start receiving teacher payouts securely." tone="gold" />
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
  topBarTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: '#111827' },
  topBarSub: { fontSize: 13, color: '#9CA3AF', fontWeight: '400', marginTop: 2 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, paddingHorizontal: 2 },
  statChip: { flex: 1, alignItems: 'center', gap: 6 },
  statIconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  pillValue: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  pillLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  statDivider: { width: 1, height: 48, backgroundColor: '#E5E7EB' },
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
  warningBox: { backgroundColor: LingoTheme.colors.softGold, borderRadius: 18, padding: 14, flexDirection: 'row', gap: 10, borderWidth: 2, borderColor: '#F4D778' },
  warningTitle: { fontSize: 13, fontWeight: '800', color: '#B7791F', marginBottom: 2 },
  warningText: { fontSize: 13, color: '#8A5A13', lineHeight: 19 },
  errorBox: { marginTop: 8, backgroundColor: LingoTheme.colors.softDanger, borderRadius: 18, padding: 14, flexDirection: 'row', gap: 10, borderWidth: 2, borderColor: '#F7A7A7' },
  errorText: { flex: 1, color: '#B42318', fontSize: 13, lineHeight: 19 },
  successBox: { marginTop: 8, backgroundColor: '#F0FDF4', borderRadius: 18, padding: 14, flexDirection: 'row', gap: 10, borderWidth: 2, borderColor: '#BBF7D0' },
  successText: { flex: 1, color: '#15803D', fontSize: 13, lineHeight: 19 },
  actionsWrap: { marginTop: 18, gap: 10 },
  infoCard: { backgroundColor: '#FFFFFF' },
  infoTitle: { fontSize: 18, fontWeight: '800', color: LingoTheme.colors.ink, marginBottom: 12 },
  infoRows: { gap: 12 },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 13, color: LingoTheme.colors.muted, lineHeight: 20 },
  // Manual payout form
  manualForm: { gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: LingoTheme.colors.ink, marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 2, borderColor: LingoTheme.colors.border, borderRadius: 14,
    padding: 14, fontSize: 15, color: LingoTheme.colors.ink, backgroundColor: '#FFFFFF',
  },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  methodRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  methodBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    borderWidth: 2, borderColor: LingoTheme.colors.border, borderRadius: 14,
    paddingVertical: 11, paddingHorizontal: 4, backgroundColor: '#FFFFFF',
  },
  methodBtnActive: { borderColor: LingoTheme.colors.primary, backgroundColor: '#EFF6FF' },
  methodBtnText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  methodBtnTextActive: { color: LingoTheme.colors.primary },
  // Saved summary
  savedSummary: { gap: 0 },
  savedRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  savedLabel: { fontSize: 13, color: LingoTheme.colors.muted, fontWeight: '600' },
  savedValue: { fontSize: 13, color: LingoTheme.colors.ink, fontWeight: '700', flexShrink: 1, textAlign: 'right', marginLeft: 8 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, alignSelf: 'flex-start' },
  editBtnText: { fontSize: 14, fontWeight: '700', color: LingoTheme.colors.primary },
});