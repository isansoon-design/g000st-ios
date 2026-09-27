import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import * as ScreenCapture from "expo-screen-capture";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PeerPreferences } from "@/api/contacts";
import { useConfirmModal } from "@/providers/confirm-modal-provider";

import { AppThemeSwitch } from "@/components/navigation/app-theme-switch";
import type { ChatMessage } from "@/domain/chat/types";
import { BlurredMessageText } from "@/features/chat/components/blurred-message-text";
import { BurnFlameBorder } from "@/features/chat/components/burn-flame-border";
import { MessageAttachment } from "@/features/chat/components/message-attachment";
import { VoiceComposer } from "@/features/chat/components/voice-composer";
import type { OutboxMessage } from "@/features/chat/hooks/use-private-chat";
import { useAppTheme } from "@/theme/app-theme";

type ChatThreadMessage = ChatMessage | OutboxMessage;

type ChatThreadProps = Readonly<{
  attachmentError: string | null;
  blurMessages: boolean;
  burnAfterRead: boolean;
  conversationKind: "private" | "market";
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
  onViewProfile: () => void;
  onMessageActions: (message: ChatMessage) => void;
  onCallAudio: () => void;
  onCallVideo: () => void;
  onToggleFollow: () => Promise<void>;
  onUpdatePeerPreferences: (changes: Partial<PeerPreferences>) => Promise<void>;
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
  peerPreferences: PeerPreferences | null;
  followingPeer: boolean | null;
  participantPublicId: string;
  userPublicId: string;
  attachments: readonly Readonly<{ fileName: string }>[];
}>;

const NEAR_BOTTOM_THRESHOLD = 80;
const SCROLL_TO_BOTTOM_THRESHOLD = 200;

const messageEntering = FadeInDown.duration(220)
  .easing(Easing.out(Easing.cubic))
  .reduceMotion(ReduceMotion.System);

function shortId(publicId: string): string {
  return publicId.slice(0, 8);
}

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hasStatus(message: ChatThreadMessage): message is OutboxMessage {
  return "status" in message;
}

type MessageBubbleProps = Readonly<{
  isNew: boolean;
  blurMessages: boolean;
  message: ChatThreadMessage;
  mine: boolean;
  maxWidth: number;
  nowMs: number;
  onOpenBurn: (messageId: string) => void;
  onActions: (message: ChatMessage) => void;
  onRetry: (clientMessageId: string) => void;
  fontSize: number;
  isDark: boolean;
  incomingColor: string;
  outgoingColor: string;
}>;

function MessageBubbleComponent({
  isNew,
  blurMessages,
  message,
  mine,
  maxWidth,
  nowMs,
  onOpenBurn,
  onActions,
  onRetry,
  fontSize,
  isDark,
  incomingColor,
  outgoingColor,
}: MessageBubbleProps) {
  const [bubbleSize, setBubbleSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const textMaxWidth = maxWidth - 26;
  const failed = hasStatus(message) && message.status === "failed";
  const pending = hasStatus(message) && message.status === "pending";
  const hasBurnEffect = Boolean(message.burnAfterReadSeconds && !failed);
  const canPress = failed || message.locked;
  const canShowActions = mine && !failed && !pending;
  const burnSecondsLeft = message.burnStartedAtMs && message.expiresAtMs !== undefined
    ? Math.max(0, Math.ceil((message.expiresAtMs - nowMs) / 1_000))
    : null;
  const deliveryLabel =
    mine && !pending
      ? message.burnAfterReadSeconds
        ? message.burnStartedAtMs
          ? "Opened"
          : "Sent"
        : message.readAtMs
          ? "Read"
          : "Sent"
      : null;

  const handlePress = () => {
    if (failed) onRetry(message.clientMessageId);
    else if (message.locked) onOpenBurn(message.id);
  };

  const bubble = (
    <View
      className={`${hasBurnEffect ? "mb-4 mt-3" : "mb-2"} flex-row ${mine ? "justify-end" : "justify-start"}`}
    >
      <Pressable
        accessibilityHint={
          canShowActions
            ? "Hold for two seconds to edit or delete message"
            : message.locked
              ? `Opens this message for ${message.burnAfterReadSeconds} seconds`
              : undefined
        }
        accessibilityRole={canPress || canShowActions ? "button" : undefined}
        accessibilityActions={
          canShowActions
            ? [{ name: "activate", label: "Message options" }]
            : undefined
        }
        onAccessibilityAction={
          canShowActions ? () => onActions(message) : undefined
        }
        className={`shrink rounded-[18px] px-3 py-2 ${mine && !hasBurnEffect ? "rounded-br" : ""} ${!mine && !hasBurnEffect ? "rounded-bl" : ""} ${pending ? "opacity-60" : ""}`}
        style={{
          maxWidth,
          backgroundColor: mine ? outgoingColor : incomingColor,
          borderColor: isDark || failed ? "#C1282D" : "transparent",
          borderWidth: isDark || failed ? 2 : 0,
        }}
        onLayout={
          hasBurnEffect
            ? (event) => {
              const { width, height } = event.nativeEvent.layout;
              setBubbleSize((current) =>
                current?.width === width && current.height === height
                  ? current
                  : { width, height },
              );
            }
            : undefined
        }
        disabled={!canPress && !canShowActions}
        onPress={handlePress}
        delayLongPress={2000}
        onLongPress={canShowActions ? () => onActions(message) : undefined}
      >
        {hasBurnEffect &&
          bubbleSize !== null &&
          bubbleSize.width > 0 &&
          bubbleSize.height > 0 ? (
          <BurnFlameBorder
            width={bubbleSize.width}
            height={bubbleSize.height}
            burning={burnSecondsLeft !== null}
          />
        ) : null}
        {message.locked ? (
          <Text
            className="shrink font-black text-white"
            style={{
              fontSize,
              lineHeight: Math.round(fontSize * 1.4),
              maxWidth: textMaxWidth,
            }}
          >
            {`🔒 Tap to open · burns in ${message.burnAfterReadSeconds}s`}
          </Text>
        ) : message.content ? (
          <BlurredMessageText
            blurred={blurMessages}
            content={message.content}
            mine={mine}
            fontSize={fontSize}
            maxWidth={textMaxWidth}
          />
        ) : null}
        {!message.locked && message.attachments?.length ? (
          <View className={message.content ? "mt-2 gap-2" : "gap-2"}>
            {message.attachments.map((attachment) => (
              <MessageAttachment
                attachment={attachment}
                conversationId={message.conversationId}
                key={attachment.id}
                messageId={message.id}
                onLongPress={
                  canShowActions ? () => onActions(message) : undefined
                }
              />
            ))}
          </View>
        ) : null}
        {failed ? (
          <Text className="mt-1 text-right text-[10px] font-black text-white">
            Not sent · Tap to retry
          </Text>
        ) : (
          <View className="mt-1 flex-row items-center justify-end gap-1">
            {message.burnAfterReadSeconds ? (
              <Text className="text-[10px] font-black text-white">
                {burnSecondsLeft === null
                  ? `🔥 Burn ${message.burnAfterReadSeconds}s`
                  : `🔥 ${burnSecondsLeft}s`}
              </Text>
            ) : null}
            <Text className="shrink text-[10px] font-bold text-white/75">
              {pending
                ? "Sending…"
                : `${formatTime(message.createdAtMs)}${message.editedAtMs ? " · edited" : ""}${deliveryLabel ? ` · ${deliveryLabel}` : ""}${canShowActions ? " · hold for options" : ""}`}
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
  conversationKind,
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
  onViewProfile,
  onMessageActions,
  onCallAudio,
  onCallVideo,
  onToggleFollow,
  onUpdatePeerPreferences,
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
  peerPreferences,
  followingPeer,
  participantPublicId,
  userPublicId,
  attachments,
}: ChatThreadProps) {
  const { width: windowWidth } = useWindowDimensions();
  const { colors, isDark } = useAppTheme();
  const bubbleMaxWidth = Math.floor((windowWidth - 24) * 0.78);
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatThreadMessage>>(null);
  const isNearBottomRef = useRef(true);
  const hasHydratedRef = useRef(false);
  const didScrollToUnreadRef = useRef(false);
  const prevIdsRef = useRef<Set<string> | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [peerMenuPublicId, setPeerMenuPublicId] = useState<string | null>(null);
  const isPeerMenuOpen = peerMenuPublicId === participantPublicId;
  const [isPeerMenuBusy, setIsPeerMenuBusy] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const canSend =
    !isParticipantDeleted &&
    !peerPreferences?.blocked &&
    !isSending &&
    (draft.trim().length > 0 || attachments.length > 0);
  const { confirm } = useConfirmModal();

  useFocusEffect(
    useCallback(() => {
      void ScreenCapture.preventScreenCaptureAsync();
      return () => {
        void ScreenCapture.allowScreenCaptureAsync();
      };
    }, []),
  );

  const handleToggleBurn = useCallback(async () => {
    const isCurrentlyOn = burnAfterRead;
    const confirmed = await confirm({
      title: isCurrentlyOn
        ? "Disable Burn After Read?"
        : "Enable Burn After Read?",
      message: isCurrentlyOn
        ? "Messages will no longer burn 60 seconds after they are opened."
        : "Messages will burn 60 seconds after they are opened. Are you sure you want to enable this?",
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
    const index = messages.findIndex(
      (message) => message.id === firstUnreadMessageId,
    );
    if (index < 0) return;

    didScrollToUnreadRef.current = true;
    isNearBottomRef.current = false;
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        animated: false,
        index,
        viewPosition: 0.18,
      });
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
    const frame = requestAnimationFrame(() =>
      listRef.current?.scrollToEnd({ animated }),
    );
    hasHydratedRef.current = true;
    return () => cancelAnimationFrame(frame);
  }, [firstUnreadMessageId, messages]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      isNearBottomRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
      setShowScrollToBottom(distanceFromBottom > SCROLL_TO_BOTTOM_THRESHOLD);
    },
    [],
  );

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
      const isNew =
        prevIdsRef.current !== null && !prevIdsRef.current.has(item.id);
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
            maxWidth={bubbleMaxWidth}
            nowMs={nowMs}
            onOpenBurn={onOpenBurn}
            onActions={onMessageActions}
            onRetry={onRetry}
            fontSize={fontSize}
            isDark={isDark}
            incomingColor={colors.incoming}
            outgoingColor={colors.outgoing}
          />
        </View>
      );
    },
    [
      blurMessages,
      bubbleMaxWidth,
      firstUnreadMessageId,
      nowMs,
      onOpenBurn,
      onMessageActions,
      onRetry,
      userPublicId,
      fontSize,
      isDark,
      colors.incoming,
      colors.outgoing,
    ],
  );

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top,
        backgroundColor: colors.header,
      }}
    >
      {/* Header */}
      <View
        className="min-h-14 flex-row items-center border-b border-black/10 dark:border-night-border px-2"
        style={{ backgroundColor: colors.header }}
      >
        <Pressable
          accessibilityLabel="Back to conversations"
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center rounded-full"
          onPress={onBack}
        >
          <Text className="text-2xl font-black" style={{ color: colors.text }}>
            ‹
          </Text>
        </Pressable>
        <View
          className="ml-1 h-8 w-8 items-center justify-center overflow-hidden rounded-full"
          style={{ backgroundColor: colors.card }}
        >
          {!isParticipantDeleted && participantAvatarUrl ? (
            <Image
              contentFit="cover"
              source={{ uri: participantAvatarUrl }}
              style={{ height: "100%", width: "100%" }}
            />
          ) : (
            <Text>◎</Text>
          )}
        </View>

        <Pressable
          className="ml-2 min-w-0 flex-1"
          onPress={onViewProfile}
          accessibilityRole="button"
          accessibilityLabel="View participant profile"
        >
          {/* <Text className="text-[11px] font-bold text-black/45 dark:text-night-muted">{conversationKind === 'market' ? 'MARKET CHAT' : 'PRIVATE CHAT'}</Text> */}
          <Text
            className="text-[11px] font-bold"
            style={{ color: colors.muted }}
          >
            {conversationKind === "market" ? "Trading CHAT" : ""}
          </Text>
          <Text
            className="font-mono text-[12px] font-black"
            style={{ color: colors.text }}
            numberOfLines={1}
          >
            {isParticipantDeleted
              ? "Deleted account"
              : participantDisplayName || shortId(participantPublicId)}
          </Text>
        </Pressable>
        {/* Call and conversation controls stay on the first row. */}
        {/* Start Call Buttons */}
        {isParticipantDeleted ? null : (
          <View className="flex-row items-center gap-1">
            <Pressable
              accessibilityLabel="Call"
              accessibilityRole="button"
              className="h-9 w-9 items-center justify-center rounded-full"
              disabled={peerPreferences?.blocked}
              onPress={onCallAudio}
            >
              <Text className="text-lg">📞</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Video call"
              accessibilityRole="button"
              className="h-9 w-9 items-center justify-center rounded-full"
              disabled={peerPreferences?.blocked}
              onPress={onCallVideo}
            >
              <Text className="text-lg">🎥</Text>
            </Pressable>
          </View>
        )}
        {!isParticipantDeleted && (
          <Pressable
            accessibilityLabel="Conversation options"
            accessibilityRole="button"
            className="h-9 w-8 items-center justify-center rounded-full"
            onPress={() => setPeerMenuPublicId(participantPublicId)}
          >
            <Text
              className="text-2xl font-black"
              style={{ color: colors.text }}
            >
              ⋮
            </Text>
          </Pressable>
        )}
      </View>
      <View
        className="min-h-11 flex-row items-center justify-between border-b border-black/10 dark:border-night-border px-3"
        style={{ backgroundColor: colors.toolbar }}
      >
        <View className=" flex-row items-center gap-1">
          {/* Start Increase & Decrease Font Size */}
          <View
            className="flex-row items-center gap-2 rounded-md border border-black/10 dark:border-night-border px-1"
            style={{ backgroundColor: isDark ? "#66656B" : "#FFFFFF80" }}
          >
            <Pressable
              accessibilityLabel="Decrease font size"
              accessibilityRole="button"
              className="h-7 w-7 items-center justify-center rounded-sm bg-white dark:bg-night-surface"
              onPress={() => setFontSize((s) => Math.max(10, s - 2))}
            >
              <Text className="text-lg font-black leading-5 text-black dark:text-night-text">
                -
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Increase font size"
              accessibilityRole="button"
              className="h-7 w-7 items-center justify-center rounded-sm bg-white dark:bg-night-surface"
              onPress={() => setFontSize((s) => Math.min(32, s + 2))}
            >
              <Text className="text-lg font-black leading-5 text-black dark:text-night-text">
                +
              </Text>
            </Pressable>
          </View>
          {/* End Increase & Decrease Font Size */}

          {/* Start Blur */}
          <View className="flex-row items-center">
            <Text
              className="text-[9px] font-black"
              style={{ color: colors.muted }}
            >
              BLUR
            </Text>
            <Switch
              accessibilityLabel={`Message blur ${blurMessages ? "on" : "off"}`}
              onValueChange={onToggleMessageBlur}
              thumbColor="#FFFFFF"
              trackColor={{ false: "#B0B0B0", true: "#111111" }}
              value={blurMessages}
              style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
            />
          </View>
          {/* End Blur */}
        </View>
        {/* End Increase & Decrease Font Size & Blur */}

        <AppThemeSwitch />
      </View>

      <KeyboardAvoidingView
        automaticOffset
        behavior="padding"
        style={{ flex: 1 }}
      >
        {/* Messages area */}
        {isLoading ? (
          <View
            className="flex-1 items-center justify-center"
            style={{ backgroundColor: colors.canvas }}
          >
            <ActivityIndicator color="#9A9A9A" />
          </View>
        ) : error ? (
          <View
            className="flex-1 items-center justify-center px-7"
            style={{ backgroundColor: colors.canvas }}
          >
            <Text className="text-center text-sm font-bold text-g000st-red">
              {error}
            </Text>
            <Pressable
              accessibilityRole="button"
              className="mt-4 h-11 rounded-full bg-white dark:bg-night-surface px-5"
              onPress={onRefresh}
            >
              <Text className="pt-3 font-black text-g000st-black dark:text-night-text">
                Try again
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              ref={listRef}
              style={{ flex: 1, backgroundColor: colors.canvas }}
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: "flex-end",
                padding: 12,
              }}
              data={messages}
              extraData={`${blurMessages}-${fontSize}-${nowMs}-${isDark}`}
              keyExtractor={(item) => item.id}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
              onScroll={handleScroll}
              onScrollToIndexFailed={({ index }) => {
                setTimeout(() => {
                  listRef.current?.scrollToIndex({
                    animated: false,
                    index,
                    viewPosition: 0.18,
                  });
                }, 100);
              }}
              scrollEventThrottle={100}
              ListHeaderComponent={
                hasOlderMessages || isLoadingOlderMessages ? (
                  <Pressable
                    accessibilityRole="button"
                    className="mb-3 h-9 items-center justify-center rounded-full"
                    style={{ backgroundColor: colors.card }}
                    disabled={isLoadingOlderMessages}
                    onPress={onLoadOlder}
                  >
                    {isLoadingOlderMessages ? (
                      <ActivityIndicator color="#9A9A9A" size="small" />
                    ) : (
                      <Text
                        className="text-[11px] font-black"
                        style={{ color: colors.text }}
                      >
                        Load earlier messages
                      </Text>
                    )}
                  </Pressable>
                ) : null
              }
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center px-7 py-12">
                  <Text
                    className="text-center text-[13px] font-semibold leading-5"
                    style={{ color: colors.muted }}
                  >
                    {conversationKind === "market"
                      ? "This Market conversation is empty. Send the first message."
                      : "This private conversation is empty. Send the first message."}
                  </Text>
                </View>
              }
              renderItem={renderItem}
            />
            {showScrollToBottom ? (
              <Pressable
                accessibilityLabel="Scroll to latest message"
                accessibilityRole="button"
                className="absolute bottom-3 right-3 h-10 w-10 items-center justify-center rounded-full border border-black/15 dark:border-night-border shadow"
                style={{ backgroundColor: colors.card }}
                onPress={scrollToBottom}
              >
                <Text
                  className="text-lg font-black"
                  style={{ color: colors.text }}
                >
                  ↓
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {/* Input bar */}
        {isParticipantDeleted || peerPreferences?.blocked ? (
          <View
            className="border-t border-black/10 dark:border-night-border px-4 py-3"
            style={{ backgroundColor: colors.toolbar }}
          >
            <Text
              className="text-center text-xs font-bold"
              style={{ color: colors.muted }}
            >
              {isParticipantDeleted
                ? "This account was deleted. You can read retained messages, but cannot send new ones."
                : "You blocked this account. Unblock it to send messages or call."}
            </Text>
          </View>
        ) : (
          <View
            className="border-t border-black/10 dark:border-night-border px-[10px] pb-1 pt-1.5"
            style={{ backgroundColor: colors.toolbar }}
          >
            <View className="flex-row items-end gap-2">
              <View className="items-center">
                <Pressable
                  accessibilityLabel="Attach"
                  accessibilityRole="button"
                  className="h-8 w-10 items-center justify-center rounded-full"
                  onPress={() => setIsAttachmentMenuOpen(true)}
                >
                  <Text className="text-[28px] font-bold text-g000st-silver dark:text-night-muted">
                    +
                  </Text>
                </Pressable>
                {conversationKind !== "market" && (
                  <Pressable
                    accessibilityLabel={`Burn after read ${burnAfterRead ? "on" : "off"}`}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: burnAfterRead }}
                    className={`min-w-10 mt-2 rounded-full px-1.5 py-0.5 ${burnAfterRead ? "bg-g000st-red" : "bg-black/20"
                      }`}
                    onPress={handleToggleBurn}
                  >
                    <Text className="text-center text-[8px] font-black text-white">
                      {burnAfterRead ? "🔥 ON" : "BURN"}
                    </Text>
                  </Pressable>
                )}
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
                  <Pressable
                    key={attachment.fileName}
                    className="rounded-full bg-white dark:bg-night-surface px-2 py-1"
                    onPress={() => onRemoveAttachment(attachment.fileName)}
                  >
                    <Text className="text-[10px] font-bold text-g000st-black dark:text-night-text">
                      {attachment.fileName} ×
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Text
              className="pt-0.5 text-center text-[10px] font-bold leading-3 my-0.5"
              style={{ color: colors.muted }}
            >
              {conversationKind === "market"
                ? "Market messages are removed after 30 days."
                : "Regular messages disappear from this phone after 2 hours and remain available on the web."}{" "}
              screenshot NOT available
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
      <Modal
        animationType="fade"
        transparent
        visible={isAttachmentMenuOpen}
        onRequestClose={() => setIsAttachmentMenuOpen(false)}
      >
        <Pressable
          className="flex-1 items-center justify-end bg-black/45 p-5"
          onPress={() => setIsAttachmentMenuOpen(false)}
        >
          <View
            className="w-full rounded-[24px] p-4 mb-10"
            style={{ backgroundColor: isDark ? colors.toolbar : "#FFFFFF" }}
          >
            {[
              ["Photo or video library", onPickLibraryAttachment],
              ["Camera", onCaptureAttachment],
              ["PDF or Word file", onPickDocumentAttachment],
            ].map(([label, action]) => (
              <Pressable
                key={label as string}
                className="border-b border-black/10 dark:border-night-border py-4"
                onPress={() => {
                  setIsAttachmentMenuOpen(false);
                  void (action as () => Promise<void>)();
                }}
              >
                <Text
                  className="text-center font-bold"
                  style={{ color: colors.text }}
                >
                  {label as string}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={isPeerMenuOpen}
        onRequestClose={() => setPeerMenuPublicId(null)}
      >
        <Pressable
          className="flex-1 items-center justify-end bg-black/45 p-5"
          onPress={() => setPeerMenuPublicId(null)}
        >
          <View
            className="mb-10 w-full rounded-[24px] p-4"
            style={{ backgroundColor: isDark ? colors.toolbar : "#FFFFFF" }}
          >
            {(
              [
                [
                  followingPeer ? "Unfollow" : "Follow",
                  onToggleFollow,
                  followingPeer !== null,
                ],
                [
                  peerPreferences?.blocked ? "Unblock" : "Block",
                  () =>
                    onUpdatePeerPreferences({
                      blocked: !peerPreferences?.blocked,
                    }),
                  !!peerPreferences,
                ],
                [
                  peerPreferences?.allowAudioCalls === false
                    ? "Allow voice calls"
                    : "Block voice calls",
                  () =>
                    onUpdatePeerPreferences({
                      allowAudioCalls: !peerPreferences?.allowAudioCalls,
                    }),
                  !!peerPreferences,
                ],
                [
                  peerPreferences?.allowVideoCalls === false
                    ? "Allow video calls"
                    : "Block video calls",
                  () =>
                    onUpdatePeerPreferences({
                      allowVideoCalls: !peerPreferences?.allowVideoCalls,
                    }),
                  !!peerPreferences,
                ],
              ] as const
            ).map(([label, action, enabled]) => (
              <Pressable
                key={label}
                className="border-b border-black/10 dark:border-night-border py-4 disabled:opacity-40"
                disabled={!enabled || isPeerMenuBusy}
                onPress={() => {
                  setIsPeerMenuBusy(true);
                  void action().finally(() => {
                    setIsPeerMenuBusy(false);
                    setPeerMenuPublicId(null);
                  });
                }}
              >
                <Text
                  className="text-center font-bold"
                  style={{ color: colors.text }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export const ChatThread = memo(ChatThreadComponent);
