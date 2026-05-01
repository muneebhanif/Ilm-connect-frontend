import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, RefreshControl, Image, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/config';
import { useFocusEffect } from '@react-navigation/native';
import { authFetch } from '@/lib/auth-fetch';
import { LinearGradient } from 'expo-linear-gradient';
import { MessagesSkeleton } from '@/components/ui/dashboard-skeletons';
import { LingoCard, LingoEmptyState } from '@/components/ui/lingo-mobile';
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

export default function TeacherMessagesScreen() {
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
    () => conversations.filter((conversation) => conversation.unreadCount > 0).length,
    [conversations]
  );

  const totalUnreadMessages = useMemo(
    () => conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0),
    [conversations]
  );

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString(undefined, { weekday: 'short' });
    } else {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const isUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity
        style={styles.touchCard}
        activeOpacity={0.84}
        onPress={() => router.push({
          pathname: '/chat/[id]' as any,
          params: { id: item.otherUserId, name: item.otherUser.full_name, avatar: item.otherUser.avatar_url || '' }
        })}
      >
        <LingoCard style={[styles.conversationItem, isUnread && styles.conversationItemUnread]}>
          <View style={styles.conversationRow}>
            <View style={styles.avatarWrap}>
              {item.otherUser.avatar_url ? (
                <Image
                  source={{ uri: item.otherUser.avatar_url }}
                  style={styles.avatarImage}
                />
              ) : (
                <LinearGradient colors={[LingoTheme.colors.teal, '#22C55E']} style={styles.avatar}>
                  <ThemedText style={styles.avatarText}>
                    {item.otherUser.full_name.charAt(0).toUpperCase()}
                  </ThemedText>
                </LinearGradient>
              )}
              {isUnread ? <View style={styles.onlineDot} /> : null}
            </View>

            <View style={styles.conversationContent}>
              <View style={styles.conversationHeader}>
                <ThemedText style={styles.userName} numberOfLines={1}>
                  {item.otherUser.full_name}
                </ThemedText>
                <ThemedText style={styles.timeText}>{formatTime(item.last_message_at)}</ThemedText>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.roleBadge}>
                  <Ionicons name="person-outline" size={12} color={LingoTheme.colors.teal} />
                  <ThemedText style={styles.roleBadgeText}>Parent</ThemedText>
                </View>
                {isUnread ? (
                  <View style={styles.unreadBadge}>
                    <ThemedText style={styles.unreadText}>
                      {item.unreadCount > 99 ? '99+' : item.unreadCount} new
                    </ThemedText>
                  </View>
                ) : (
                  <View style={styles.readBadge}>
                    <Ionicons name="checkmark-done-outline" size={12} color={LingoTheme.colors.muted} />
                    <ThemedText style={styles.readBadgeText}>Up to date</ThemedText>
                  </View>
                )}
              </View>

              <View style={styles.messagePreview}>
                <ThemedText style={[styles.previewText, isUnread && styles.previewTextUnread]} numberOfLines={1}>
                  {isUnread ? 'Open chat and reply to this parent' : 'Tap to view conversation history'}
                </ThemedText>
                <Ionicons name="chevron-forward" size={18} color={isUnread ? LingoTheme.colors.teal : '#CBD5E1'} />
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
        subtitle="Parent conversations will appear here once someone reaches out about your classes or courses."
        tone="teal"
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
          style={styles.listView}
          contentContainerStyle={[
            styles.list,
            { paddingTop: topPadding, paddingBottom: bottomPadding + (Platform.OS === 'ios' ? 120 : 100) },
            conversations.length === 0 && styles.emptyList,
          ]}
          ListHeaderComponent={
            <View style={{ paddingTop: topPadding, paddingHorizontal: 16, paddingBottom: 8 }}>
              {/* Top Bar */}
              <View style={styles.topBar}>
                <View style={styles.iconCircle}>
                  <Ionicons name="chatbubbles" size={22} color="#F59E0B" />
                </View>
                <View style={styles.topBarCenter}>
                  <ThemedText style={styles.topBarTitle}>Messages</ThemedText>
                  <ThemedText style={styles.topBarSub}>Parent conversations</ThemedText>
                </View>
                <View style={{ width: 44 }} />
              </View>
              {/* Stats Row */}
              <View style={styles.statsRow}>
                <View style={styles.metricPill}>
                  <ThemedText style={styles.pillIcon}>💬</ThemedText>
                  <ThemedText style={styles.pillValue}>{conversations.length}</ThemedText>
                  <ThemedText style={styles.pillLabel}>Chats</ThemedText>
                </View>
                <View style={styles.metricPill}>
                  <ThemedText style={styles.pillIcon}>📨</ThemedText>
                  <ThemedText style={styles.pillValue}>{unreadConversations}</ThemedText>
                  <ThemedText style={styles.pillLabel}>Unread</ThemedText>
                </View>
                <View style={styles.metricPill}>
                  <ThemedText style={styles.pillIcon}>✨</ThemedText>
                  <ThemedText style={styles.pillValue}>{totalUnreadMessages}</ThemedText>
                  <ThemedText style={styles.pillLabel}>New msgs</ThemedText>
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
              tintColor="#4ECDC4"
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
    backgroundColor: LingoTheme.colors.background,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFF7D6',
    borderWidth: 2, borderColor: '#F59E0B', borderBottomWidth: 4,
    justifyContent: 'center', alignItems: 'center',
  },
  topBarCenter: { flex: 1, alignItems: 'center' },
  topBarTitle: { fontSize: 20, fontWeight: '800', color: '#3C3C3C' },
  topBarSub: { fontSize: 13, color: '#AFAFAF', fontWeight: '600', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginBottom: 8 },
  metricPill: {
    flex: 1, alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, borderWidth: 2, borderColor: '#E5E5E5', borderBottomWidth: 4,
    paddingVertical: 12, paddingHorizontal: 4,
  },
  pillIcon: { fontSize: 18, marginBottom: 2 },
  pillValue: { fontSize: 18, fontWeight: '800', color: '#3C3C3C' },
  pillLabel: { fontSize: 11, fontWeight: '700', color: '#AFAFAF', textTransform: 'uppercase' },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  listView: {
    flex: 1,
  },
  emptyList: {
    flexGrow: 1,
  },
  touchCard: {
    marginBottom: 12,
  },
  conversationItem: {
    padding: 16,
  },
  conversationItemUnread: {
    backgroundColor: '#FCFFFC',
    borderColor: '#9FE5DA',
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    marginRight: 14,
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: LingoTheme.colors.teal,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 4,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  onlineDot: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: LingoTheme.colors.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    marginRight: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: LingoTheme.colors.softTeal,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: LingoTheme.colors.teal,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: LingoTheme.colors.muted,
  },
  messagePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewText: {
    fontSize: 14,
    fontWeight: '500',
    color: LingoTheme.colors.muted,
    flex: 1,
  },
  previewTextUnread: {
    color: LingoTheme.colors.ink,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: LingoTheme.colors.softPrimary,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    alignItems: 'center',
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '700',
    color: LingoTheme.colors.primaryDark,
  },
  readBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#F4F4EF',
  },
  readBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: LingoTheme.colors.muted,
  },
});
