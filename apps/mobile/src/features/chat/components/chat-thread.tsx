import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Switch,
  Text,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { Easing, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConfirmModal } from '@/providers/confirm-modal-provider';

import type { ChatMessage } from '@/domain/chat/types';
import { BlurredMessageText } from '@/features/chat/components/blurred-message-text';
import { MessageAttachment } from '@/features/chat/components/message-attachment';
import { VoiceComposer } from '@/features/chat/components/voice-composer';
import type { OutboxMessage } from '@/features/chat/hooks/use-private-chat';

type ChatThreadMessage = ChatMessage | OutboxMessage;

type ChatThreadProps = Readonly<{
  attachmentError: string | null;
  blurMessages: boolean;
  burnAfterRead: boolean;
  draft: string;
  error: string | null;
  firstUnreadMessageId?: string;
  hasOlderMessages: boolean;
  isLoading: boolean;
  isLoadingOlderMessages: boolean;
  isParticipantDeleted: boolean;
  isSending: boolean;
  messages: readonly ChatThreadMessage[];
  nowMs: number;
  onBack: () => void;
  onCallAudio: () => void;
  onCallVideo: () => void;
  onCaptureAttachment: () => Promise<void>;
  onChangeDraft: (value: string) => void;
  onLoadOlder: () => void;
  onPickDocumentAttachment: () => Promise<void>;
  onPickLibraryAttachment: () => Promise<void>;
  onOpenBurn: (messageId: string) => void;
  onRefresh: () => void;
  onRetry: (clientMessageId: string) => void;
  onRemoveAttachment: (fileName: string) => void;
  onSend: () => void;
  onSendVoice: (uri: string, durationMs: number) => Promise<boolean>;
  onToggleBurn: () => void;
  onToggleMessageBlur: () => void;
  onVoiceError: (message: string | null) => void;
  participantAvatarUrl?: string;
  participantDisplayName?: string;
  participantPublicId: string;
  userPublicId: string;
  attachments: readonly Readonly<{ fileName: string }> [];
}>;

const NEAR_BOTTOM_THRESHOLD = 80;
const SCROLL_TO_BOTTOM_THRESHOLD = 200;

const messageEntering = FadeInDown.duration(220)
  .easing(Easing.out(Easing.cubic))
  .reduceMotion(ReduceMotion.System);

function shortId(publicId: string): string {
  return publicId.slice(-8);
}

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function hasStatus(message: ChatThreadMessage): message is OutboxMessage {
  return 'status' in message;
}

type MessageBubbleProps = Readonly<{
  isNew: boolean;
  blurMessages: boolean;
  message: ChatThreadMessage;
  mine: boolean;
  nowMs: number;
  onOpenBurn: (messageId: string) => void;
  onRetry: (clientMessageId: string) => void;
}>;

function MessageBubbleComponent({
  isNew,
  blurMessages,
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
        ) : message.content ? (
          <BlurredMessageText blurred={blurMessages} content={message.content} mine={mine} />
        ) : null}
        {!message.locked && message.attachments?.length ? (
          <View className={message.content ? 'mt-2 gap-2' : 'gap-2'}>
            {message.attachments.map((attachment) => (
              <MessageAttachment
                attachment={attachment}
                conversationId={message.conversationId}
                key={attachment.id}
                messageId={message.id}
              />
            ))}
          </View>
        ) : null}
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
  attachmentError,
  blurMessages,
  burnAfterRead,
  draft,
  error,
  firstUnreadMessageId,
  hasOlderMessages,
  isLoading,
  isLoadingOlderMessages,
  isParticipantDeleted,
  isSending,
  messages,
  nowMs,
  onBack,
  onCallAudio,
  onCallVideo,
  onCaptureAttachment,
  onChangeDraft,
  onLoadOlder,
  onPickDocumentAttachment,
  onPickLibraryAttachment,
  onOpenBurn,
  onRefresh,
  onRetry,
  onRemoveAttachment,
  onSend,
  onSendVoice,
  onToggleBurn,
  onToggleMessageBlur,
  onVoiceError,
  participantAvatarUrl,
  participantDisplayName,
  participantPublicId,
  userPublicId,
  attachments,
}: ChatThreadProps) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatThreadMessage>>(null);
  const isNearBottomRef = useRef(true);
  const hasHydratedRef = useRef(false);
  const didScrollToUnreadRef = useRef(false);
  const prevIdsRef = useRef<Set<string> | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const canSend = !isParticipantDeleted && !isSending && (draft.trim().length > 0 || attachments.length > 0);
  const { confirm } = useConfirmModal();

  const handleToggleBurn = useCallback(async () => {
    const isCurrentlyOn = burnAfterRead;
    const confirmed = await confirm({
      title: isCurrentlyOn ? "Disable Burn After Read?" : "Enable Burn After Read?",
      message: isCurrentlyOn
        ? "Messages will no longer burn 5 seconds after they are opened."
        : "Messages will burn 5 seconds after they are opened. Are you sure you want to enable this?",
      confirmLabel: isCurrentlyOn ? "Disable" : "Enable",
      isDangerous: !isCurrentlyOn,
    });

    if (confirmed) {
      onToggleBurn();
    }
  }, [burnAfterRead, confirm, onToggleBurn]);

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
            blurMessages={blurMessages}
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
    [blurMessages, firstUnreadMessageId, nowMs, onOpenBurn, onRetry, userPublicId],
  );

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: '#D0D0D0' }}>
      {/* Header */}
      <View className="h-12 flex-row items-center border-b border-black/10 bg-[#D0D0D0] px-2">
        <Pressable
          accessibilityLabel="Back to conversations"
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center rounded-full"
          onPress={onBack}
        >
          <Text className="text-2xl font-black text-g000st-black">‹</Text>
        </Pressable>
        <View className="ml-1 h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#DDD]">
          {!isParticipantDeleted && participantAvatarUrl ? (
            <Image contentFit="cover" source={{ uri: participantAvatarUrl }} style={{ height: '100%', width: '100%' }} />
          ) : (
            <Text>◎</Text>
          )}
        </View>
        <View className="ml-2 min-w-0 flex-1">
          <Text className="text-[11px] font-bold text-black/45">PRIVATE CHAT</Text>
          <Text className="font-mono text-[12px] font-black text-g000st-black" numberOfLines={1}>
            {isParticipantDeleted ? 'Deleted account' : participantDisplayName || shortId(participantPublicId)}
          </Text>
        </View>
        <View className="mr-1 flex-row items-center">
          <Text className="text-[9px] font-black text-black/45">BLUR</Text>
          <Switch
            accessibilityLabel={`Message blur ${blurMessages ? 'on' : 'off'}`}
            onValueChange={onToggleMessageBlur}
            thumbColor="#FFFFFF"
            trackColor={{ false: '#B0B0B0', true: '#111111' }}
            value={blurMessages}
            style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
          />
        </View>
        {isParticipantDeleted ? null : (
          <View className="flex-row items-center gap-1">
            <Pressable
              accessibilityLabel="Call"
              accessibilityRole="button"
              className="h-9 w-9 items-center justify-center rounded-full active:bg-black/5"
              onPress={onCallAudio}
            >
              <Text className="text-lg">📞</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Video call"
              accessibilityRole="button"
              className="h-9 w-9 items-center justify-center rounded-full active:bg-black/5"
              onPress={onCallVideo}
            >
              <Text className="text-lg">🎥</Text>
            </Pressable>
          </View>
        )}
      </View>

      <KeyboardAvoidingView automaticOffset behavior="padding" style={{ flex: 1 }}>
        {/* Messages area */}
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
          <View style={{ flex: 1 }}>
            <FlatList
              ref={listRef}
              style={{ flex: 1, backgroundColor: '#D8D8D8' }}
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', padding: 12 }}
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

        {/* Input bar */}
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
                  className="h-8 w-10 items-center justify-center rounded-full"
                  onPress={() => setIsAttachmentMenuOpen(true)}
                >
                  <Text className="text-[28px] font-bold text-g000st-silver">+</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Burn after read ${burnAfterRead ? 'on' : 'off'}`}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: burnAfterRead }}
                  className={`min-w-10 mt-2 rounded-full px-1.5 py-0.5 ${
                    burnAfterRead ? 'bg-g000st-red' : 'bg-black/20'
                  }`}
                  onPress={handleToggleBurn}
                >
                  <Text className="text-center text-[8px] font-black text-white">
                    {burnAfterRead ? '🔥 ON' : 'BURN'}
                  </Text>
                </Pressable>
              </View>
              <VoiceComposer
                canSendText={canSend}
                draft={draft}
                hasAttachments={attachments.length > 0}
                isSending={isSending}
                onChangeDraft={onChangeDraft}
                onError={onVoiceError}
                onSend={onSendVoice}
                onSendText={handleSend}
              />
            </View>
            {attachmentError ? (
              <Text className="mt-1 text-center text-[10px] font-bold text-g000st-red">
                {attachmentError}
              </Text>
            ) : null}
            {attachments.length ? (
              <View className="mt-1 flex-row flex-wrap gap-1">
                {attachments.map((attachment) => (
                  <Pressable key={attachment.fileName} className="rounded-full bg-white px-2 py-1" onPress={() => onRemoveAttachment(attachment.fileName)}>
                    <Text className="text-[10px] font-bold text-g000st-black">{attachment.fileName} ×</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Text className="pt-0.5 text-center text-[10px] font-bold leading-3 text-black/40">
              Kept 2 hours · Burn 5s {burnAfterRead ? 'ON' : 'OFF'} · Screenshots possible
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
      <Modal animationType="fade" transparent visible={isAttachmentMenuOpen} onRequestClose={() => setIsAttachmentMenuOpen(false)}>
        <Pressable className="flex-1 items-center justify-end bg-black/45 p-5" onPress={() => setIsAttachmentMenuOpen(false)}>
          <View className="w-full rounded-[24px] bg-white p-4 mb-10">
            {[
              ['Photo or video library', onPickLibraryAttachment],
              ['Camera', onCaptureAttachment],
              ['PDF or Word file', onPickDocumentAttachment],
            ].map(([label, action]) => (
              <Pressable key={label as string} className="border-b border-black/10 py-4" onPress={() => { setIsAttachmentMenuOpen(false); void (action as () => Promise<void>)(); }}>
                <Text className="text-center font-bold text-g000st-black">{label as string}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export const ChatThread = memo(ChatThreadComponent);
