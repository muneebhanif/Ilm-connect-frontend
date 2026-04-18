import { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, Platform, RefreshControl, Image } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/config';
import { useFocusEffect } from '@react-navigation/native';
import { authFetch } from '@/lib/auth-fetch';
import { LinearGradient } from 'expo-linear-gradient';
import { MessagesSkeleton } from '@/components/ui/dashboard-skeletons';

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
        style={[styles.conversationItem, isUnread && styles.conversationItemUnread]}
        activeOpacity={0.84}
        onPress={() => router.push({
          pathname: '/chat/[id]' as any,
          params: { id: item.otherUserId, name: item.otherUser.full_name, avatar: item.otherUser.avatar_url || '' }
        })}
      >
        <View style={styles.avatarWrap}>
          {item.otherUser.avatar_url ? (
            <Image
              source={{ uri: item.otherUser.avatar_url }}
              style={styles.avatarImage}
            />
          ) : (
            <LinearGradient colors={['#4ECDC4', '#14B8A6']} style={styles.avatar}>
              <ThemedText style={styles.avatarText}>
                {item.otherUser.full_name.charAt(0).toUpperCase()}
              </ThemedText>
            </LinearGradient>
          )}
          {isUnread ? <View style={styles.onlineDot} /> : null}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <ThemedText style={[styles.userName, isUnread && styles.userNameUnread]} numberOfLines={1}>
              {item.otherUser.full_name}
            </ThemedText>
            <ThemedText style={[styles.timeText, isUnread && styles.timeTextUnread]}>
              {formatTime(item.last_message_at)}
            </ThemedText>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.roleBadge}>
              <Ionicons name="person-outline" size={12} color="#0F766E" />
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
                <Ionicons name="checkmark-done-outline" size={12} color="#6B7280" />
                <ThemedText style={styles.readBadgeText}>Up to date</ThemedText>
              </View>
            )}
          </View>

          <View style={styles.messagePreview}>
            <ThemedText style={[styles.previewText, isUnread && styles.previewTextUnread]} numberOfLines={1}>
              {isUnread ? 'Open chat and reply to this parent' : 'Tap to view conversation history'}
            </ThemedText>
            <Ionicons name="chevron-forward" size={18} color={isUnread ? '#14B8A6' : '#CBD5E1'} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="chatbubbles-outline" size={40} color="#14B8A6" />
      </View>
      <ThemedText style={styles.emptyTitle}>No Messages Yet</ThemedText>
      <ThemedText style={styles.emptySubtitle}>
        Parent conversations will appear here once someone reaches out about your classes or courses.
      </ThemedText>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F172A', '#134E4A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <ThemedText style={styles.headerEyebrow}>Teacher Inbox</ThemedText>
        <ThemedText style={styles.headerTitle}>Messages</ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          Stay on top of parent questions and reply faster.
        </ThemedText>

        <View style={styles.headerStatsRow}>
          <View style={styles.headerStatCard}>
            <ThemedText style={styles.headerStatValue}>{conversations.length}</ThemedText>
            <ThemedText style={styles.headerStatLabel}>Chats</ThemedText>
          </View>
          <View style={styles.headerStatCard}>
            <ThemedText style={styles.headerStatValue}>{unreadConversations}</ThemedText>
            <ThemedText style={styles.headerStatLabel}>Unread chats</ThemedText>
          </View>
          <View style={styles.headerStatCard}>
            <ThemedText style={styles.headerStatValue}>{totalUnreadMessages}</ThemedText>
            <ThemedText style={styles.headerStatLabel}>Unread msgs</ThemedText>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <MessagesSkeleton />
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          style={styles.listView}
          contentContainerStyle={conversations.length === 0 ? styles.emptyList : styles.list}
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
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 64 : 52,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.72)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 6,
  },
  headerStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  headerStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  headerStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.74)',
    marginTop: 3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  listView: {
    flex: 1,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  conversationItemUnread: {
    borderColor: '#99F6E4',
    backgroundColor: '#FCFFFE',
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
    shadowColor: '#14B8A6',
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
    backgroundColor: '#10B981',
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
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 8,
  },
  userNameUnread: {
    color: '#111827',
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
    backgroundColor: '#CCFBF1',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  timeTextUnread: {
    color: '#0F766E',
  },
  messagePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    flex: 1,
  },
  previewTextUnread: {
    color: '#0F172A',
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    alignItems: 'center',
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  readBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  readBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
  },
});
