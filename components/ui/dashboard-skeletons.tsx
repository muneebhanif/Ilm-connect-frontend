import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Parent Dashboard Skeleton
 */
export function ParentDashboardSkeleton() {
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
      <View style={styles.body}>
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

/**
 * Teacher Dashboard Skeleton
 */
export function TeacherDashboardSkeleton() {
  const surface = '#FFF';
  const pageBg = '#F9FAFB';

  return (
    <View style={[styles.screen, { backgroundColor: pageBg }]}>
      <View style={[styles.header, { backgroundColor: surface }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Skeleton height={14} width={120} borderRadius={8} />
            <Skeleton height={24} width={180} borderRadius={12} style={{ marginTop: 10 }} />
          </View>
          <Skeleton height={40} width={40} borderRadius={20} />
        </View>
      </View>
      <View style={styles.body}>
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
        <View style={styles.sectionHeader}>
          <Skeleton height={18} width={140} borderRadius={10} />
          <Skeleton height={14} width={40} borderRadius={8} />
        </View>
        <View style={[styles.card, { backgroundColor: surface }]}>
          <Skeleton height={16} width={'55%'} borderRadius={10} />
          <Skeleton height={16} width={'45%'} borderRadius={10} style={{ marginTop: 12 }} />
          <Skeleton height={16} width={'65%'} borderRadius={10} style={{ marginTop: 12 }} />
        </View>
      </View>
    </View>
  );
}

/**
 * Student Dashboard Skeleton - matches gradient header + cards layout
 */
export function StudentDashboardSkeleton() {
  const pageBg = '#F9FAFB';
  const surface = '#FFF';

  return (
    <View style={[styles.screen, { backgroundColor: pageBg }]}>
      {/* Gradient header placeholder */}
      <View style={styles.gradientHeader}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Skeleton height={14} width={100} borderRadius={8} />
            <Skeleton height={24} width={160} borderRadius={12} style={{ marginTop: 10 }} />
          </View>
          <Skeleton height={48} width={48} borderRadius={24} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Skeleton height={30} width={110} borderRadius={16} />
          <Skeleton height={30} width={90} borderRadius={16} />
        </View>
      </View>

      <View style={[styles.body, { marginTop: -8 }]}>
        {/* Stats Grid */}
        <View style={styles.statsRow}>
          {[1, 2, 3].map(i => (
            <View key={i} style={[styles.statCard, { backgroundColor: surface, borderRadius: 16, padding: 14, alignItems: 'center' }]}>
              <Skeleton height={36} width={36} borderRadius={12} />
              <Skeleton height={22} width={40} borderRadius={10} style={{ marginTop: 8 }} />
              <Skeleton height={12} width={60} borderRadius={6} style={{ marginTop: 4 }} />
            </View>
          ))}
        </View>

        {/* Progress Card */}
        <Skeleton height={18} width={110} borderRadius={10} style={{ marginBottom: 14 }} />
        <View style={[styles.card, { backgroundColor: surface, alignItems: 'center' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%' }}>
            {[1, 2, 3].map(i => (
              <View key={i} style={{ alignItems: 'center' }}>
                <Skeleton height={72} width={72} borderRadius={36} />
                <Skeleton height={12} width={50} borderRadius={6} style={{ marginTop: 8 }} />
              </View>
            ))}
          </View>
        </View>

        {/* Next Class */}
        <View style={styles.sectionHeader}>
          <Skeleton height={18} width={100} borderRadius={10} />
          <Skeleton height={14} width={60} borderRadius={8} />
        </View>
        <View style={[styles.card, { backgroundColor: surface }]}>
          <View style={styles.cardRow}>
            <Skeleton height={44} width={44} borderRadius={14} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Skeleton height={16} width={'60%'} borderRadius={10} />
              <Skeleton height={12} width={'40%'} borderRadius={8} style={{ marginTop: 8 }} />
            </View>
            <Skeleton height={28} width={60} borderRadius={10} />
          </View>
        </View>

        {/* Quick Actions */}
        <Skeleton height={18} width={120} borderRadius={10} style={{ marginTop: 8, marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={{ width: '47%', backgroundColor: surface, borderRadius: 16, padding: 18, alignItems: 'center' }}>
              <Skeleton height={48} width={48} borderRadius={16} />
              <Skeleton height={14} width={70} borderRadius={8} style={{ marginTop: 10 }} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * Student Classes Skeleton
 */
export function StudentClassesSkeleton() {
  const pageBg = '#F9FAFB';
  const surface = '#FFF';

  return (
    <View style={[styles.screen, { backgroundColor: pageBg }]}>
      <View style={styles.gradientHeader}>
        <Skeleton height={24} width={130} borderRadius={12} />
        <Skeleton height={14} width={200} borderRadius={8} style={{ marginTop: 8 }} />
        <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 14, marginTop: 16 }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Skeleton height={22} width={30} borderRadius={10} />
            <Skeleton height={12} width={60} borderRadius={6} style={{ marginTop: 4 }} />
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Skeleton height={22} width={30} borderRadius={10} />
            <Skeleton height={12} width={60} borderRadius={6} style={{ marginTop: 4 }} />
          </View>
        </View>
      </View>
      <View style={styles.body}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Skeleton height={18} width={18} borderRadius={9} />
          <Skeleton height={18} width={80} borderRadius={10} />
        </View>
        {[1, 2, 3].map(i => (
          <View key={i} style={[styles.card, { backgroundColor: surface, flexDirection: 'row', alignItems: 'center' }]}>
            <Skeleton height={58} width={52} borderRadius={14} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Skeleton height={15} width={'65%'} borderRadius={8} />
              <Skeleton height={12} width={'45%'} borderRadius={6} style={{ marginTop: 6 }} />
              <Skeleton height={12} width={'35%'} borderRadius={6} style={{ marginTop: 4 }} />
            </View>
            <Skeleton height={38} width={70} borderRadius={12} />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Student Recordings Skeleton
 */
export function StudentRecordingsSkeleton() {
  const pageBg = '#F9FAFB';
  const surface = '#FFF';

  return (
    <View style={[styles.screen, { backgroundColor: pageBg }]}>
      <View style={[styles.gradientHeader, { alignItems: 'center' }]}>
        <Skeleton height={56} width={56} borderRadius={18} />
        <Skeleton height={24} width={130} borderRadius={12} style={{ marginTop: 12 }} />
        <Skeleton height={14} width={180} borderRadius={8} style={{ marginTop: 6 }} />
      </View>
      <View style={styles.body}>
        {[1, 2, 3].map(i => (
          <View key={i} style={[styles.card, { backgroundColor: surface }]}>
            <View style={styles.cardRow}>
              <Skeleton height={44} width={44} borderRadius={14} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Skeleton height={16} width={'60%'} borderRadius={10} />
                <Skeleton height={12} width={'40%'} borderRadius={6} style={{ marginTop: 6 }} />
              </View>
              <Skeleton height={24} width={50} borderRadius={8} />
            </View>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
              <Skeleton height={14} width={80} borderRadius={7} />
              <Skeleton height={14} width={50} borderRadius={7} />
            </View>
            <Skeleton height={44} width={'100%'} borderRadius={12} style={{ marginTop: 14 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Student Profile Skeleton
 */
export function StudentProfileSkeleton() {
  const pageBg = '#F9FAFB';
  const surface = '#FFF';

  return (
    <View style={[styles.screen, { backgroundColor: pageBg }]}>
      <View style={[styles.gradientHeader, { alignItems: 'center', paddingBottom: 32 }]}>
        <Skeleton height={88} width={88} borderRadius={44} />
        <Skeleton height={22} width={140} borderRadius={11} style={{ marginTop: 16 }} />
        <Skeleton height={14} width={170} borderRadius={8} style={{ marginTop: 6 }} />
      </View>
      <View style={styles.body}>
        <Skeleton height={18} width={130} borderRadius={10} style={{ marginBottom: 14 }} />
        <View style={[styles.card, { backgroundColor: surface }]}>
          {[1, 2, 3].map(i => (
            <React.Fragment key={i}>
              <View style={styles.cardRow}>
                <Skeleton height={40} width={40} borderRadius={12} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Skeleton height={12} width={60} borderRadius={6} />
                  <Skeleton height={15} width={'50%'} borderRadius={8} style={{ marginTop: 4 }} />
                </View>
              </View>
              {i < 3 && <View style={{ height: 1, backgroundColor: '#F3F4F6', marginVertical: 14, marginLeft: 54 }} />}
            </React.Fragment>
          ))}
        </View>
        <Skeleton height={18} width={130} borderRadius={10} style={{ marginTop: 8, marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <View key={i} style={{ flex: 1, backgroundColor: surface, borderRadius: 16, padding: 16, alignItems: 'center' }}>
              <Skeleton height={40} width={40} borderRadius={12} />
              <Skeleton height={20} width={40} borderRadius={10} style={{ marginTop: 8 }} />
              <Skeleton height={12} width={50} borderRadius={6} style={{ marginTop: 4 }} />
            </View>
          ))}
        </View>
        <Skeleton height={48} width={'100%'} borderRadius={14} style={{ marginTop: 24 }} />
      </View>
    </View>
  );
}

/**
 * Teacher Courses Skeleton
 */
export function TeacherCoursesSkeleton() {
  const pageBg = '#F9FAFB';
  const surface = '#FFF';

  return (
    <View style={[styles.screen, { backgroundColor: pageBg }]}>
      <View style={[styles.gradientHeaderRed]}>
        <View style={styles.headerRow}>
          <View>
            <Skeleton height={24} width={140} borderRadius={12} />
            <Skeleton height={14} width={120} borderRadius={8} style={{ marginTop: 6 }} />
          </View>
          <Skeleton height={44} width={44} borderRadius={14} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 16 }}>
        {[1, 2, 3].map(i => (
          <View key={i} style={{ flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: i === 1 ? '#FEF3C7' : i === 2 ? '#ECFDF5' : '#EFF6FF' }}>
            <Skeleton height={20} width={30} borderRadius={10} />
            <Skeleton height={12} width={40} borderRadius={6} style={{ marginTop: 4 }} />
          </View>
        ))}
      </View>
      <View style={[styles.body, { paddingTop: 16 }]}>
        {[1, 2, 3].map(i => (
          <View key={i} style={[styles.card, { backgroundColor: surface }]}>
            <View style={styles.cardRow}>
              <Skeleton height={44} width={44} borderRadius={14} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Skeleton height={16} width={'60%'} borderRadius={10} />
                <Skeleton height={12} width={'40%'} borderRadius={6} style={{ marginTop: 6 }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Skeleton height={34} width={34} borderRadius={10} />
                <Skeleton height={34} width={34} borderRadius={10} />
              </View>
            </View>
            <Skeleton height={12} width={'80%'} borderRadius={6} style={{ marginTop: 10 }} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Skeleton height={22} width={80} borderRadius={8} />
              <Skeleton height={22} width={70} borderRadius={8} />
              <Skeleton height={22} width={50} borderRadius={8} style={{ marginLeft: 'auto' }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Browse Courses Skeleton (for Parent)
 */
export function BrowseCoursesSkeleton() {
  const surface = '#FFF';
  const pageBg = '#F9FAFB';

  return (
    <View style={[styles.screen, { backgroundColor: pageBg }]}>
      <View style={{ backgroundColor: surface, paddingTop: 60, paddingBottom: 12, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <View style={styles.headerRow}>
          <Skeleton height={24} width={160} borderRadius={12} />
          <Skeleton height={30} width={90} borderRadius={16} />
        </View>
        <View style={{ backgroundColor: '#F3F4F6', borderRadius: 14, height: 48, marginTop: 14 }}>
          <Skeleton height={20} width={180} borderRadius={10} style={{ margin: 14 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} height={32} width={80 + i * 10} borderRadius={20} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} height={28} width={80} borderRadius={16} />
          ))}
        </View>
      </View>
      <View style={styles.body}>
        {[1, 2, 3].map(i => (
          <View key={i} style={[styles.card, { backgroundColor: surface }]}>
            <View style={styles.cardRow}>
              <Skeleton height={48} width={48} borderRadius={16} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Skeleton height={16} width={'65%'} borderRadius={10} />
                <Skeleton height={12} width={'35%'} borderRadius={6} style={{ marginTop: 6 }} />
              </View>
              <Skeleton height={30} width={50} borderRadius={10} />
            </View>
            <Skeleton height={12} width={'85%'} borderRadius={6} style={{ marginTop: 12 }} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <Skeleton height={22} width={75} borderRadius={8} />
              <Skeleton height={22} width={90} borderRadius={8} />
              <Skeleton height={22} width={70} borderRadius={8} style={{ marginLeft: 'auto' }} />
            </View>
          </View>
        ))}
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
  gradientHeader: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    backgroundColor: '#E0F2F1',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  gradientHeaderRed: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    backgroundColor: '#FEE2E2',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    paddingHorizontal: 20,
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
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
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
