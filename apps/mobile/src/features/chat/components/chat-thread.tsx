import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { Easing, FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { KeyboardAvoidingView } from '@/components/layout/keyboard-avoiding-view';
import type { ChatMessage } from '@/domain/chat/types';
import type { OutboxMessage } from '@/features/chat/hooks/use-private-chat';

type ChatThreadMessage = ChatMessage | OutboxMessage;

type ChatThreadProps = Readonly<{
  burnAfterRead: boolean;
  draft: string;
  error: string | null;
  firstUnreadMessageId?: string;
  hasOlderMessages: boolean;
  isLoading: boolean;
  isLoadingOlderMessages: boolean;
  isParticipantDeleted: boolean;
  messages: readonly ChatThreadMessage[];
  nowMs: number;
  onBack: () => void;
  onChangeDraft: (value: string) => void;
  onLoadOlder: () => void;
  onOpenBurn: (messageId: string) => void;
  onRefresh: () => void;
  onRetry: (clientMessageId: string) => void;
  onSend: () => void;
  onToggleBurn: () => void;
  participantPublicId: string;
  userPublicId: string;
}>;

const NEAR_BOTTOM_THRESHOLD = 80;
const SCROLL_TO_BOTTOM_THRESHOLD = 200;

const messageEntering = FadeInDown.duration(220)
  .easing(Easing.out(Easing.cubic))
  .reduceMotion(ReduceMotion.System);

function shortId(publicId: string): string {
  return `${publicId.slice(0, 12)}…${publicId.slice(-6)}`;
}

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function hasStatus(message: ChatThreadMessage): message is OutboxMessage {
  return 'status' in message;
}

type MessageBubbleProps = Readonly<{
  isNew: boolean;
  message: ChatThreadMessage;
  mine: boolean;
  nowMs: number;
  onOpenBurn: (messageId: string) => void;
  onRetry: (clientMessageId: string) => void;
}>;

function MessageBubbleComponent({
  isNew,
  message,
  mine,
  nowMs,
  onOpenBurn,
  onRetry,
}: MessageBubbleProps) {
  const failed = hasStatus(message) && message.status === 'failed';
  const pending = hasStatus(message) && message.status === 'pending';
  const canPress = failed || message.locked;
  const burnSecondsLeft = message.burnStartedAtMs
    ? Math.max(0, Math.ceil((message.expiresAtMs - nowMs) / 1_000))
    : null;
  const deliveryLabel = mine && !pending
    ? message.burnAfterReadSeconds
      ? message.burnStartedAtMs
        ? 'Opened'
        : 'Sent'
      : message.readAtMs
        ? 'Read'
        : 'Sent'
    : null;

  const handlePress = () => {
    if (failed) onRetry(message.clientMessageId);
    else if (message.locked) onOpenBurn(message.id);
  };

  const bubble = (
    <View className={`mb-2 flex-row ${mine ? 'justify-end' : 'justify-start'}`}>
      <Pressable
        accessibilityHint={message.locked ? 'Opens this message for five seconds' : undefined}
        accessibilityRole={canPress ? 'button' : undefined}
        className={`max-w-[78%] px-3 py-2 ${
          mine
            ? `rounded-[18px] rounded-br border bg-[#E0E0E0] ${
                failed ? 'border-2 border-g000st-red' : 'border-g000st-silver'
              }`
            : 'rounded-[18px] rounded-bl border-2 border-g000st-silver bg-[#A8A8A8]'
        } ${pending ? 'opacity-60' : ''}`}
        disabled={!canPress}
        onPress={handlePress}
      >
        {message.locked ? (
          <Text className="text-sm font-black leading-5 text-white">
            🔒 Tap to open · burns in 5s
          </Text>
        ) : (
          <Text className={`text-sm font-bold leading-5 ${mine ? 'text-black' : 'text-white'}`}>
            {message.content}
          </Text>
        )}
        {failed ? (
          <Text className="mt-1 text-right text-[10px] font-black text-g000st-red">
            Not sent · Tap to retry
          </Text>
        ) : (
          <View className="mt-1 flex-row items-center justify-end gap-1">
            {message.burnAfterReadSeconds ? (
              <Text className={`text-[10px] font-black ${mine ? 'text-g000st-red' : 'text-white'}`}>
                {burnSecondsLeft === null ? '🔥 Burn 5s' : `🔥 ${burnSecondsLeft}s`}
              </Text>
            ) : null}
            <Text className={`text-[10px] font-bold ${mine ? 'text-black/40' : 'text-white/75'}`}>
              {pending
                ? 'Sending…'
                : `${formatTime(message.createdAtMs)}${deliveryLabel ? ` · ${deliveryLabel}` : ''}`}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );

  if (!isNew) return bubble;
  return <Animated.View entering={messageEntering}>{bubble}</Animated.View>;
}

const MessageBubble = memo(MessageBubbleComponent);

function ChatThreadComponent({
  burnAfterRead,
  draft,
  error,
  firstUnreadMessageId,
  hasOlderMessages,
  isLoading,
  isLoadingOlderMessages,
  isParticipantDeleted,
  messages,
  nowMs,
  onBack,
  onChangeDraft,
  onLoadOlder,
  onOpenBurn,
  onRefresh,
  onRetry,
  onSend,
  onToggleBurn,
  participantPublicId,
  userPublicId,
}: ChatThreadProps) {
  const listRef = useRef<FlatList<ChatThreadMessage>>(null);
  const isNearBottomRef = useRef(true);
  const hasHydratedRef = useRef(false);
  const didScrollToUnreadRef = useRef(false);
  const prevIdsRef = useRef<Set<string> | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const canSend = !isParticipantDeleted && draft.trim().length > 0;

  useEffect(() => {
    didScrollToUnreadRef.current = false;
    hasHydratedRef.current = false;
    isNearBottomRef.current = !firstUnreadMessageId;
  }, [firstUnreadMessageId, participantPublicId]);

  useEffect(() => {
    prevIdsRef.current = new Set(messages.map((message) => message.id));
  }, [messages]);

  useEffect(() => {
    if (!firstUnreadMessageId || didScrollToUnreadRef.current) return;
    const index = messages.findIndex((message) => message.id === firstUnreadMessageId);
    if (index < 0) return;

    didScrollToUnreadRef.current = true;
    isNearBottomRef.current = false;
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ animated: false, index, viewPosition: 0.18 });
    });
    return () => cancelAnimationFrame(frame);
  }, [firstUnreadMessageId, messages]);

  useEffect(() => {
    if (
      messages.length === 0 ||
      !isNearBottomRef.current ||
      (firstUnreadMessageId && !didScrollToUnreadRef.current)
    ) {
      return;
    }

    const animated = hasHydratedRef.current;
    const frame = requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated }));
    hasHydratedRef.current = true;
    return () => cancelAnimationFrame(frame);
  }, [firstUnreadMessageId, messages]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    isNearBottomRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
    setShowScrollToBottom(distanceFromBottom > SCROLL_TO_BOTTOM_THRESHOLD);
  }, []);

  const scrollToBottom = useCallback(() => {
    isNearBottomRef.current = true;
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  const handleSend = useCallback(() => {
    isNearBottomRef.current = true;
    onSend();
  }, [onSend]);

  const renderItem = useCallback(
    ({ item }: { item: ChatThreadMessage }) => {
      const isNew = prevIdsRef.current !== null && !prevIdsRef.current.has(item.id);
      return (
        <View>
          {item.id === firstUnreadMessageId ? (
            <View className="mb-3 mt-1 flex-row items-center gap-2">
              <View className="h-px flex-1 bg-g000st-red/40" />
              <Text className="text-[10px] font-black uppercase tracking-wider text-g000st-red">
                Unread
              </Text>
              <View className="h-px flex-1 bg-g000st-red/40" />
            </View>
          ) : null}
          <MessageBubble
            isNew={isNew}
            message={item}
            mine={item.senderPublicId === userPublicId}
            nowMs={nowMs}
            onOpenBurn={onOpenBurn}
            onRetry={onRetry}
          />
        </View>
      );
    },
    [firstUnreadMessageId, nowMs, onOpenBurn, onRetry, userPublicId],
  );

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
            {isParticipantDeleted ? 'Deleted account' : shortId(participantPublicId)}
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
        <View className="flex-1">
          <FlatList
            ref={listRef}
            className="flex-1 bg-[#D8D8D8]"
            contentContainerClassName="grow justify-end p-3"
            data={messages}
            keyExtractor={(item) => item.id}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            onScroll={handleScroll}
            onScrollToIndexFailed={({ index }) => {
              setTimeout(() => {
                listRef.current?.scrollToIndex({ animated: false, index, viewPosition: 0.18 });
              }, 100);
            }}
            scrollEventThrottle={100}
            ListHeaderComponent={
              hasOlderMessages || isLoadingOlderMessages ? (
                <Pressable
                  accessibilityRole="button"
                  className="mb-3 h-9 items-center justify-center rounded-full bg-white/60"
                  disabled={isLoadingOlderMessages}
                  onPress={onLoadOlder}
                >
                  {isLoadingOlderMessages ? (
                    <ActivityIndicator color="#9A9A9A" size="small" />
                  ) : (
                    <Text className="text-[11px] font-black text-black/50">
                      Load earlier messages
                    </Text>
                  )}
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center px-7 py-12">
                <Text className="text-center text-[13px] font-semibold leading-5 text-black/45">
                  This private conversation is empty. Send the first message.
                </Text>
              </View>
            }
            renderItem={renderItem}
          />
          {showScrollToBottom ? (
            <Pressable
              accessibilityLabel="Scroll to latest message"
              accessibilityRole="button"
              className="absolute bottom-3 right-3 h-10 w-10 items-center justify-center rounded-full border border-black/15 bg-white shadow"
              onPress={scrollToBottom}
            >
              <Text className="text-lg font-black text-g000st-black">↓</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {isParticipantDeleted ? (
        <View className="border-t border-black/10 bg-[#D0D0D0] px-4 py-3">
          <Text className="text-center text-xs font-bold text-black/50">
            This account was deleted. You can read retained messages, but cannot send new ones.
          </Text>
        </View>
      ) : (
        <View className="border-t border-black/10 bg-[#D0D0D0] px-[10px] pb-1 pt-1.5">
          <View className="flex-row items-end gap-2">
            <View className="items-center">
              <Pressable
                accessibilityLabel="Attach"
                accessibilityRole="button"
                accessibilityState={{ disabled: true }}
                className="h-8 w-10 items-center justify-center rounded-full opacity-40"
                disabled
              >
                <Text className="text-[28px] font-bold text-g000st-silver">+</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Burn after read ${burnAfterRead ? 'on' : 'off'}`}
                accessibilityRole="switch"
                accessibilityState={{ checked: burnAfterRead }}
                className={`min-w-10 rounded-full px-1.5 py-0.5 ${
                  burnAfterRead ? 'bg-g000st-red' : 'bg-black/20'
                }`}
                onPress={onToggleBurn}
              >
                <Text className="text-center text-[8px] font-black text-white">
                  {burnAfterRead ? '🔥 ON' : 'BURN'}
                </Text>
              </Pressable>
            </View>
            <View className="min-h-11 flex-1 justify-center rounded-[22px] border border-black/15 bg-white px-1.5">
              <TextInput
                accessibilityLabel="Message"
                className="max-h-28 min-h-11 w-full px-2.5 pb-1.5 pt-2.5 text-[15px] text-g000st-black"
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
              onPress={handleSend}
            >
              <Text className="text-base font-black text-white">➤</Text>
            </Pressable>
          </View>
          <Text className="pt-0.5 text-center text-[10px] font-bold leading-3 text-black/40">
            Kept 2 hours · Burn 5s {burnAfterRead ? 'ON' : 'OFF'} · Screenshots possible
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

export const ChatThread = memo(ChatThreadComponent);
