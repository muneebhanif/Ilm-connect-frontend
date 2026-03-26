import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Skeleton } from '@/components/ui/skeleton';

export function ParentDashboardSkeleton() {
  useThemeColor({}, 'background');
  const surface = '#FFF';
  const pageBg = '#F9FAFB';

  return (
    <View style={[styles.screen, { backgroundColor: pageBg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: surface }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Skeleton height={14} width={120} borderRadius={8} />
            <Skeleton height={24} width={180} borderRadius={12} style={{ marginTop: 10 }} />
          </View>
          <Skeleton height={40} width={40} borderRadius={20} />
        </View>

        {/* Stats strip */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Skeleton height={14} width={90} borderRadius={8} />
            <Skeleton height={22} width={60} borderRadius={11} style={{ marginTop: 10 }} />
          </View>
          <View style={styles.statCard}>
            <Skeleton height={14} width={90} borderRadius={8} />
            <Skeleton height={22} width={60} borderRadius={11} style={{ marginTop: 10 }} />
          </View>
          <View style={styles.statCard}>
            <Skeleton height={14} width={90} borderRadius={8} />
            <Skeleton height={22} width={60} borderRadius={11} style={{ marginTop: 10 }} />
          </View>
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {/* "My Child" section */}
        <View style={styles.sectionHeader}>
          <Skeleton height={18} width={120} borderRadius={10} />
          <Skeleton height={14} width={90} borderRadius={8} />
        </View>
        <View style={[styles.card, { backgroundColor: surface }]}>
          <View style={styles.cardRow}>
            <Skeleton height={44} width={44} borderRadius={22} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Skeleton height={16} width={'55%'} borderRadius={10} />
              <Skeleton height={12} width={'35%'} borderRadius={8} style={{ marginTop: 10 }} />
            </View>
          </View>
          <View style={styles.progressRow}>
            <Skeleton height={10} width={'100%'} borderRadius={8} />
          </View>
        </View>

        {/* Upcoming Classes */}
        <View style={styles.sectionHeader}>
          <Skeleton height={18} width={160} borderRadius={10} />
          <Skeleton height={14} width={70} borderRadius={8} />
        </View>
        <View style={[styles.card, { backgroundColor: surface }]}>
          <Skeleton height={16} width={'65%'} borderRadius={10} />
          <Skeleton height={12} width={'45%'} borderRadius={8} style={{ marginTop: 10 }} />
          <Skeleton height={12} width={'35%'} borderRadius={8} style={{ marginTop: 10 }} />
          <Skeleton height={38} width={'100%'} borderRadius={12} style={{ marginTop: 14 }} />
        </View>
      </View>
    </View>
  );
}

export function TeacherDashboardSkeleton() {
  useThemeColor({}, 'background');
  const surface = '#FFF';
  const pageBg = '#F9FAFB';

  return (
    <View style={[styles.screen, { backgroundColor: pageBg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: surface }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Skeleton height={14} width={120} borderRadius={8} />
            <Skeleton height={24} width={180} borderRadius={12} style={{ marginTop: 10 }} />
          </View>
          <Skeleton height={40} width={40} borderRadius={20} />
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {/* Overview */}
        <Skeleton height={18} width={110} borderRadius={10} style={{ marginBottom: 14 }} />
        <View style={[styles.bigCard, { backgroundColor: surface }]}>
          <View style={styles.bigCardRow}>
            <View style={{ flex: 1 }}>
              <Skeleton height={14} width={120} borderRadius={8} />
              <Skeleton height={26} width={90} borderRadius={13} style={{ marginTop: 10 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Skeleton height={14} width={120} borderRadius={8} />
              <Skeleton height={26} width={90} borderRadius={13} style={{ marginTop: 10 }} />
            </View>
          </View>
        </View>

        {/* Grid */}
        <View style={styles.gridRow}>
          <View style={styles.gridCard}>
            <View style={{ backgroundColor: surface, borderRadius: 16, padding: 16 }}>
            <Skeleton height={18} width={80} borderRadius={10} />
            <Skeleton height={22} width={60} borderRadius={11} style={{ marginTop: 10 }} />
            </View>
          </View>
          <View style={styles.gridCard}>
            <View style={{ backgroundColor: surface, borderRadius: 16, padding: 16 }}>
            <Skeleton height={18} width={80} borderRadius={10} />
            <Skeleton height={22} width={60} borderRadius={11} style={{ marginTop: 10 }} />
            </View>
          </View>
        </View>

        {/* Profile Details */}
        <View style={styles.sectionHeader}>
          <Skeleton height={18} width={140} borderRadius={10} />
          <Skeleton height={14} width={40} borderRadius={8} />
        </View>
        <View style={[styles.card, { backgroundColor: surface }]}>
          <Skeleton height={16} width={'55%'} borderRadius={10} />
          <Skeleton height={16} width={'45%'} borderRadius={10} style={{ marginTop: 12 }} />
          <Skeleton height={16} width={'65%'} borderRadius={10} style={{ marginTop: 12 }} />
        </View>

        {/* Actions */}
        <Skeleton height={18} width={120} borderRadius={10} style={{ marginTop: 8, marginBottom: 14 }} />
        <View style={[styles.card, { backgroundColor: surface }]}>
          <View style={styles.actionRow}>
            <Skeleton height={44} width={44} borderRadius={22} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Skeleton height={16} width={'55%'} borderRadius={10} />
              <Skeleton height={12} width={'40%'} borderRadius={8} style={{ marginTop: 10 }} />
            </View>
          </View>
          <View style={[styles.actionRow, { marginTop: 14 }]}>
            <Skeleton height={44} width={44} borderRadius={22} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Skeleton height={16} width={'55%'} borderRadius={10} />
              <Skeleton height={12} width={'40%'} borderRadius={8} style={{ marginTop: 10 }} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressRow: {
    marginTop: 14,
  },
  bigCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
  },
  bigCardRow: {
    flexDirection: 'row',
    gap: 18,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  gridCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
