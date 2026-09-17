import { memo } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';

import type { ChatConversationSummary } from '@/domain/chat/types';

type ChatConversationListProps = Readonly<{
  conversations: readonly ChatConversationSummary[];
  error: string | null;
  isLoading: boolean;
  onOpen: (conversation: ChatConversationSummary) => void;
  onRefresh: () => void;
  onStart: () => void;
}>;

function shortId(publicId: string): string {
  return `${publicId.slice(0, 12)}…${publicId.slice(-6)}`;
}

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ChatConversationListComponent({
  conversations,
  error,
  isLoading,
  onOpen,
  onRefresh,
  onStart,
}: ChatConversationListProps) {
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

  if (conversations.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-[#D8D8D8] px-7">
        <Text className="text-center text-[13px] font-semibold leading-5 text-black/45">
          Your private conversations will appear here.
        </Text>
        <Pressable
          accessibilityRole="button"
          className="mt-4 h-11 items-center justify-center rounded-full bg-g000st-silver px-6"
          onPress={onStart}
        >
          <Text className="font-black text-white">Start private chat</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-[#D8D8D8]"
      contentContainerClassName="p-3"
      data={conversations}
      keyExtractor={(item) => item.conversationId}
      onRefresh={onRefresh}
      refreshing={false}
      renderItem={({ item }) => (
        <Pressable
          accessibilityHint="Opens this private conversation"
          accessibilityRole="button"
          className="mb-2 flex-row items-center rounded-[18px] border border-white/60 bg-[#E2E2E2] p-3"
          onPress={() => onOpen(item)}
        >
          <View className="h-11 w-11 items-center justify-center rounded-full bg-g000st-silver">
            <Text className="text-base font-black text-white">g</Text>
          </View>
          <View className="ml-3 min-w-0 flex-1">
            <Text className="font-mono text-[12px] font-black text-g000st-black">
              {shortId(item.participantPublicId)}
            </Text>
            <Text className="mt-1" numberOfLines={1}>
              <Text className="text-xs font-semibold text-black/45">
                {item.lastMessagePreview || 'Private conversation'}
              </Text>
            </Text>
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
      )}
    />
  );
}

export const ChatConversationList = memo(ChatConversationListComponent);
