import { memo, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';

import type { ChatConversationSummary } from '@/domain/chat/types';

type ChatConversationListProps = Readonly<{
  conversations: readonly ChatConversationSummary[];
  initialKind?: 'private' | 'market';
  namesByPublicId: Readonly<Record<string, string>>;
  error: string | null;
  isLoading: boolean;
  onOpen: (conversation: ChatConversationSummary) => void;
  onDelete: (conversation: ChatConversationSummary) => void;
  deletingConversationId?: string | null;
  onRefresh: () => void;
  onStart: () => void;
}>;

function shortId(publicId: string): string {
  return publicId.slice(0, 8);
}

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ChatConversationListComponent({
  conversations,
  initialKind,
  namesByPublicId,
  error,
  isLoading,
  onOpen,
  onDelete,
  deletingConversationId,
  onRefresh,
  onStart,
}: ChatConversationListProps) {
  const [kind, setKind] = useState<'private' | 'market'>(initialKind ?? 'private');
  useEffect(() => { if (initialKind) setKind(initialKind); }, [initialKind]);
  const visibleConversations = conversations.filter((conversation) => (conversation.kind ?? 'private') === kind);
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#D8D8D8]">
        <ActivityIndicator color="#9A9A9A" />
        <Text className="mt-3 text-xs font-semibold text-black/45">Loading conversations…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-[#D8D8D8] px-7">
        <Text className="text-center text-sm font-bold text-g000st-red">{error}</Text>
        <Pressable
          accessibilityRole="button"
          className="mt-4 h-11 min-w-32 items-center justify-center rounded-full bg-white px-5"
          onPress={onRefresh}
        >
          <Text className="font-black text-g000st-black">Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#D8D8D8]">
      <View className="flex-row gap-2 p-3">
        {(['private', 'market'] as const).map((value) => (
          <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: kind === value }} onPress={() => setKind(value)} className={`rounded-full px-4 py-2 ${kind === value ? 'bg-black' : 'bg-white'}`}>
            <Text className={`text-xs font-black ${kind === value ? 'text-white' : 'text-black'}`}>{value === 'market' ? 'Market chats' : 'Private chats'}</Text>
          </Pressable>
        ))}
      </View>
    <FlatList
      className="flex-1 bg-[#D8D8D8]"
      contentContainerClassName="p-3"
      data={visibleConversations}
      ListEmptyComponent={<View className="items-center py-12"><Text className="text-center text-sm text-black/45">{kind === 'market' ? 'Your Market chats will appear here.' : 'Your private chats will appear here.'}</Text>{kind === 'private' && <Pressable accessibilityRole="button" className="mt-4 rounded-full bg-g000st-silver px-6 py-3" onPress={onStart}><Text className="font-black text-white">Start private chat</Text></Pressable>}</View>}
      keyExtractor={(item) => item.conversationId}
      onRefresh={onRefresh}
      refreshing={false}
      renderItem={({ item }) => (
        <View className="mb-2 flex-row items-center rounded-[18px] border border-white/60 bg-[#E2E2E2]">
          <Pressable
            accessibilityHint={item.kind === 'market' ? 'Opens this Market conversation' : 'Opens this private conversation'}
            accessibilityRole="button"
            className="min-w-0 flex-1 flex-row items-center p-3"
            onPress={() => onOpen(item)}
          >
          <View className="h-11 w-11 items-center justify-center rounded-full bg-g000st-silver">
            <Text className="text-base font-black text-white">g</Text>
          </View>
          <View className="ml-3 min-w-0 flex-1">
            <Text className="font-mono text-[12px] font-black text-g000st-black">
              {item.participantStatus === 'deleted'
                ? 'Deleted account'
                : namesByPublicId[item.participantPublicId] || item.participantDisplayName || shortId(item.participantPublicId)}
            </Text>
            <Text className="mt-1" numberOfLines={1}>
              <Text className="text-xs font-semibold text-black/45">
                {item.lastMessagePreview || (item.kind === 'market' ? 'Market conversation' : 'Private conversation')}
              </Text>
            </Text>
            {item.kind === 'market' && <Text className="mt-1 text-[10px] font-bold text-g000st-red">Market · Listing {item.marketPostId?.slice(0, 8)} · 30 days</Text>}
          </View>
          <View className="ml-2 items-end">
            <Text className="text-[10px] font-bold text-black/40">
              {formatTime(item.updatedAtMs)}
            </Text>
            {item.unreadCount > 0 ? (
              <View className="mt-1 min-w-5 items-center rounded-full bg-g000st-red px-1.5 py-0.5">
                <Text className="text-[10px] font-black text-white">
                  {Math.min(item.unreadCount, 99)}
                </Text>
              </View>
            ) : null}
          </View>
          </Pressable>
          <Pressable
            accessibilityLabel="Delete conversation"
            accessibilityRole="button"
            className="mr-2 min-h-11 min-w-11 items-center justify-center rounded-full"
            disabled={deletingConversationId === item.conversationId}
            onPress={() => onDelete(item)}
          >
            <Text className="text-[11px] font-bold text-g000st-red">Delete</Text>
          </Pressable>
        </View>
      )}
    />
    </View>
  );
}

export const ChatConversationList = memo(ChatConversationListComponent);
