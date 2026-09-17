import { memo, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { KeyboardAvoidingView } from '@/components/layout/keyboard-avoiding-view';
import type { ChatMessage } from '@/domain/chat/types';

type ChatThreadProps = Readonly<{
  draft: string;
  error: string | null;
  isLoading: boolean;
  isSending: boolean;
  messages: readonly ChatMessage[];
  onBack: () => void;
  onChangeDraft: (value: string) => void;
  onRefresh: () => void;
  onSend: () => void;
  participantPublicId: string;
  sendError: string | null;
  userPublicId: string;
}>;

function shortId(publicId: string): string {
  return `${publicId.slice(0, 12)}…${publicId.slice(-6)}`;
}

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ChatThreadComponent({
  draft,
  error,
  isLoading,
  isSending,
  messages,
  onBack,
  onChangeDraft,
  onRefresh,
  onSend,
  participantPublicId,
  sendError,
  userPublicId,
}: ChatThreadProps) {
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const canSend = draft.trim().length > 0 && !isSending;

  useEffect(() => {
    if (messages.length === 0) return;
    const frame = requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [messages.length]);

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1">
      <View className="h-12 flex-row items-center border-b border-black/10 bg-[#D0D0D0] px-2">
        <Pressable
          accessibilityLabel="Back to conversations"
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center rounded-full"
          onPress={onBack}
        >
          <Text className="text-2xl font-black text-g000st-black">‹</Text>
        </Pressable>
        <View className="ml-1 min-w-0 flex-1">
          <Text className="text-[11px] font-bold text-black/45">PRIVATE CHAT</Text>
          <Text className="font-mono text-[12px] font-black text-g000st-black" numberOfLines={1}>
            {shortId(participantPublicId)}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center bg-[#D8D8D8]">
          <ActivityIndicator color="#9A9A9A" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center bg-[#D8D8D8] px-7">
          <Text className="text-center text-sm font-bold text-g000st-red">{error}</Text>
          <Pressable
            accessibilityRole="button"
            className="mt-4 h-11 rounded-full bg-white px-5"
            onPress={onRefresh}
          >
            <Text className="pt-3 font-black text-g000st-black">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          className="flex-1 bg-[#D8D8D8]"
          contentContainerClassName="grow justify-end p-3"
          data={messages}
          keyExtractor={(item) => item.id}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-7 py-12">
              <Text className="text-center text-[13px] font-semibold leading-5 text-black/45">
                This private conversation is empty. Send the first message.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.senderPublicId === userPublicId;
            return (
              <View className={`mb-2 flex-row ${mine ? 'justify-end' : 'justify-start'}`}>
                <View
                  className={`max-w-[78%] px-3 py-2 ${
                    mine
                      ? 'rounded-[18px] rounded-br border border-g000st-silver bg-[#E0E0E0]'
                      : 'rounded-[18px] rounded-bl border-2 border-g000st-silver bg-[#A8A8A8]'
                  }`}
                >
                  <Text className={`text-sm font-bold leading-5 ${mine ? 'text-black' : 'text-white'}`}>
                    {item.content}
                  </Text>
                  <Text
                    className={`mt-1 text-right text-[10px] font-bold ${
                      mine ? 'text-black/40' : 'text-white/75'
                    }`}
                  >
                    {formatTime(item.createdAtMs)}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {sendError ? (
        <Text
          accessibilityLiveRegion="polite"
          className="bg-[#D0D0D0] px-4 pt-1 text-center text-[11px] font-bold text-g000st-red"
        >
          {sendError}
        </Text>
      ) : null}

      <View className="border-t border-black/10 bg-[#D0D0D0] px-[10px] pb-1 pt-1.5">
        <View className="flex-row items-end gap-2">
          <Pressable
            accessibilityLabel="Attach"
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            className="h-10 w-10 items-center justify-center rounded-full opacity-40"
            disabled
          >
            <Text className="text-[28px] font-bold text-g000st-silver">+</Text>
          </Pressable>
          <View className="min-h-11 flex-1 justify-center rounded-[22px] border border-black/15 bg-white px-1.5">
            <TextInput
              accessibilityLabel="Message"
              className="max-h-28 min-h-11 w-full px-2.5 pb-1.5 pt-2.5 text-[15px] text-g000st-black"
              editable={!isSending}
              maxLength={4_000}
              multiline
              onChangeText={onChangeDraft}
              placeholder="Type a message"
              placeholderTextColor="#777777"
              value={draft}
            />
          </View>
          <Pressable
            accessibilityLabel="Send"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend }}
            className={`h-[42px] w-[42px] items-center justify-center rounded-full bg-g000st-silver ${
              canSend ? '' : 'opacity-50'
            }`}
            disabled={!canSend}
            onPress={onSend}
          >
            <Text className="text-base font-black text-white">➤</Text>
          </Pressable>
        </View>
        <Text className="pt-0.5 text-center text-[10px] font-bold leading-3 text-black/40">
          Private conversation · Screenshots may be possible
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

export const ChatThread = memo(ChatThreadComponent);
