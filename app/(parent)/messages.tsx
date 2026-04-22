import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/config';
import { useFocusEffect } from '@react-navigation/native';
import { authFetch } from '@/lib/auth-fetch';
import { MessagesSkeleton } from '@/components/ui/dashboard-skeletons';
import { LinearGradient } from 'expo-linear-gradient';
import { LingoCard, LingoEmptyState, LingoScreenHeader, LingoStatPill } from '@/components/ui/lingo-mobile';
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
        activeOpacity={0.7}
        onPress={() => router.push({
          pathname: '/chat/[id]' as any,
        params: { id: item.otherUserId, name: item.otherUser.full_name, avatar: item.otherUser.avatar_url || '' }
      })}
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
              <LinearGradient colors={[LingoTheme.colors.primary, '#22C55E']} style={styles.avatar}>
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
              <ThemedText style={styles.timeText}>{formatTime(item.last_message_at)}</ThemedText>
            </View>

            <View style={styles.messagePreview}>
              <ThemedText style={[styles.previewText, isUnread && styles.previewTextUnread]} numberOfLines={1}>
                {isUnread ? 'You have a new teacher reply waiting' : 'Tap to view conversation'}
              </ThemedText>

              {item.unreadCount > 0 ? (
                <View style={styles.unreadBadge}>
                  <ThemedText style={styles.unreadText}>
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </ThemedText>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={16} color="#E5E7EB" style={styles.chevron} />
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
            { paddingTop: topPadding, paddingBottom: bottomPadding + 24 },
            conversations.length === 0 && styles.emptyList,
          ]}
          ListHeaderComponent={
            <LingoScreenHeader
              badge="Parent hub"
              icon="chatbubbles"
              title="Messages that stay friendly"
              subtitle="Keep teacher replies, follow-ups, and scheduling chats organized in one calm inbox."
            >
              <View style={styles.headerStatsRow}>
                <LingoStatPill icon="💬" value={String(conversations.length)} label="Chats" tone="primary" />
                <LingoStatPill icon="✨" value={String(unreadConversations)} label="Unread chats" tone="teal" />
                <LingoStatPill icon="📨" value={String(totalUnreadMessages)} label="New msgs" tone="gold" />
              </View>
            </LingoScreenHeader>
          }
          ListEmptyComponent={<EmptyState />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4ECDC4"
              colors={['#4ECDC4']}
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
  headerStatsRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  touchCard: {
    marginBottom: 12,
  },
  conversationItem: {
    padding: 16,
  },
  unreadItem: {
    backgroundColor: '#FCFFFC',
    borderColor: '#CFEAA9',
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 16,
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: LingoTheme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  conversationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: LingoTheme.colors.ink,
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
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
    marginRight: 8,
  },
  previewTextUnread: {
    color: LingoTheme.colors.ink,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: LingoTheme.colors.primary,
    paddingHorizontal: 8,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 14,
  },
  chevron: {
    opacity: 0.5,
  },
});