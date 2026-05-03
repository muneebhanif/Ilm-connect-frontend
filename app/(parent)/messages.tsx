import { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Platform,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/config';
import { useFocusEffect } from '@react-navigation/native';
import { authFetch } from '@/lib/auth-fetch';
import { MessagesSkeleton } from '@/components/ui/dashboard-skeletons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  LingoCard,
  LingoEmptyState,
} from '@/components/ui/lingo-mobile';
import { LingoTheme } from '@/constants/theme';
import { useSafePadding } from '@/hooks/use-safe-padding';

interface Conversation {
  id: string;
  parent_id: string;
  teacher_id: string;
  last_message_at: string;
  otherUser: {
    full_name: string;
    avatar_url?: string;
  };
  otherUserId: string;
  unreadCount: number;
}

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { topPadding, bottomPadding } = useSafePadding();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConversations = async () => {
    try {
      const response = await authFetch(api.messages.conversations());
      const data = await response.json();
      if (data.conversations) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [user?.id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const unreadConversations = useMemo(
    () =>
      conversations.filter((conversation) => conversation.unreadCount > 0).length,
    [conversations]
  );

  const totalUnreadMessages = useMemo(
    () =>
      conversations.reduce(
        (sum, conversation) => sum + conversation.unreadCount,
        0
      ),
    [conversations]
  );

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString(undefined, { weekday: 'short' });
    } else {
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const isUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity
        style={styles.touchCard}
        activeOpacity={0.85} // tactile feedback per Lingo
        onPress={() =>
          router.push({
            pathname: '/chat/[id]' as any,
            params: {
              id: item.otherUserId,
              name: item.otherUser.full_name,
              avatar: item.otherUser.avatar_url || '',
            },
          })
        }
      >
        <LingoCard style={[styles.conversationItem, isUnread && styles.unreadItem]}>
          <View style={styles.conversationRow}>
            <View style={styles.avatarContainer}>
              {item.otherUser.avatar_url ? (
                <Image
                  source={{ uri: item.otherUser.avatar_url }}
                  style={styles.avatarImage}
                />
              ) : (
                <LinearGradient
                  colors={[LingoTheme.colors.primary, LingoTheme.colors.primaryDark]}
                  style={styles.avatar}
                >
                  <ThemedText style={styles.avatarText}>
                    {item.otherUser.full_name.charAt(0).toUpperCase()}
                  </ThemedText>
                </LinearGradient>
              )}
            </View>

            <View style={styles.conversationContent}>
              <View style={styles.conversationHeader}>
                <ThemedText style={styles.userName} numberOfLines={1}>
                  {item.otherUser.full_name}
                </ThemedText>
                <ThemedText style={styles.timeText}>
                  {formatTime(item.last_message_at)}
                </ThemedText>
              </View>

              <View style={styles.messagePreview}>
                <ThemedText
                  style={[
                    styles.previewText,
                    isUnread && styles.previewTextUnread,
                  ]}
                  numberOfLines={1}
                >
                  {isUnread
                    ? 'You have a new teacher reply waiting'
                    : 'Tap to view conversation'}
                </ThemedText>

                {item.unreadCount > 0 ? (
                  <View style={styles.unreadBadge}>
                    <ThemedText style={styles.unreadText}>
                      {item.unreadCount > 99 ? '99+' : item.unreadCount}
                    </ThemedText>
                  </View>
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={LingoTheme.colors.textTertiary}
                    style={styles.chevron}
                  />
                )}
              </View>
            </View>
          </View>
        </LingoCard>
      </TouchableOpacity>
    );
  };

  const EmptyState = () => (
    <LingoCard>
      <LingoEmptyState
        icon="chatbubbles-outline"
        title="No messages yet"
        subtitle="Start a chat with a teacher and your conversations will appear here in a simple inbox view."
        tone="primary"
      />
    </LingoCard>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <MessagesSkeleton />
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            {
              paddingTop: topPadding,
              paddingBottom: bottomPadding + (Platform.OS === 'ios' ? 120 : 100),
            },
            conversations.length === 0 && styles.emptyList,
          ]}
          ListHeaderComponent={
            <View style={[styles.topBarWrap, { paddingTop: topPadding + 10 }]}>
              {/* Top Bar */}
              <View style={styles.topBar}>
                <ThemedText style={styles.topBarTitle}>Messages</ThemedText>
              </View>
              {/* Stats Row */}
              <View style={styles.statsRow}>
                <View style={styles.statChip}>
                  <View style={[styles.statIconBox, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="chatbubbles" size={22} color="#3B82F6" />
                  </View>
                  <ThemedText style={[styles.statValue, { color: '#3B82F6' }]}>{conversations.length}</ThemedText>
                  <ThemedText style={styles.statLabel}>Chats</ThemedText>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statChip}>
                  <View style={[styles.statIconBox, { backgroundColor: '#FFF7ED' }]}>
                    <Ionicons name="mail-unread" size={22} color="#F97316" />
                  </View>
                  <ThemedText style={[styles.statValue, { color: '#F97316' }]}>{unreadConversations}</ThemedText>
                  <ThemedText style={styles.statLabel}>Unread</ThemedText>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statChip}>
                  <View style={[styles.statIconBox, { backgroundColor: '#F0FDF4' }]}>
                    <Ionicons name="notifications" size={22} color="#22C55E" />
                  </View>
                  <ThemedText style={[styles.statValue, { color: '#22C55E' }]}>{totalUnreadMessages}</ThemedText>
                  <ThemedText style={styles.statLabel}>New msgs</ThemedText>
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={<EmptyState />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={LingoTheme.colors.primary}
              colors={[LingoTheme.colors.primary]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  topBarWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topBarIconBg: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#ECFCD8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#BBF7D0',
  },
  topBarTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#3C3C3C',
  },
  topBarSub: {
    fontSize: 13,
    color: '#AFAFAF',
    fontWeight: '600',
    marginTop: 1,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 2 },
  statChip: { flex: 1, alignItems: 'center', gap: 6 },
  statIconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  statValue: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  statLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  statDivider: { width: 1, height: 48, backgroundColor: '#E5E7EB' },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  touchCard: {
    marginBottom: LingoTheme.spacing[3], // 12
  },
  conversationItem: {
    padding: LingoTheme.spacing[4], // 16
  },
  unreadItem: {
    backgroundColor: LingoTheme.colors.softPrimary, // soft green tint
    borderColor: LingoTheme.colors.primaryLight, // light primary border
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: LingoTheme.spacing[4], // 16
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28, // circle: half of width/height
    justifyContent: 'center',
    alignItems: 'center',
    // Lingo tactile shadow on avatar
    shadowColor: LingoTheme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: LingoTheme.colors.surface,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: LingoTheme.colors.surface,
  },
  avatarText: {
    fontSize: LingoTheme.typography.sizes.lg, // 20
    fontWeight: LingoTheme.typography.weights.bold, // '700'
    color: LingoTheme.colors.textInverse,
  },
  conversationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: LingoTheme.spacing[1], // 4
  },
  userName: {
    fontSize: LingoTheme.typography.sizes.base, // 16
    fontWeight: LingoTheme.typography.weights.extrabold, // '800'
    color: LingoTheme.colors.ink,
    flex: 1,
    marginRight: LingoTheme.spacing[2], // 8
  },
  timeText: {
    fontSize: LingoTheme.typography.sizes.xs, // 12
    fontWeight: LingoTheme.typography.weights.bold, // '700'
    color: LingoTheme.colors.muted,
  },
  messagePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewText: {
    fontSize: LingoTheme.typography.sizes.sm, // 14
    fontWeight: LingoTheme.typography.weights.medium, // '500'
    color: LingoTheme.colors.muted,
    flex: 1,
    marginRight: LingoTheme.spacing[2],
  },
  previewTextUnread: {
    color: LingoTheme.colors.text,
    fontWeight: LingoTheme.typography.weights.semibold, // '600'
  },
  unreadBadge: {
    backgroundColor: LingoTheme.colors.primary,
    paddingHorizontal: LingoTheme.spacing[2], // 8
    minWidth: 22,
    height: 22,
    borderRadius: 11, // pill
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    fontSize: LingoTheme.typography.sizes.xs, // 12 (was 11, now on scale)
    fontWeight: LingoTheme.typography.weights.extrabold,
    color: LingoTheme.colors.textInverse,
    lineHeight: 14,
  },
  chevron: {
    opacity: 0.5,
  },
});